import { inferBusinessTaxDeductibility } from "@/domain/business";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import { numberToCents } from "@/domain/money";
import {
  MAX_STATEMENT_AI_CHUNKS,
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildSpatialLinesFromRawLines,
  buildTransactionsFromRows,
  chunkArray,
  computeStatementFingerprint,
  detectFileKindFromBytes,
  distillStatementBlueprintDraft,
  evaluateDeterministicStatementQuality,
  evaluateMappingConfidence,
  evaluateStatementExtractionQuality,
  extractOfxMetadata,
  extractPrintedStatementTotalCents,
  extractStatementSummaryAmounts,
  extractTransactionsFromSpatialLines,
  findBestStatementBlueprint,
  generateStatementHash,
  isSpreadsheetOrHtmlFileName,
  parseAmountToCents,
  parseSpreadsheetOrHtmlToRows,
  parseStatementInput,
  preprocessStatementTextForAi,
  reconcileStatementTransactions,
  sniffColumnMapping,
  toSpatialBlueprintHints,
  type BlueprintFileKind,
  type BlueprintOrigin,
  type CategoryPredictionSource,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
  type StatementLayoutBlueprint,
  type StatementQualityGateResult,
  type StatementTransaction,
  detectStatementMetadata,
  type CardContextForMetadata,
  type DetectedStatementMetadata,
  parseSpatialPdfDocument,
  type ChecksumGateResult,
  buildCandidateCuratorLines,
  curateLinesWithClientValidation,
} from "@/domain/reconciliation";
import {
  computeTextSha256,
  curateStatementLinesWithAi,
  extractStatementPdfRowsWithAi,
  formatAiQuotaResetHint,
  maskSensitivePiiForAi,
  sanitizeBatchDescriptionForAi,
} from "@/services/ai-assistant";
import { computeFileSha256 } from "@/services/receipt-resolution";
import {
  listStoredStatementBlueprints,
  recordBlueprintFailure,
  recordBlueprintSuccess,
} from "@/services/statement-blueprint-store";
import {
  extractHeaderCellsForCache,
  getCachedColumnMapping,
  setCachedColumnMapping,
} from "@/services/statement-mapping-cache";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
} from "@/services/native/receipt-extractor";
import type { Expense } from "@/types";
import type { AiStatementPdfRow } from "../../../../supabase/functions/_shared/ai-schemas";
import type { StatementImportProgress } from "./statement-reconcile-step";

export const MAX_STATEMENT_VISION_PAGES_OR_IMAGES = 3;

/**
 * Sanitiza descrições para a Micro-IA com blindagem estrita de privacidade e anti-injeção:
 * - Remove quebras de linha e caracteres de controle
 * - Mascara PII sensível (CPFs, agência/conta)
 * - Remove valores monetários (R$, BRL) e datas
 * - Remove delimitadores de injeção (<, >, {, }, [, ], \)
 * - Trunca em 80 caracteres estritos e normaliza espaços
 */
export function sanitizeDescriptionForStatementMicroAi(rawDescription: string): string {
  if (!rawDescription) return "";
  const singleLine = rawDescription.replace(/[\r\n\t\0]+/g, " ");
  const cleaned = sanitizeBatchDescriptionForAi(singleLine);
  const injectionFree = cleaned.replace(/[<>{}\\]+/g, " ");
  return injectionFree.replace(/\s+/g, " ").trim().slice(0, 80);
}

const RASTER_STATEMENT_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
] as const;

export function isRasterStatementImage(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    return true;
  }
  const lower = file.name.trim().toLowerCase();
  return RASTER_STATEMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Inspeciona os primeiros bytes do arquivo para identificar imagens rasterizadas
 * mesmo quando baixadas sem extensão ou MIME (ex.: Android / WhatsApp).
 */
export async function isRasterStatementImageByContent(file: File): Promise<boolean> {
  if (isRasterStatementImage(file)) return true;
  try {
    const headBuffer = await file.slice(0, 32).arrayBuffer();
    return detectFileKindFromBytes(new Uint8Array(headBuffer), file.name || file.type) === "image";
  } catch {
    return false;
  }
}

function isStructuredTabularFileName(fileNameOrType: string, content: string | ArrayBuffer): boolean {
  const lower = fileNameOrType.trim().toLowerCase();
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".ofx") ||
    lower.endsWith(".qfx") ||
    isSpreadsheetOrHtmlFileName(lower)
  ) {
    return true;
  }
  if (typeof content === "string") {
    return /<OFX[\s>]|<STMTTRN[\s>]|^OFXHEADER\s*:/i.test(content.slice(0, 4096));
  }
  const detected = detectFileKindFromBytes(new Uint8Array(content), lower);
  return detected === "ofx" || detected === "xlsx" || detected === "html_or_xml_sheet";
}

export interface StatementItemPatch {
  date: string;
  cleanDescription: string;
  amountCents: number;
  selectedCategoryId: string;
  installment?: { current: number; total: number };
}

export type LoadedStatementSource =
  | {
      kind: "pdf_text";
      /** Texto reconstruído (ou original) usado no fallback de parsing. */
      text: string;
      /** Texto bruto integral do PDF preservando cabeçalhos, totais e metadados do cartão. */
      rawFullText: string;
      /** Texto separado por página (1-indexed via índice + 1) para seleção cirúrgica na Camada 3B (Vision). */
      pdfPageTexts?: string[];
      /** Total de páginas do PDF para fallback seguro quando fontes CID impedem leitura textual. */
      pdfTotalPages?: number;
      buffer: ArrayBuffer;
      fileName: string;
      sha256: string | null;
      spatialTransactions?: StatementTransaction[];
      checksumGate?: ChecksumGateResult;
      spatialLinesCount?: number;
      discardedMoneyLines?: number;
      spatialRawLines?: string[];
      appliedBlueprintFingerprint?: string;
      appliedBlueprintOrigin?: BlueprintOrigin;
    }
  | {
      kind: "pdf_scanned";
      buffer: ArrayBuffer;
      fileName: string;
      sha256: string | null;
      /** Texto curto eventual (ex.: marca d'água ou PDF híbrido) mantido para degradação graciosa se canvas falhar. */
      fallbackRawText?: string;
      pdfPageTexts?: string[];
      pdfTotalPages?: number;
    }
  | { kind: "image"; file: File; sha256: string | null; fileName: string }
  | { kind: "spreadsheet"; buffer: ArrayBuffer; fileName: string }
  | { kind: "binary_or_text"; content: ArrayBuffer | string; fileName: string };

export interface ReadStatementFileOptions {
  password?: string;
  cardId?: string;
  competenceMonth?: string;
}

export async function readStatementFileContent(
  file: File,
  options?: ReadStatementFileOptions,
): Promise<LoadedStatementSource> {
  const buffer = await file.arrayBuffer();
  const detectedKind = detectFileKindFromBytes(
    new Uint8Array(buffer),
    file.name || file.type,
  );

  if (detectedKind === "image") {
    return {
      kind: "image",
      file,
      sha256: await computeFileSha256(file),
      fileName: file.name,
    };
  }

  if (detectedKind === "pdf") {
    const sha256 = await computeFileSha256(file);

    let fullText = "";
    let pdfPageTexts: string[] = [];
    let pdfTotalPages = 1;
    try {
      const unpdf = await import("unpdf");
      const data =
        options?.password && typeof unpdf.getDocumentProxy === "function"
          ? await unpdf.getDocumentProxy(new Uint8Array(buffer.slice(0)), { password: options.password })
          : new Uint8Array(buffer.slice(0));
      const result = await unpdf.extractText(data, { mergePages: false });
      if (Array.isArray(result.text)) {
        pdfPageTexts = (result.text as string[]).map((p) => String(p ?? ""));
        fullText = pdfPageTexts.join("\n");
      } else if (typeof result.text === "string") {
        pdfPageTexts = [result.text];
        fullText = result.text;
      }
      if (typeof result.totalPages === "number" && result.totalPages > 0) {
        pdfTotalPages = result.totalPages;
      } else {
        pdfTotalPages = Math.max(1, pdfPageTexts.length);
      }
    } catch (err: unknown) {
      if (isPdfPasswordProtectedError(err)) {
        throw new PdfPasswordProtectedError();
      }
    }

    // Item #23 (PDF Híbrido): PDFs escaneados com marca d'água (< 100 chars)
    // ou sem nenhum token monetário extraído devem ser classificados como pdf_scanned para acionar Vision.
    const trimmedFullText = fullText.trim();
    const hasMonetaryToken = /(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/.test(trimmedFullText);
    if (trimmedFullText.length < 100 || !hasMonetaryToken) {
      return {
        kind: "pdf_scanned",
        buffer,
        fileName: file.name,
        sha256,
        pdfPageTexts,
        pdfTotalPages,
        ...(trimmedFullText ? { fallbackRawText: trimmedFullText } : {}),
      };
    }

    // Preserva o texto bruto integral para auditoria de metadados (cabeçalho, banco, vencimento, 4 dígitos)
    const rawFullText = fullText;
    const detectedOfficialTotalCents = extractPrintedStatementTotalCents(rawFullText);

    // Camada 0 + Camada 1: resolve blueprint (user_learned -> ai_learned -> builtin) antes do parser espacial
    const pdfFingerprint = computeStatementFingerprint({
      rawText: rawFullText,
      fileKind: "pdf_text",
      fileName: file.name,
    });
    const matchedBlueprint = findBestStatementBlueprint({
      fingerprint: pdfFingerprint,
      learnedBlueprints: listStoredStatementBlueprints(),
      fileKind: "pdf_text",
    });

    // Tenta reconstrução espacial (X, Y) com as 4 barreiras se parâmetros forem fornecidos
    let spatialTransactions: StatementTransaction[] | undefined;
    let checksumGate: ChecksumGateResult | undefined;
    let spatialLinesCount: number | undefined;
    let discardedMoneyLines: number | undefined;
    let spatialRawLines: string[] | undefined;
    let effectiveText = rawFullText;

    if (options?.cardId && options?.competenceMonth) {
      try {
        const spatialResult = await parseSpatialPdfDocument(buffer, {
          cardId: options.cardId,
          competenceMonth: options.competenceMonth,
          password: options.password,
          officialTotalCents: detectedOfficialTotalCents,
          blueprintHints: matchedBlueprint
            ? toSpatialBlueprintHints(matchedBlueprint.blueprint)
            : undefined,
        });
        spatialLinesCount = spatialResult.lines.length;
        discardedMoneyLines = spatialResult.discardedMoneyLines ?? 0;
        spatialRawLines = spatialResult.lines.map((l) => l.text);

        if (spatialResult.transactions.length > 0) {
          spatialTransactions = spatialResult.transactions;
          checksumGate = spatialResult.checksumGate;
          if (spatialResult.reconstructedText) {
            effectiveText = spatialResult.reconstructedText;
          }
        }
      } catch (err: unknown) {
        if (isPdfPasswordProtectedError(err)) {
          throw new PdfPasswordProtectedError();
        }
        // Fallback gracioso para texto digital padrão caso o parser espacial encontre erro
      }
    }

    return {
      kind: "pdf_text",
      text: effectiveText,
      rawFullText,
      pdfPageTexts,
      pdfTotalPages,
      buffer,
      fileName: file.name,
      sha256,
      spatialTransactions,
      checksumGate,
      spatialLinesCount,
      discardedMoneyLines,
      spatialRawLines,
      appliedBlueprintFingerprint: matchedBlueprint?.blueprint.fingerprint,
      appliedBlueprintOrigin: matchedBlueprint?.blueprint.origin,
    };
  }

  if (
    detectedKind === "xlsx" ||
    detectedKind === "xls_biff8" ||
    detectedKind === "html_or_xml_sheet"
  ) {
    return {
      kind: "spreadsheet",
      buffer,
      fileName: file.name,
    };
  }

  return {
    kind: "binary_or_text",
    content: buffer,
    fileName: file.name,
  };
}

export function shiftCompetenceMonth(competenceMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = competenceMonth.split("-");
  const y = Number.parseInt(yStr ?? "", 10);
  const m = Number.parseInt(mStr ?? "", 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return competenceMonth;
  const total = y * 12 + (m - 1) + deltaMonths;
  const nextY = Math.floor(total / 12);
  const nextM = ((total % 12) + 12) % 12;
  return `${nextY}-${String(nextM + 1).padStart(2, "0")}`;
}

export function isDateNearCardClosingDay(
  dateIso: string,
  closingDay?: number | null,
  windowDays = 5,
): boolean {
  if (!closingDay || closingDay < 1 || closingDay > 31) return false;
  const day = Number.parseInt(dateIso.slice(8, 10), 10);
  if (Number.isNaN(day)) return false;
  const directDiff = Math.abs(day - closingDay);
  const wrapDiff = Math.min(directDiff, 30 - directDiff);
  return wrapDiff <= windowDays;
}

export function mapExpensesForReconciliation(
  expenses: Expense[],
  competenceMonth: string,
): ExistingExpenseForReconciliation[] {
  return expenses
    .filter((e) => e.bill_competence === competenceMonth)
    .map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description ?? "",
      valueCents: numberToCents(e.value),
      categoryId: e.category_id,
      installmentNumber: e.installment_number,
      installmentsTotal: e.installments_total,
      statementHash: e.statement_hash,
      chargeKind: e.charge_kind,
      billCompetence: e.bill_competence ?? undefined,
      installmentGroupId: e.installment_group_id,
    }));
}

export function mapAdjacentExpensesForReconciliation(
  expenses: Expense[],
  competenceMonth: string,
): ExistingExpenseForReconciliation[] {
  const prevMonth = shiftCompetenceMonth(competenceMonth, -1);
  const nextMonth = shiftCompetenceMonth(competenceMonth, 1);
  return expenses
    .filter((e) => e.bill_competence === prevMonth || e.bill_competence === nextMonth)
    .map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description ?? "",
      valueCents: numberToCents(e.value),
      categoryId: e.category_id,
      installmentNumber: e.installment_number,
      installmentsTotal: e.installments_total,
      statementHash: e.statement_hash,
      chargeKind: e.charge_kind,
      billCompetence: e.bill_competence ?? undefined,
      installmentGroupId: e.installment_group_id,
    }));
}

export function createManualReconciliationItem(params: {
  cardId: string;
  competenceMonth: string;
  item: StatementItemPatch;
  index: number;
}): ReconciliationItem {
  const { cardId, competenceMonth, item, index } = params;
  const newHash = generateStatementHash({
    cardId,
    competenceMonth,
    date: item.date,
    amountCents: item.amountCents,
    cleanDescription: item.cleanDescription,
    occurrenceIndex: 0,
  });

  const newTx: StatementTransaction = {
    id: `stmt-manual-${Date.now()}`,
    index,
    occurrenceIndex: 0,
    date: item.date,
    rawDescription: item.cleanDescription,
    cleanDescription: item.cleanDescription,
    amountCents: item.amountCents,
    isRefund: false,
    isPayment: false,
    installment: item.installment,
    statementHash: newHash,
    inferredChargeKind: inferChargeKindFromDescription(item.cleanDescription),
  };

  return {
    transaction: newTx,
    status: "unmatched_new",
    score: 0,
    suggestedCategoryId: item.selectedCategoryId,
    selectedCategoryId: item.selectedCategoryId,
    selected: true,
    ignoredByDefault: false,
  };
}

export function applyEditedReconciliationItem(params: {
  cardId: string;
  competenceMonth: string;
  current: ReconciliationItem;
  updated: StatementItemPatch;
}): ReconciliationItem {
  const { cardId, competenceMonth, current, updated } = params;
  const newHash = generateStatementHash({
    cardId,
    competenceMonth,
    date: updated.date,
    amountCents: updated.amountCents,
    cleanDescription: updated.cleanDescription,
    occurrenceIndex: current.transaction.occurrenceIndex,
  });

  return {
    ...current,
    selected: true,
    selectedCategoryId: updated.selectedCategoryId,
    transaction: {
      ...current.transaction,
      date: updated.date,
      cleanDescription: updated.cleanDescription,
      rawDescription: updated.cleanDescription,
      amountCents: updated.amountCents,
      installment: updated.installment,
      statementHash: newHash,
      inferredChargeKind: inferChargeKindFromDescription(updated.cleanDescription),
    },
  };
}

export interface ChunkedImportExpenseInput {
  date: string;
  value: number;
  category_id: string;
  description: string;
  installments_total: number;
  installment_number: number;
  report_weight: number;
  statement_hash?: string;
  charge_kind?: string;
  scope?: "personal" | "business";
  is_tax_deductible?: boolean;
}

export async function executeChunkedStatementImport(params: {
  cardId: string;
  cardScope?: string | null;
  competenceMonth: string;
  items: ReconciliationItem[];
  fallbackCategoryId: string;
  onProgress: (progress: StatementImportProgress) => void;
  mutateChunk: (input: {
    cardId: string;
    competenceMonth: string;
    expenses: ChunkedImportExpenseInput[];
  }) => Promise<{ inserted_count: number; skipped_count: number }>;
}): Promise<{ totalInserted: number; totalSkipped: number }> {
  const isBusinessCard = params.cardScope === "business";
  const payload: ChunkedImportExpenseInput[] = params.items.map((it) => {
    const itemScope = it.scope ?? (isBusinessCard ? "business" : "personal");
    const isBiz = itemScope === "business";
    const isDeductible = isBiz
      ? (it.isTaxDeductible ?? inferBusinessTaxDeductibility({ description: it.transaction.cleanDescription }).isDeductible)
      : false;

    return {
      date: it.transaction.date,
      value: it.transaction.amountCents / 100,
      category_id: it.selectedCategoryId || params.fallbackCategoryId,
      description: it.transaction.cleanDescription,
      installments_total: it.transaction.installment?.total ?? 1,
      installment_number: it.transaction.installment?.current ?? 1,
      report_weight: 1.0,
      statement_hash: it.transaction.statementHash,
      charge_kind: it.transaction.inferredChargeKind ?? "regular",
      scope: itemScope,
      ...(isBiz && isDeductible ? { is_tax_deductible: true } : {}),
    };
  });

  const chunks = chunkArray(payload, STATEMENT_IMPORT_CHUNK_SIZE);
  const totalItems = payload.length;
  let totalInserted = 0;
  let totalSkipped = 0;
  let processedItems = 0;

  params.onProgress({
    currentChunk: 1,
    totalChunks: chunks.length,
    percent: 0,
    processedItems: 0,
    totalItems,
  });

  for (const [i, chunk] of chunks.entries()) {
    try {
      const result = await params.mutateChunk({
        cardId: params.cardId,
        competenceMonth: params.competenceMonth,
        expenses: chunk,
      });
      totalInserted += result.inserted_count;
      totalSkipped += result.skipped_count;
      processedItems += chunk.length;
      params.onProgress({
        currentChunk: Math.min(i + 2, chunks.length),
        totalChunks: chunks.length,
        percent: Math.round((processedItems / totalItems) * 100),
        processedItems,
        totalItems,
      });
    } catch (err) {
      if (totalInserted > 0) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Importação interrompida no lote ${i + 1} de ${chunks.length}. ${totalInserted} lançamentos foram salvos com sucesso. Detalhe do erro: ${msg}`,
          { cause: err },
        );
      }
      throw err;
    }
  }

  return { totalInserted, totalSkipped };
}

export function runStatementReconciliation(params: {
  transactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  adjacentExpenses?: ExistingExpenseForReconciliation[];
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
  cardScope?: "personal" | "business" | "mixed";
}) {
  return reconcileStatementTransactions({
    statementTransactions: params.transactions,
    existingExpenses: params.existingExpenses,
    adjacentExpenses: params.adjacentExpenses,
    history: params.history,
    defaultCategoryId: params.defaultCategoryId,
    cardScope: params.cardScope,
  });
}

function formatStatementAmountCell(amountCents: number): string {
  const absFormatted = (Math.abs(amountCents) / 100).toFixed(2).replace(".", ",");
  return amountCents < 0 ? `-${absFormatted}` : absFormatted;
}

const CANONICAL_AI_MAPPING: ColumnMapping = {
  dateColIndex: 0,
  descriptionColIndex: 1,
  amountColIndex: 2,
  hasHeader: false,
  startRowIndex: 0,
};

/**
 * Converte linhas extraídas pela IA em `RawParsedRow[]` para alimentar
 * os motores determinísticos `buildTransactionsFromRows` e `reconcileStatementTransactions`.
 */
export function convertAiStatementRowsToRawParsedRows(
  rows: readonly AiStatementPdfRow[],
): RawParsedRow[] {
  return rows.map((row, index) => {
    const hasInstallment =
      typeof row.installmentCurrent === "number" &&
      typeof row.installmentTotal === "number" &&
      row.installmentTotal > 1;
    const alreadyHasInstallmentTag = /\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(row.description);
    const descriptionCell =
      hasInstallment && !alreadyHasInstallmentTag
        ? `${row.description.trim()} ${row.installmentCurrent}/${row.installmentTotal}`
        : row.description.trim();
    const signedCents =
      row.entryType === "refund" || row.entryType === "payment"
        ? -Math.abs(row.amountCents)
        : row.amountCents;
    const amountCell = formatStatementAmountCell(signedCents);

    return {
      rowIndex: index,
      rawText: `${row.date}\t${descriptionCell}\t${amountCell}`,
      cells: [row.date, descriptionCell, amountCell],
    };
  });
}

export function buildTransactionsFromAiRows(
  aiRowsData: readonly AiStatementPdfRow[],
  params: { cardId: string; competenceMonth: string },
): { rows: RawParsedRow[]; transactions: StatementTransaction[]; mapping: ColumnMapping } {
  const rawRows = convertAiStatementRowsToRawParsedRows(aiRowsData);
  const baseTransactions = buildTransactionsFromRows(rawRows, CANONICAL_AI_MAPPING, params);

  const enrichedTransactions = baseTransactions.map((tx, idx) => {
    const sourceRow = aiRowsData[idx];
    if (!sourceRow?.entryType) return tx;

    if (sourceRow.entryType === "payment") {
      return {
        ...tx,
        isPayment: true,
        isRefund: false,
      };
    }

    if (sourceRow.entryType === "refund") {
      return {
        ...tx,
        isRefund: true,
        isPayment: false,
      };
    }

    if (sourceRow.entryType === "charge") {
      const inferred = inferChargeKindFromDescription(sourceRow.description);
      return {
        ...tx,
        isPayment: false,
        isRefund: false,
        inferredChargeKind: inferred === "regular" ? "bank_fee" : inferred,
      };
    }

    return tx;
  });

  return {
    rows: rawRows,
    transactions: enrichedTransactions,
    mapping: CANONICAL_AI_MAPPING,
  };
}

export function detectSpatialCollapseAnomaly(params: {
  allLinesCount: number;
  transactionsCount: number;
  discardedMoneyLines: number;
}): boolean {
  const { allLinesCount, transactionsCount, discardedMoneyLines } = params;
  if (allLinesCount <= 15) return false;
  if (transactionsCount === 0 && discardedMoneyLines >= 1) return true;
  if (transactionsCount <= 2 && discardedMoneyLines >= 3) return true;
  return false;
}

export type StatementExtractionOrigin =
  | "local_verified"
  | "local_learned_blueprint"
  | "local_unverified"
  | "ai_text"
  | "ai_vision";

export interface DraftStatementBlueprintSession {
  blueprint: StatementLayoutBlueprint;
  rawLines: string[];
  officialTotalCents: number | null;
  cycleNetTargetCents: number | null;
  previousBalanceCents: number | null;
  paymentsCents: number | null;
}

function extractTotalCentsWithBlueprintLabels(
  rawLines: readonly string[],
  totalLabels?: readonly string[],
): number | null {
  if (!totalLabels || totalLabels.length === 0) return null;
  const normalizedLabels = totalLabels
    .map((l) =>
      l
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " "),
    )
    .filter((l) => l.length >= 3);
  if (normalizedLabels.length === 0) return null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? "";
    const norm = line
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
    if (!normalizedLabels.some((lbl) => norm.includes(lbl))) continue;

    const moneyMatch =
      /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\s*%)/i.exec(line) ??
      /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\s*%)/i.exec(
        rawLines[i + 1] ?? "",
      );
    if (moneyMatch?.[1]) {
      const parsed = parseAmountToCents(moneyMatch[1]);
      if (parsed && parsed.amountCents > 0) {
        return parsed.amountCents;
      }
    }
  }
  return null;
}

export interface StatementAiStatusNotice {
  kind: "quota_exceeded" | "offline" | "vision_truncated" | "ai_unavailable";
  message: string;
  quotaResetAt?: string;
}

export interface VisionEscalationOffer {
  candidatePages: number[];
  totalPages: number;
  reason: string;
}

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Garante sempre um hash SHA-256 hex válido (64 caracteres minúsculos) para compatibilidade
 * estrita Zero-Deploy com `AiStatementPdfRowsRequestSchema` na Edge Function em produção.
 * Quando `salt` é informado (ex.: `reanalyze:1`), gera um novo SHA-256 determinístico sobre
 * `${baseKey}:${salt}` para contornar cache remoto sem alterar o schema do servidor.
 */
export async function deriveSaltedSha256Hex(
  baseKey: string,
  salt?: string | null,
): Promise<string | null> {
  const trimmedBase = baseKey.trim();
  if (!trimmedBase) return null;
  if (!salt && SHA256_HEX_REGEX.test(trimmedBase)) {
    return trimmedBase.toLowerCase();
  }
  const payload = salt ? `${trimmedBase}:${salt}` : trimmedBase;
  const hashed = await computeTextSha256(payload);
  return hashed && SHA256_HEX_REGEX.test(hashed) ? hashed.toLowerCase() : null;
}

const VISION_CANDIDATE_DATE_REGEX =
  /(?:\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b)/i;
const VISION_CANDIDATE_MONEY_REGEX = /(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/;
const VISION_CANDIDATE_SECTION_REGEX =
  /\b(?:lan[çc]amentos|compras|detalhamento|extrato\s+referente|hist[óo]rico\s+de\s+transa[çc][õo]es|despesas\s+do\s+cart[ãa]o)\b/i;

/**
 * Seleciona até `MAX_STATEMENT_VISION_PAGES_OR_IMAGES` páginas (1-indexed) com sinais
 * de lançamentos/extrato para escalada Vision governada (Camada 3B).
 * Micro-trava: quando fontes CID corrompidas impedirem detectar páginas candidatas (0 candidatas),
 * aplica fallback `[1..Math.min(3, totalPages)]`, respeitando confirmação explícita se > 1 página.
 */
export function selectCandidatePdfVisionPages(
  pageTexts: readonly string[],
  totalPages?: number,
): number[] {
  const effectiveTotal = Math.max(
    1,
    totalPages && totalPages > 0 ? totalPages : pageTexts.length || 1,
  );
  const candidates: number[] = [];

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i] ?? "";
    const hasDate = VISION_CANDIDATE_DATE_REGEX.test(pageText);
    const hasMoney = VISION_CANDIDATE_MONEY_REGEX.test(pageText);
    const hasSection = VISION_CANDIDATE_SECTION_REGEX.test(pageText);
    if ((hasDate && hasMoney) || (hasSection && (hasDate || hasMoney))) {
      candidates.push(i + 1);
      if (candidates.length >= MAX_STATEMENT_VISION_PAGES_OR_IMAGES) {
        break;
      }
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  const fallbackLimit = Math.min(MAX_STATEMENT_VISION_PAGES_OR_IMAGES, effectiveTotal);
  return Array.from({ length: fallbackLimit }, (_, idx) => idx + 1);
}

interface MergedAiMeta {
  detectedCompetenceMonth?: string | null;
  detectedDueDate?: string | null;
  detectedCardLast4?: string | null;
  detectedCardBrandOrBank?: string | null;
  detectedTotalInvoiceCents?: number | null;
}

function mergeAiMetaFields(target: MergedAiMeta, incoming: MergedAiMeta): void {
  if (!target.detectedCompetenceMonth && incoming.detectedCompetenceMonth) {
    target.detectedCompetenceMonth = incoming.detectedCompetenceMonth;
  }
  if (!target.detectedDueDate && incoming.detectedDueDate) {
    target.detectedDueDate = incoming.detectedDueDate;
  }
  if (!target.detectedCardLast4 && incoming.detectedCardLast4) {
    target.detectedCardLast4 = incoming.detectedCardLast4;
  }
  if (!target.detectedCardBrandOrBank && incoming.detectedCardBrandOrBank) {
    target.detectedCardBrandOrBank = incoming.detectedCardBrandOrBank;
  }
  if (
    target.detectedTotalInvoiceCents == null &&
    incoming.detectedTotalInvoiceCents != null
  ) {
    target.detectedTotalInvoiceCents = incoming.detectedTotalInvoiceCents;
  }
}

function hasAnyMergedAiMeta(meta: MergedAiMeta): boolean {
  return Boolean(
    meta.detectedCompetenceMonth ||
      meta.detectedDueDate ||
      meta.detectedCardLast4 ||
      meta.detectedCardBrandOrBank ||
      meta.detectedTotalInvoiceCents != null,
  );
}

function buildAiStatusNoticeFromReason(
  reason: string,
  quotaResetAt?: string,
): StatementAiStatusNotice | undefined {
  if (reason === "quota_exceeded") {
    return {
      kind: "quota_exceeded",
      quotaResetAt,
      message: `Limite de IA atingido. Sua cota renova em ${formatAiQuotaResetHint(quotaResetAt)}.`,
    };
  }
  if (reason === "offline") {
    return {
      kind: "offline",
      message: "Sem conexão no momento. A fatura foi processada apenas localmente.",
    };
  }
  return undefined;
}

/**
 * Desempate estrito por `qualityScore` contábil (Item #7 — substitui `never-degrade` por contagem).
 * Em caso de empate exato de score, prefere a IA apenas se ela passou no gate (ou foi reanálise explícita).
 */
export function shouldPreferAiCandidateByQuality(params: {
  aiTransactionsCount: number;
  aiQuality: StatementQualityGateResult;
  localQuality: StatementQualityGateResult;
  forceAiReanalyze?: boolean;
}): boolean {
  const { aiTransactionsCount, aiQuality, localQuality, forceAiReanalyze } = params;
  if (aiTransactionsCount === 0) return false;
  if (aiQuality.score > localQuality.score) return true;
  if (aiQuality.score === localQuality.score) {
    if (aiQuality.passed && !localQuality.passed) return true;
    if (forceAiReanalyze) return true;
  }
  return false;
}

export interface ParseStatementWithFallbackParams {
  content: string | ArrayBuffer;
  fileNameOrType: string;
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  fileSha256?: string | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  spatialTransactions?: StatementTransaction[];
  checksumGate?: ChecksumGateResult;
  spatialLinesCount?: number;
  discardedMoneyLines?: number;
  spatialRawLines?: string[];
  rawFullText?: string;
  appliedBlueprintFingerprint?: string;
  appliedBlueprintOrigin?: BlueprintOrigin;
  /** Quando true, ignora o curto-circuito determinístico para executar reanálise explícita via IA. */
  forceAiReanalyze?: boolean;
  /** Nonce usado no salt `${baseSha}:reanalyze:${nonce}` para contornar cache remoto (Zero-Deploy). */
  reanalyzeNonce?: number | string;
}

export interface ParsedStatementWithFallbackResult {
  transactions: StatementTransaction[];
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
  usedAiFallback: boolean;
  extractionOrigin?: StatementExtractionOrigin;
  qualityGate?: StatementQualityGateResult;
  aiStatusNotice?: StatementAiStatusNotice;
  appliedBlueprintFingerprint?: string;
  appliedBlueprintOrigin?: BlueprintOrigin;
  /** Rascunho em memória na sessão (NÃO salvo ainda — só persiste no commit após Shadow Replay). */
  draftBlueprint?: DraftStatementBlueprintSession;
  printedTotalCents: number | null;
  detectedMeta?: DetectedStatementMetadata;
  isCacheHit?: boolean;
  mappingConfidence?: number;
  visionTruncationWarning?: string;
}

async function runProactiveTextAiChunks(params: {
  chunks: readonly string[];
  competenceMonth: string;
  fileSha256?: string | null;
  reanalyzeNonce?: number | string;
  saltScope?: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
}): Promise<{
  rows: AiStatementPdfRow[];
  mergedMeta: MergedAiMeta;
  aiStatusNotice?: StatementAiStatusNotice;
  abortedByQuota: boolean;
}> {
  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const collectedRows: AiStatementPdfRow[] = [];
  const mergedMeta: MergedAiMeta = {};
  let aiStatusNotice: StatementAiStatusNotice | undefined;
  let abortedByQuota = false;

  const limitedChunks = params.chunks.slice(0, MAX_STATEMENT_AI_CHUNKS);
  const reanalyzeSalt =
    params.reanalyzeNonce !== undefined && params.reanalyzeNonce !== ""
      ? `reanalyze:${params.reanalyzeNonce}`
      : null;

  for (let idx = 0; idx < limitedChunks.length; idx++) {
    const chunkText = limitedChunks[idx]?.trim() ?? "";
    if (!chunkText) continue;

    const baseKey =
      limitedChunks.length === 1 && params.fileSha256
        ? params.fileSha256
        : `stmt_chunk_${idx}:${params.competenceMonth}:${chunkText}`;
    const fullSalt = [params.saltScope, reanalyzeSalt].filter(Boolean).join(":") || null;
    const chunkSha = await deriveSaltedSha256Hex(baseKey, fullSalt);

    const aiRes = await extractStatementPdfRowsWithAi({
      sha256: chunkSha,
      text: chunkText,
      referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      competenceMonth: params.competenceMonth,
      userId: params.userId,
      isReadOnlyMode: params.isReadOnlyMode,
      featureEnabled: params.aiFallbackEnabled,
    });

    if (!aiRes.ok) {
      aiStatusNotice = buildAiStatusNoticeFromReason(aiRes.reason, aiRes.quotaResetAt);
      if (aiRes.reason === "quota_exceeded") {
        abortedByQuota = true;
      }
      break;
    }

    mergeAiMetaFields(mergedMeta, {
      detectedCompetenceMonth: aiRes.data.detectedCompetenceMonth,
      detectedDueDate: aiRes.data.detectedDueDate,
      detectedCardLast4: aiRes.data.detectedCardLast4,
      detectedCardBrandOrBank: aiRes.data.detectedCardBrandOrBank,
      detectedTotalInvoiceCents: aiRes.data.detectedTotalInvoiceCents,
    });
    collectedRows.push(...aiRes.data.rows);
  }

  return {
    rows: collectedRows,
    mergedMeta,
    aiStatusNotice,
    abortedByQuota,
  };
}

/**
 * Interpreta extratos/faturas priorizando sempre custo zero de IA (Camadas 1 -> 2 -> 3A):
 * 1) Avalia a extração determinística local pelo Quality Gate Contábil Duplo (0 IA);
 * 2) Quando o Quality Gate reprova (em PDF digital, texto colado ou CSV/planilha ambígua)
 *    ou quando o usuário aciona "Reanalisar com IA", executa a Camada 3A com SHA-256 64-hex válido;
 * 3) Desempata estritamente por `qualityScore` contábil e aborta imediatamente em `quota_exceeded`.
 */
export async function parseStatementWithPdfAiFallback(
  params: ParseStatementWithFallbackParams,
): Promise<ParsedStatementWithFallbackResult> {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const canUseAiFallback =
    params.aiFallbackEnabled !== false && !params.isReadOnlyMode && !isOffline;
  const offlineNotice: StatementAiStatusNotice | undefined = isOffline
    ? {
        kind: "offline",
        message: "Sem conexão no momento. A fatura foi processada apenas localmente.",
      }
    : undefined;

  const isCollapseAnomaly = detectSpatialCollapseAnomaly({
    allLinesCount: params.spatialLinesCount ?? 0,
    transactionsCount: params.spatialTransactions?.length ?? 0,
    discardedMoneyLines: params.discardedMoneyLines ?? 0,
  });

  // 0. Prioridade Máxima: Reconstrução Espacial (X, Y) com Quality Gate Contábil Duplo
  const hasSpatialData =
    (params.spatialTransactions && params.spatialTransactions.length > 0) ||
    (isCollapseAnomaly && params.spatialRawLines && params.spatialRawLines.length > 0);

  if (hasSpatialData) {
    const metadataRawText =
      params.rawFullText ||
      (params.spatialRawLines && params.spatialRawLines.length > 0
        ? params.spatialRawLines.join("\n")
        : typeof params.content === "string"
          ? params.content
          : "");
    const summaryAmounts = extractStatementSummaryAmounts(metadataRawText);
    const officialTotalCents =
      params.checksumGate?.officialTotalCents ?? summaryAmounts.invoiceTotalCents;

    let activeTransactions = params.spatialTransactions ?? [];
    let activeChecksumGate = params.checksumGate;
    let usedAi = false;
    let aiStatusNotice: StatementAiStatusNotice | undefined;

    let activeQuality = evaluateStatementExtractionQuality({
      transactions: activeTransactions,
      officialTotalCents,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
      previousBalanceCents: summaryAmounts.previousBalanceCents,
      paymentsCents: summaryAmounts.paymentsCents,
      allLinesCount: params.spatialLinesCount ?? 0,
      discardedMoneyLines: params.discardedMoneyLines ?? 0,
    });

    // Curadoria leve (line_curator) apenas se não for reanálise forçada nem colapso total
    const canRunCurator =
      !params.forceAiReanalyze &&
      !isCollapseAnomaly &&
      !activeQuality.passed &&
      activeTransactions.length > 0 &&
      params.checksumGate &&
      !params.checksumGate.passed &&
      params.checksumGate.officialTotalCents !== null &&
      canUseAiFallback;

    if (canRunCurator && params.checksumGate?.officialTotalCents) {
      try {
        const candidateLines = buildCandidateCuratorLines(activeTransactions);
        const curatorSha = await deriveSaltedSha256Hex(
          params.fileSha256 || candidateLines.map((l) => l.text).join("\n"),
          params.reanalyzeNonce ? `curator:reanalyze:${params.reanalyzeNonce}` : "curator",
        );
        const curatorRes = await curateStatementLinesWithAi({
          sha256: curatorSha ?? undefined,
          lines: candidateLines.map((l) => ({ id: l.id, text: l.text })),
          targetTotalCents: params.checksumGate.officialTotalCents,
          userId: params.userId,
          isReadOnlyMode: params.isReadOnlyMode,
          featureEnabled: params.aiFallbackEnabled,
        });

        if (curatorRes.ok) {
          const curated = curateLinesWithClientValidation({
            candidateLines,
            officialTotalCents: params.checksumGate.officialTotalCents,
            curatorOutput: curatorRes.data,
          });
          const curatedQuality = evaluateStatementExtractionQuality({
            transactions: curated.keptTransactions,
            officialTotalCents,
            cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
            previousBalanceCents: summaryAmounts.previousBalanceCents,
            paymentsCents: summaryAmounts.paymentsCents,
          });
          if (
            shouldPreferAiCandidateByQuality({
              aiTransactionsCount: curated.keptTransactions.length,
              aiQuality: curatedQuality,
              localQuality: activeQuality,
            })
          ) {
            activeTransactions = curated.keptTransactions;
            activeChecksumGate = curated.checksumGate;
            activeQuality = curatedQuality;
            usedAi = true;
          }
        } else {
          aiStatusNotice = buildAiStatusNoticeFromReason(
            curatorRes.reason,
            curatorRes.quotaResetAt,
          );
        }
      } catch {
        // Degrada silenciosamente mantendo transações espaciais originais
      }
    }

    // Camada 3A Proativa para PDF Espacial: se Quality Gate ainda reprova (ou colapso / reanálise),
    // aciona statement_pdf_rows (desde que não tenha sido abortado por quota_exceeded)
    const needsSpatialAiRescue =
      (params.forceAiReanalyze || isCollapseAnomaly || !activeQuality.passed) &&
      aiStatusNotice?.kind !== "quota_exceeded";

    if (needsSpatialAiRescue) {
      if (!canUseAiFallback) {
        if (!aiStatusNotice && offlineNotice) {
          aiStatusNotice = offlineNotice;
        }
      } else {
        const sanitizedSpatialText =
          params.spatialRawLines && params.spatialRawLines.length > 0
            ? params.spatialRawLines
                .map((l) => maskSensitivePiiForAi(l))
                .filter((l) => l.trim().length > 0)
                .join("\n")
            : maskSensitivePiiForAi(metadataRawText).trim();

        if (sanitizedSpatialText.length > 0) {
          const pre = preprocessStatementTextForAi(sanitizedSpatialText);
          const chunks =
            pre.chunks.length > 0
              ? pre.chunks
              : [pre.compactedText || sanitizedSpatialText];
          const aiRun = await runProactiveTextAiChunks({
            chunks,
            competenceMonth: params.competenceMonth,
            fileSha256: params.fileSha256,
            reanalyzeNonce: params.reanalyzeNonce,
            saltScope: isCollapseAnomaly ? "collapse-rescue" : "spatial-rescue",
            userId: params.userId,
            isReadOnlyMode: params.isReadOnlyMode,
            aiFallbackEnabled: params.aiFallbackEnabled,
          });

          if (aiRun.aiStatusNotice) {
            aiStatusNotice = aiRun.aiStatusNotice;
          }

          if (aiRun.rows.length > 0) {
            const built = buildTransactionsFromAiRows(aiRun.rows, {
              cardId: params.cardId,
              competenceMonth: params.competenceMonth,
            });
            const aiOfficialTotal =
              aiRun.mergedMeta.detectedTotalInvoiceCents ?? officialTotalCents;
            const aiQuality = evaluateStatementExtractionQuality({
              transactions: built.transactions,
              officialTotalCents: aiOfficialTotal,
              cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
              previousBalanceCents: summaryAmounts.previousBalanceCents,
              paymentsCents: summaryAmounts.paymentsCents,
            });

            if (
              shouldPreferAiCandidateByQuality({
                aiTransactionsCount: built.transactions.length,
                aiQuality,
                localQuality: activeQuality,
                forceAiReanalyze: params.forceAiReanalyze,
              })
            ) {
              // Se um blueprint aprendido estava ativo e reprovou, registra falha para self-healing
              if (
                params.appliedBlueprintFingerprint &&
                params.appliedBlueprintOrigin &&
                params.appliedBlueprintOrigin !== "builtin"
              ) {
                recordBlueprintFailure(params.appliedBlueprintFingerprint);
              }

              const learningLines =
                params.spatialRawLines && params.spatialRawLines.length > 0
                  ? params.spatialRawLines
                  : metadataRawText.split(/\r?\n/);
              const distilled = distillStatementBlueprintDraft({
                rawText: metadataRawText,
                rawLines: learningLines,
                extractedTransactions: built.transactions,
                fileKind: "pdf_text",
                fileName: params.fileNameOrType,
                extractionSource: "ai_text",
                officialTotalCents: aiOfficialTotal,
                cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
              });

              const detectedMeta = detectStatementMetadata({
                rawText: metadataRawText,
                transactions: built.transactions,
                activeCompetenceMonth: params.competenceMonth,
                card: params.card,
                printedTotalCents: aiOfficialTotal,
                aiDetectedMeta: hasAnyMergedAiMeta(aiRun.mergedMeta)
                  ? aiRun.mergedMeta
                  : null,
              });
              return {
                transactions: built.transactions,
                rows: built.rows,
                mapping: built.mapping,
                isOfx: false,
                usedAiFallback: true,
                extractionOrigin: "ai_text",
                qualityGate: aiQuality,
                aiStatusNotice,
                ...(distilled.blueprint
                  ? {
                      draftBlueprint: {
                        blueprint: distilled.blueprint,
                        rawLines: learningLines,
                        officialTotalCents: aiOfficialTotal,
                        cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
                        previousBalanceCents: summaryAmounts.previousBalanceCents,
                        paymentsCents: summaryAmounts.paymentsCents,
                      },
                    }
                  : {}),
                printedTotalCents: aiOfficialTotal,
                detectedMeta,
                isCacheHit: true,
                mappingConfidence: 100,
              };
            }
          }
        }
      }
    }

    if (activeTransactions.length > 0) {
      const isLearnedBlueprintApplied =
        Boolean(params.appliedBlueprintFingerprint) &&
        (params.appliedBlueprintOrigin === "user_learned" ||
          params.appliedBlueprintOrigin === "ai_learned");

      if (isLearnedBlueprintApplied && !usedAi) {
        if (activeQuality.passed) {
          recordBlueprintSuccess(
            params.appliedBlueprintFingerprint!,
            activeQuality.diffCents <= 5,
          );
        } else {
          recordBlueprintFailure(params.appliedBlueprintFingerprint!);
        }
      }

      const finalOfficialTotal = activeChecksumGate?.officialTotalCents ?? officialTotalCents;
      const detectedMeta = detectStatementMetadata({
        rawText: metadataRawText,
        transactions: activeTransactions,
        activeCompetenceMonth: params.competenceMonth,
        card: params.card,
        printedTotalCents: finalOfficialTotal,
      });
      return {
        transactions: activeTransactions,
        rows: [],
        mapping: {
          dateColIndex: 0,
          descriptionColIndex: 1,
          amountColIndex: 2,
          hasHeader: false,
          startRowIndex: 0,
        },
        isOfx: false,
        usedAiFallback: usedAi,
        extractionOrigin: usedAi
          ? "ai_text"
          : activeQuality.passed
            ? isLearnedBlueprintApplied
              ? "local_learned_blueprint"
              : "local_verified"
            : "local_unverified",
        qualityGate: activeQuality,
        aiStatusNotice,
        appliedBlueprintFingerprint: params.appliedBlueprintFingerprint,
        appliedBlueprintOrigin: params.appliedBlueprintOrigin,
        printedTotalCents: finalOfficialTotal,
        detectedMeta,
        isCacheHit: true,
        mappingConfidence: 100,
      };
    }
  }

  const lowerName = params.fileNameOrType.trim().toLowerCase();
  const contentDetectedKind =
    typeof params.content !== "string"
      ? detectFileKindFromBytes(new Uint8Array(params.content), lowerName)
      : null;

  // 1. Planilhas Excel (.xlsx, .xls) e tabelas HTML — 0 IA quando Gate aprova; Camada 3A se ambíguas
  if (
    isSpreadsheetOrHtmlFileName(lowerName) ||
    contentDetectedKind === "xlsx" ||
    contentDetectedKind === "xls_biff8" ||
    contentDetectedKind === "html_or_xml_sheet"
  ) {
    const sheetRows = await parseSpreadsheetOrHtmlToRows(params.content);
    const sniffedMapping = sniffColumnMapping(sheetRows);
    const headerCells = extractHeaderCellsForCache(sheetRows, sniffedMapping);
    const cached = headerCells.length > 0 ? getCachedColumnMapping(headerCells, sheetRows) : null;
    const isCacheHit = Boolean(cached);
    const mapping = cached ?? sniffedMapping;
    if (!cached && mapping.hasHeader && headerCells.length > 0) {
      setCachedColumnMapping(headerCells, mapping);
    }
    const mappingConfidence = evaluateMappingConfidence({
      rows: sheetRows,
      mapping,
      isCacheHit,
    });
    const transactions = buildTransactionsFromRows(sheetRows, mapping, {
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
    });
    const sheetText = sheetRows.map((r) => r.rawText).join("\n");
    const summaryAmounts = extractStatementSummaryAmounts(sheetText);
    const localQuality = evaluateStatementExtractionQuality({
      transactions,
      officialTotalCents: summaryAmounts.invoiceTotalCents,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
      previousBalanceCents: summaryAmounts.previousBalanceCents,
      paymentsCents: summaryAmounts.paymentsCents,
      mappingConfidence,
      columnMapping: mapping,
    });

    const isAmbiguousSheet =
      params.forceAiReanalyze ||
      !localQuality.passed &&
        (transactions.length === 0 ||
          localQuality.reasons.includes("degraded_descriptions") ||
          localQuality.reasons.includes("checksum_overflow") ||
          mappingConfidence < 60);

    let aiStatusNotice: StatementAiStatusNotice | undefined;
    if (isAmbiguousSheet && sheetText.trim()) {
      if (!canUseAiFallback) {
        aiStatusNotice = offlineNotice;
      } else {
        const pre = preprocessStatementTextForAi(sheetText);
        const chunks = pre.chunks.length > 0 ? pre.chunks : [pre.compactedText || sheetText];
        const aiRun = await runProactiveTextAiChunks({
          chunks,
          competenceMonth: params.competenceMonth,
          fileSha256: params.fileSha256,
          reanalyzeNonce: params.reanalyzeNonce,
          saltScope: "sheet",
          userId: params.userId,
          isReadOnlyMode: params.isReadOnlyMode,
          aiFallbackEnabled: params.aiFallbackEnabled,
        });
        aiStatusNotice = aiRun.aiStatusNotice;

        if (aiRun.rows.length > 0) {
          const built = buildTransactionsFromAiRows(aiRun.rows, {
            cardId: params.cardId,
            competenceMonth: params.competenceMonth,
          });
          const aiOfficialTotal =
            aiRun.mergedMeta.detectedTotalInvoiceCents ?? summaryAmounts.invoiceTotalCents;
          const aiQuality = evaluateStatementExtractionQuality({
            transactions: built.transactions,
            officialTotalCents: aiOfficialTotal,
            cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
            previousBalanceCents: summaryAmounts.previousBalanceCents,
            paymentsCents: summaryAmounts.paymentsCents,
          });
          if (
            shouldPreferAiCandidateByQuality({
              aiTransactionsCount: built.transactions.length,
              aiQuality,
              localQuality,
              forceAiReanalyze: params.forceAiReanalyze,
            })
          ) {
            const detectedMeta = detectStatementMetadata({
              rawText: sheetRows.slice(0, 15).map((r) => r.rawText).join("\n"),
              transactions: built.transactions,
              activeCompetenceMonth: params.competenceMonth,
              card: params.card,
              printedTotalCents: aiOfficialTotal,
              aiDetectedMeta: hasAnyMergedAiMeta(aiRun.mergedMeta)
                ? aiRun.mergedMeta
                : null,
            });
            return {
              transactions: built.transactions,
              rows: built.rows,
              mapping: built.mapping,
              isOfx: false,
              usedAiFallback: true,
              extractionOrigin: "ai_text",
              qualityGate: aiQuality,
              aiStatusNotice,
              printedTotalCents: aiOfficialTotal,
              detectedMeta,
              isCacheHit: false,
              mappingConfidence: 100,
            };
          }
        }
      }
    }

    const detectedMeta = detectStatementMetadata({
      rawText: sheetRows.slice(0, 15).map((r) => r.rawText).join("\n"),
      transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
    });
    return {
      transactions,
      rows: sheetRows,
      mapping,
      isOfx: false,
      usedAiFallback: false,
      extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: localQuality,
      aiStatusNotice,
      printedTotalCents: summaryAmounts.invoiceTotalCents,
      detectedMeta,
      isCacheHit,
      mappingConfidence,
    };
  }

  // 2. Parser determinístico local (OFX, CSV, TSV, PDF digital ou texto livre)
  const deterministic = parseStatementInput(params.content, params.fileNameOrType, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  const textContent =
    typeof params.content === "string"
      ? params.content
      : new TextDecoder("utf-8", { fatal: false }).decode(params.content);
  const metadataRawText = params.rawFullText || textContent;

  if (deterministic.isOfx) {
    const ofxMeta = extractOfxMetadata(textContent);
    const enrichedOfxText = [
      ofxMeta.org ? `Emissor: ${ofxMeta.org}` : "",
      ofxMeta.acctLast4 ? `Cartão final ${ofxMeta.acctLast4}` : "",
      textContent,
    ]
      .filter(Boolean)
      .join("\n");
    const ofxQuality = evaluateStatementExtractionQuality({
      transactions: deterministic.transactions,
      officialTotalCents: ofxMeta.ledgerBalanceCents,
      isOfx: true,
    });
    const detectedMeta = detectStatementMetadata({
      rawText: enrichedOfxText,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: ofxMeta.ledgerBalanceCents,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: ofxQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: ofxQuality,
      printedTotalCents: ofxMeta.ledgerBalanceCents,
      detectedMeta,
      isCacheHit: true,
      mappingConfidence: 100,
    };
  }

  const structuredTabular = isStructuredTabularFileName(params.fileNameOrType, params.content);
  if (structuredTabular) {
    const headerCells = extractHeaderCellsForCache(deterministic.rows, deterministic.mapping);
    const cached =
      headerCells.length > 0
        ? getCachedColumnMapping(headerCells, deterministic.rows)
        : null;
    const isCacheHit = Boolean(cached);
    const mapping = cached ?? deterministic.mapping;
    if (!cached && mapping.hasHeader && headerCells.length > 0) {
      setCachedColumnMapping(headerCells, mapping);
    }
    const mappingConfidence = evaluateMappingConfidence({
      rows: deterministic.rows,
      mapping,
      isCacheHit,
    });
    const transactions =
      mapping !== deterministic.mapping
        ? buildTransactionsFromRows(deterministic.rows, mapping, {
            cardId: params.cardId,
            competenceMonth: params.competenceMonth,
          })
        : deterministic.transactions;

    const summaryAmounts = extractStatementSummaryAmounts(textContent);
    const localQuality = evaluateStatementExtractionQuality({
      transactions,
      officialTotalCents: summaryAmounts.invoiceTotalCents,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
      previousBalanceCents: summaryAmounts.previousBalanceCents,
      paymentsCents: summaryAmounts.paymentsCents,
      mappingConfidence,
      columnMapping: mapping,
    });

    const isAmbiguousCsv =
      params.forceAiReanalyze ||
      (!localQuality.passed &&
        (transactions.length === 0 ||
          localQuality.reasons.includes("degraded_descriptions") ||
          localQuality.reasons.includes("checksum_overflow") ||
          mappingConfidence < 60));

    let aiStatusNotice: StatementAiStatusNotice | undefined;
    if (isAmbiguousCsv && textContent.trim()) {
      if (!canUseAiFallback) {
        aiStatusNotice = offlineNotice;
      } else {
        const pre = preprocessStatementTextForAi(textContent);
        const chunks = pre.chunks.length > 0 ? pre.chunks : [pre.compactedText || textContent];
        const aiRun = await runProactiveTextAiChunks({
          chunks,
          competenceMonth: params.competenceMonth,
          fileSha256: params.fileSha256,
          reanalyzeNonce: params.reanalyzeNonce,
          saltScope: "csv",
          userId: params.userId,
          isReadOnlyMode: params.isReadOnlyMode,
          aiFallbackEnabled: params.aiFallbackEnabled,
        });
        aiStatusNotice = aiRun.aiStatusNotice;

        if (aiRun.rows.length > 0) {
          const built = buildTransactionsFromAiRows(aiRun.rows, {
            cardId: params.cardId,
            competenceMonth: params.competenceMonth,
          });
          const aiOfficialTotal =
            aiRun.mergedMeta.detectedTotalInvoiceCents ?? summaryAmounts.invoiceTotalCents;
          const aiQuality = evaluateStatementExtractionQuality({
            transactions: built.transactions,
            officialTotalCents: aiOfficialTotal,
            cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
            previousBalanceCents: summaryAmounts.previousBalanceCents,
            paymentsCents: summaryAmounts.paymentsCents,
          });
          if (
            shouldPreferAiCandidateByQuality({
              aiTransactionsCount: built.transactions.length,
              aiQuality,
              localQuality,
              forceAiReanalyze: params.forceAiReanalyze,
            })
          ) {
            const detectedMeta = detectStatementMetadata({
              rawText: textContent,
              transactions: built.transactions,
              activeCompetenceMonth: params.competenceMonth,
              card: params.card,
              printedTotalCents: aiOfficialTotal,
              aiDetectedMeta: hasAnyMergedAiMeta(aiRun.mergedMeta)
                ? aiRun.mergedMeta
                : null,
            });
            return {
              ...deterministic,
              transactions: built.transactions,
              rows: built.rows,
              mapping: built.mapping,
              usedAiFallback: true,
              extractionOrigin: "ai_text",
              qualityGate: aiQuality,
              aiStatusNotice,
              printedTotalCents: aiOfficialTotal,
              detectedMeta,
              isCacheHit: false,
              mappingConfidence: 100,
            };
          }
        }
      }
    }

    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
    });
    return {
      ...deterministic,
      transactions,
      mapping,
      usedAiFallback: false,
      extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: localQuality,
      aiStatusNotice,
      printedTotalCents: summaryAmounts.invoiceTotalCents,
      detectedMeta,
      isCacheHit,
      mappingConfidence,
    };
  }

  const preprocessed = preprocessStatementTextForAi(textContent);
  const summaryAmounts = extractStatementSummaryAmounts(metadataRawText);
  const officialTotalForGate =
    summaryAmounts.invoiceTotalCents ?? preprocessed.printedTotalCents;

  // Camada 1 — Motor Determinístico Guiado por Blueprints (user_learned -> ai_learned -> builtin · 0 tokens)
  const textBlueprintKind: BlueprintFileKind = lowerName.endsWith(".pdf") ? "pdf_text" : "text";
  const rawLinesForBlueprint = metadataRawText.split(/\r?\n/);
  const textFingerprint = computeStatementFingerprint({
    rawText: metadataRawText,
    fileKind: textBlueprintKind,
    fileName: params.fileNameOrType,
    headerLines: rawLinesForBlueprint,
  });
  const matchedTextBlueprint = findBestStatementBlueprint({
    fingerprint: textFingerprint,
    learnedBlueprints: listStoredStatementBlueprints(),
    fileKind: textBlueprintKind,
  });

  if (
    !params.forceAiReanalyze &&
    matchedTextBlueprint &&
    matchedTextBlueprint.blueprint.pdfRules
  ) {
    const bp = matchedTextBlueprint.blueprint;
    const bpOfficialTotal =
      officialTotalForGate ??
      extractTotalCentsWithBlueprintLabels(rawLinesForBlueprint, bp.pdfRules?.totalLabels);
    const spatialLines = buildSpatialLinesFromRawLines(rawLinesForBlueprint);
    const bpExtracted = extractTransactionsFromSpatialLines(spatialLines, {
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      blueprintHints: toSpatialBlueprintHints(bp),
    });

    const bpQuality = evaluateStatementExtractionQuality({
      transactions: bpExtracted.transactions,
      officialTotalCents: bpOfficialTotal,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
      previousBalanceCents: summaryAmounts.previousBalanceCents,
      paymentsCents: summaryAmounts.paymentsCents,
      allLinesCount: spatialLines.length,
      discardedMoneyLines: bpExtracted.discardedMoneyLines,
    });

    if (bpExtracted.transactions.length > 0 && bpQuality.passed) {
      const isLearnedBp = bp.origin === "user_learned" || bp.origin === "ai_learned";
      if (isLearnedBp) {
        recordBlueprintSuccess(bp.fingerprint, bpQuality.diffCents <= 5);
      }
      const detectedMeta = detectStatementMetadata({
        rawText: metadataRawText,
        transactions: bpExtracted.transactions,
        activeCompetenceMonth: params.competenceMonth,
        card: params.card,
        printedTotalCents: bpOfficialTotal,
      });
      return {
        transactions: bpExtracted.transactions,
        rows: [],
        mapping: CANONICAL_AI_MAPPING,
        isOfx: false,
        usedAiFallback: false,
        extractionOrigin: isLearnedBp ? "local_learned_blueprint" : "local_verified",
        qualityGate: bpQuality,
        appliedBlueprintFingerprint: bp.fingerprint,
        appliedBlueprintOrigin: bp.origin,
        printedTotalCents: bpOfficialTotal,
        detectedMeta,
        isCacheHit: true,
        mappingConfidence: 100,
      };
    }

    if (bp.origin === "user_learned" || bp.origin === "ai_learned") {
      recordBlueprintFailure(bp.fingerprint);
    }
  }

  const quality = evaluateDeterministicStatementQuality({
    rawText: textContent,
    transactions: deterministic.transactions,
    candidateAmountLineCount: preprocessed.candidateAmountLineCount,
    printedTotalCents: officialTotalForGate,
    isStructuredTabularFile: false,
  });

  const localMappingConfidence = evaluateMappingConfidence({
    rows: deterministic.rows,
    mapping: deterministic.mapping,
  });

  const localQuality = evaluateStatementExtractionQuality({
    transactions: deterministic.transactions,
    officialTotalCents: officialTotalForGate,
    cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
    previousBalanceCents: summaryAmounts.previousBalanceCents,
    paymentsCents: summaryAmounts.paymentsCents,
    mappingConfidence:
      deterministic.rows.length > 0 ? localMappingConfidence : undefined,
    columnMapping: deterministic.rows.length > 0 ? deterministic.mapping : null,
  });

  if (!params.forceAiReanalyze && quality.isSufficient && localQuality.passed) {
    const detectedMeta = detectStatementMetadata({
      rawText: metadataRawText,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: officialTotalForGate,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: "local_verified",
      qualityGate: localQuality,
      printedTotalCents: officialTotalForGate,
      detectedMeta,
      mappingConfidence: localMappingConfidence,
    };
  }

  // 3. Camada 3A Proativa (texto podado localmente com SHA-256 64-hex válido e desempate contábil)
  if (!textContent.trim() || !canUseAiFallback) {
    const detectedMeta = detectStatementMetadata({
      rawText: metadataRawText,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: officialTotalForGate,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: localQuality,
      aiStatusNotice: offlineNotice,
      printedTotalCents: officialTotalForGate,
      detectedMeta,
      mappingConfidence: localMappingConfidence,
    };
  }

  const chunksToSend = (
    preprocessed.chunks.length > 0 ? preprocessed.chunks : [preprocessed.compactedText]
  ).slice(0, MAX_STATEMENT_AI_CHUNKS);

  const aiRun = await runProactiveTextAiChunks({
    chunks: chunksToSend,
    competenceMonth: params.competenceMonth,
    fileSha256: params.fileSha256,
    reanalyzeNonce: params.reanalyzeNonce,
    userId: params.userId,
    isReadOnlyMode: params.isReadOnlyMode,
    aiFallbackEnabled: params.aiFallbackEnabled,
  });

  const aiMetaOrNull = hasAnyMergedAiMeta(aiRun.mergedMeta) ? aiRun.mergedMeta : null;

  if (aiRun.rows.length === 0) {
    const detectedMeta = detectStatementMetadata({
      rawText: metadataRawText,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: officialTotalForGate,
      aiDetectedMeta: aiMetaOrNull,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: localQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: localQuality,
      aiStatusNotice: aiRun.aiStatusNotice,
      printedTotalCents: officialTotalForGate,
      detectedMeta,
      mappingConfidence: localMappingConfidence,
    };
  }

  const built = buildTransactionsFromAiRows(aiRun.rows, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  const finalPrintedTotal =
    aiRun.mergedMeta.detectedTotalInvoiceCents ?? officialTotalForGate;

  const aiQuality = evaluateStatementExtractionQuality({
    transactions: built.transactions,
    officialTotalCents: finalPrintedTotal,
    cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
    previousBalanceCents: summaryAmounts.previousBalanceCents,
    paymentsCents: summaryAmounts.paymentsCents,
  });

  // Item #7: desempate estritamente por qualityScore contábil (fim do never-degrade por contagem)
  const localQualityWithTarget = evaluateStatementExtractionQuality({
    transactions: deterministic.transactions,
    officialTotalCents: finalPrintedTotal,
    cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
    previousBalanceCents: summaryAmounts.previousBalanceCents,
    paymentsCents: summaryAmounts.paymentsCents,
    mappingConfidence:
      deterministic.rows.length > 0 ? localMappingConfidence : undefined,
    columnMapping: deterministic.rows.length > 0 ? deterministic.mapping : null,
  });

  if (
    !shouldPreferAiCandidateByQuality({
      aiTransactionsCount: built.transactions.length,
      aiQuality,
      localQuality: localQualityWithTarget,
      forceAiReanalyze: params.forceAiReanalyze,
    })
  ) {
    const detectedMeta = detectStatementMetadata({
      rawText: metadataRawText,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: finalPrintedTotal,
      aiDetectedMeta: aiMetaOrNull,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      extractionOrigin: localQualityWithTarget.passed
        ? "local_verified"
        : "local_unverified",
      qualityGate: localQualityWithTarget,
      aiStatusNotice: aiRun.aiStatusNotice,
      printedTotalCents: finalPrintedTotal,
      detectedMeta,
      mappingConfidence: localMappingConfidence,
    };
  }

  const distilledTextDraft = distillStatementBlueprintDraft({
    rawText: metadataRawText,
    rawLines: rawLinesForBlueprint,
    extractedTransactions: built.transactions,
    fileKind: textBlueprintKind,
    fileName: params.fileNameOrType,
    extractionSource: "ai_text",
    officialTotalCents: finalPrintedTotal,
    cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
  });

  const detectedMeta = detectStatementMetadata({
    rawText: metadataRawText,
    transactions: built.transactions,
    activeCompetenceMonth: params.competenceMonth,
    card: params.card,
    printedTotalCents: finalPrintedTotal,
    aiDetectedMeta: aiMetaOrNull,
  });

  return {
    transactions: built.transactions,
    rows: built.rows,
    mapping: built.mapping,
    isOfx: false,
    usedAiFallback: true,
    extractionOrigin: "ai_text",
    qualityGate: aiQuality,
    aiStatusNotice: aiRun.aiStatusNotice,
    ...(distilledTextDraft.blueprint
      ? {
          draftBlueprint: {
            blueprint: distilledTextDraft.blueprint,
            rawLines: rawLinesForBlueprint,
            officialTotalCents: finalPrintedTotal,
            cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
            previousBalanceCents: summaryAmounts.previousBalanceCents,
            paymentsCents: summaryAmounts.paymentsCents,
          },
        }
      : {}),
    printedTotalCents: finalPrintedTotal,
    detectedMeta,
    isCacheHit: false,
    mappingConfidence: 100,
  };
}

function buildVisionRowDedupKey(row: AiStatementPdfRow): string {
  const normalizedDesc = row.description
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return `${row.date.trim()}|${row.amountCents}|${normalizedDesc}`;
}

/**
 * Remove linhas duplicadas na fronteira de rolagem (overlap de scroll) entre prints consecutivos
 * `N` e `N+1` comparando `(date, amountCents, normalizedDesc)`, preservando compras genuinamente
 * repetidas dentro do mesmo print.
 */
export function deduplicateConsecutiveVisionRows(
  pagesRows: readonly (readonly AiStatementPdfRow[])[],
): AiStatementPdfRow[] {
  const merged: AiStatementPdfRow[] = [];

  for (const page of pagesRows) {
    if (page.length === 0) continue;
    if (merged.length === 0) {
      merged.push(...page);
      continue;
    }

    const maxOverlap = Math.min(merged.length, page.length, 6);
    let overlapLen = 0;

    for (let k = maxOverlap; k >= 1; k--) {
      let allMatch = true;
      for (let i = 0; i < k; i++) {
        const prevRow = merged[merged.length - k + i]!;
        const nextRow = page[i]!;
        if (buildVisionRowDedupKey(prevRow) !== buildVisionRowDedupKey(nextRow)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        overlapLen = k;
        break;
      }
    }

    merged.push(...page.slice(overlapLen));
  }

  return merged;
}

/**
 * Extrai lançamentos via IA Vision a partir de prints de fatura (até 3 imagens)
 * ou páginas renderizadas de PDF escaneado sem camada de texto digital.
 */
export async function parseStatementVisionBlobsWithAi(params: {
  blobs: readonly { blob: Blob; sha256?: string | null }[];
  totalUploadedCount?: number;
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
  reanalyzeNonce?: number | string;
  officialTotalCents?: number | null;
  rawTextForLearning?: string;
  rawLinesForLearning?: readonly string[];
  fileName?: string;
}): Promise<ParsedStatementWithFallbackResult> {
  const effectiveTotalImages = Math.max(params.blobs.length, params.totalUploadedCount ?? 0);
  const visionTruncationWarning =
    effectiveTotalImages > MAX_STATEMENT_VISION_PAGES_OR_IMAGES
      ? `Foram enviadas ${effectiveTotalImages} imagens, mas o limite por lote é de ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES}. Apenas as primeiras ${MAX_STATEMENT_VISION_PAGES_OR_IMAGES} foram analisadas.`
      : undefined;

  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const baseStatusNotice: StatementAiStatusNotice | undefined = isOffline
    ? {
        kind: "offline",
        message: "Sem conexão no momento. A leitura visual por IA requer acesso à internet.",
      }
    : visionTruncationWarning
      ? {
          kind: "vision_truncated",
          message: visionTruncationWarning,
        }
      : undefined;

  const emptyResult: ParsedStatementWithFallbackResult = {
    transactions: [],
    rows: [],
    mapping: CANONICAL_AI_MAPPING,
    isOfx: false,
    usedAiFallback: false,
    extractionOrigin: "local_unverified",
    printedTotalCents: null,
    ...(baseStatusNotice ? { aiStatusNotice: baseStatusNotice } : {}),
    ...(visionTruncationWarning ? { visionTruncationWarning } : {}),
  };

  if (
    params.blobs.length === 0 ||
    params.aiFallbackEnabled === false ||
    params.isReadOnlyMode ||
    isOffline
  ) {
    return emptyResult;
  }

  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const limited = params.blobs.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
  const pagesRows: AiStatementPdfRow[][] = [];
  const mergedAiMeta: MergedAiMeta = {};
  let aiStatusNotice: StatementAiStatusNotice | undefined = visionTruncationWarning
    ? { kind: "vision_truncated", message: visionTruncationWarning }
    : undefined;

  const reanalyzeSalt =
    params.reanalyzeNonce !== undefined && params.reanalyzeNonce !== ""
      ? `reanalyze:${params.reanalyzeNonce}`
      : null;

  for (let idx = 0; idx < limited.length; idx++) {
    const entry = limited[idx]!;
    const resolvedSha = reanalyzeSalt
      ? await deriveSaltedSha256Hex(
          entry.sha256 || `vision_${idx}_${params.competenceMonth}`,
          reanalyzeSalt,
        )
      : entry.sha256
        ? await deriveSaltedSha256Hex(entry.sha256)
        : undefined;

    const aiRes = await extractStatementPdfRowsWithAi({
      sha256: resolvedSha,
      imageBlob: entry.blob,
      referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      competenceMonth: params.competenceMonth,
      userId: params.userId,
      isReadOnlyMode: params.isReadOnlyMode,
      featureEnabled: params.aiFallbackEnabled,
    });

    if (!aiRes.ok) {
      const reasonNotice = buildAiStatusNoticeFromReason(aiRes.reason, aiRes.quotaResetAt);
      if (reasonNotice) {
        aiStatusNotice = reasonNotice;
      }
      if (aiRes.reason === "quota_exceeded" || aiRes.reason === "offline") {
        break;
      }
      continue;
    }

    mergeAiMetaFields(mergedAiMeta, {
      detectedCompetenceMonth: aiRes.data.detectedCompetenceMonth,
      detectedDueDate: aiRes.data.detectedDueDate,
      detectedCardLast4: aiRes.data.detectedCardLast4,
      detectedCardBrandOrBank: aiRes.data.detectedCardBrandOrBank,
      detectedTotalInvoiceCents: aiRes.data.detectedTotalInvoiceCents,
    });

    if (aiRes.data.rows.length > 0) {
      pagesRows.push(aiRes.data.rows);
    }
  }

  const collectedRows = deduplicateConsecutiveVisionRows(pagesRows);

  if (collectedRows.length === 0) {
    return {
      ...emptyResult,
      ...(aiStatusNotice ? { aiStatusNotice } : {}),
    };
  }

  const built = buildTransactionsFromAiRows(collectedRows, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  if (built.transactions.length === 0) {
    return {
      ...emptyResult,
      ...(aiStatusNotice ? { aiStatusNotice } : {}),
    };
  }

  const finalOfficialTotal =
    mergedAiMeta.detectedTotalInvoiceCents ?? params.officialTotalCents ?? null;
  const visionQuality = evaluateStatementExtractionQuality({
    transactions: built.transactions,
    officialTotalCents: finalOfficialTotal,
  });

  const detectedMeta = detectStatementMetadata({
    rawText: "",
    transactions: built.transactions,
    activeCompetenceMonth: params.competenceMonth,
    card: params.card,
    printedTotalCents: finalOfficialTotal,
    aiDetectedMeta: hasAnyMergedAiMeta(mergedAiMeta) ? mergedAiMeta : null,
  });

  const visionLearningLines = params.rawLinesForLearning
    ? [...params.rawLinesForLearning]
    : params.rawTextForLearning
      ? params.rawTextForLearning.split(/\r?\n/)
      : [];
  const visionDraft =
    visionLearningLines.length > 0
      ? distillStatementBlueprintDraft({
          rawText: params.rawTextForLearning ?? visionLearningLines.join("\n"),
          rawLines: visionLearningLines,
          extractedTransactions: built.transactions,
          fileKind: "pdf_text",
          fileName: params.fileName,
          extractionSource: "ai_vision",
          officialTotalCents: finalOfficialTotal,
        })
      : null;

  return {
    transactions: built.transactions,
    rows: built.rows,
    mapping: built.mapping,
    isOfx: false,
    usedAiFallback: true,
    extractionOrigin: "ai_vision",
    qualityGate: visionQuality,
    ...(visionDraft?.blueprint
      ? {
          draftBlueprint: {
            blueprint: visionDraft.blueprint,
            rawLines: visionLearningLines,
            officialTotalCents: finalOfficialTotal,
            cycleNetTargetCents: null,
            previousBalanceCents: null,
            paymentsCents: null,
          },
        }
      : {}),
    ...(aiStatusNotice ? { aiStatusNotice } : {}),
    printedTotalCents: finalOfficialTotal,
    detectedMeta,
    ...(visionTruncationWarning ? { visionTruncationWarning } : {}),
  };
}
