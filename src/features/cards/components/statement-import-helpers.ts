import { inferBusinessTaxDeductibility } from "@/domain/business";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import { numberToCents } from "@/domain/money";
import {
  MAX_STATEMENT_AI_CHUNKS,
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildTransactionsFromRows,
  chunkArray,
  evaluateDeterministicStatementQuality,
  evaluateMappingConfidence,
  generateStatementHash,
  isSpreadsheetOrHtmlFileName,
  parseSpreadsheetOrHtmlToRows,
  parseStatementInput,
  preprocessStatementTextForAi,
  reconcileStatementTransactions,
  sniffColumnMapping,
  type CategoryPredictionSource,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
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
  maskSensitivePiiForAi,
  sanitizeBatchDescriptionForAi,
} from "@/services/ai-assistant";
import { computeFileSha256 } from "@/services/receipt-resolution";
import {
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

function isStructuredTabularFileName(fileNameOrType: string, content: string | ArrayBuffer): boolean {
  const lower = fileNameOrType.trim().toLowerCase();
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".ofx") ||
    isSpreadsheetOrHtmlFileName(lower)
  ) {
    return true;
  }
  if (typeof content === "string") {
    return content.includes("<OFX>") || content.includes("<STMTTRN>");
  }
  return false;
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
      text: string;
      buffer: ArrayBuffer;
      fileName: string;
      sha256: string | null;
      spatialTransactions?: StatementTransaction[];
      checksumGate?: ChecksumGateResult;
      spatialLinesCount?: number;
      discardedMoneyLines?: number;
      spatialRawLines?: string[];
    }
  | { kind: "pdf_scanned"; buffer: ArrayBuffer; fileName: string; sha256: string | null }
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
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const [buffer, sha256] = await Promise.all([
      file.arrayBuffer(),
      computeFileSha256(file),
    ]);

    let fullText = "";
    try {
      const unpdf = await import("unpdf");
      const data =
        options?.password && typeof unpdf.getDocumentProxy === "function"
          ? await unpdf.getDocumentProxy(new Uint8Array(buffer.slice(0)), { password: options.password })
          : new Uint8Array(buffer.slice(0));
      const result = await unpdf.extractText(data, { mergePages: true });
      fullText = typeof result.text === "string" ? result.text : Array.isArray(result.text) ? (result.text as string[]).join("\n") : "";
    } catch (err: unknown) {
      if (isPdfPasswordProtectedError(err)) {
        throw new PdfPasswordProtectedError();
      }
    }

    if (!fullText.trim()) {
      return {
        kind: "pdf_scanned",
        buffer,
        fileName: file.name,
        sha256,
      };
    }

    // Tenta reconstrução espacial (X, Y) com as 4 barreiras se parâmetros forem fornecidos
    let spatialTransactions: StatementTransaction[] | undefined;
    let checksumGate: ChecksumGateResult | undefined;
    let spatialLinesCount: number | undefined;
    let discardedMoneyLines: number | undefined;
    let spatialRawLines: string[] | undefined;

    if (options?.cardId && options?.competenceMonth) {
      try {
        const spatialResult = await parseSpatialPdfDocument(buffer, {
          cardId: options.cardId,
          competenceMonth: options.competenceMonth,
          password: options.password,
        });
        spatialLinesCount = spatialResult.lines.length;
        discardedMoneyLines = spatialResult.discardedMoneyLines ?? 0;
        spatialRawLines = spatialResult.lines.map((l) => l.text);

        if (spatialResult.transactions.length > 0) {
          spatialTransactions = spatialResult.transactions;
          checksumGate = spatialResult.checksumGate;
          if (spatialResult.reconstructedText) {
            fullText = spatialResult.reconstructedText;
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
      text: fullText,
      buffer,
      fileName: file.name,
      sha256,
      spatialTransactions,
      checksumGate,
      spatialLinesCount,
      discardedMoneyLines,
      spatialRawLines,
    };
  }

  if (isSpreadsheetOrHtmlFileName(file.name) || isSpreadsheetOrHtmlFileName(file.type)) {
    return {
      kind: "spreadsheet",
      buffer: await file.arrayBuffer(),
      fileName: file.name,
    };
  }

  return {
    kind: "binary_or_text",
    content: await file.arrayBuffer(),
    fileName: file.name,
  };
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
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
}) {
  return reconcileStatementTransactions({
    statementTransactions: params.transactions,
    existingExpenses: params.existingExpenses,
    history: params.history,
    defaultCategoryId: params.defaultCategoryId,
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
}

export interface ParsedStatementWithFallbackResult {
  transactions: StatementTransaction[];
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
  usedAiFallback: boolean;
  printedTotalCents: number | null;
  detectedMeta?: DetectedStatementMetadata;
  isCacheHit?: boolean;
  mappingConfidence?: number;
}

/**
 * Interpreta extratos/faturas priorizando sempre custo zero de IA:
 * 1) Transações espaciais pré-extraídas (X,Y) com 4 barreiras anti-ruído (0 IA);
 * 2) Planilhas (.xlsx/.xls/.html), OFX e CSV/TSV com cache declarativo de colunas (0 IA);
 * 3) Parser determinístico local para texto digital e colagem;
 * 4) Somente se o parser local falhar ou perder linhas (PDF multi-coluna / colagem desestruturada),
 *    envia apenas o texto cirurgicamente pré-processado (60%-85% menor) ao modo `statement_pdf_rows`.
 */
export async function parseStatementWithPdfAiFallback(
  params: ParseStatementWithFallbackParams,
): Promise<ParsedStatementWithFallbackResult> {
  // 0. Prioridade Máxima: Reconstrução Espacial (X, Y) com as 4 barreiras já concluída
  const isCollapseAnomaly = detectSpatialCollapseAnomaly({
    allLinesCount: params.spatialLinesCount ?? 0,
    transactionsCount: params.spatialTransactions?.length ?? 0,
    discardedMoneyLines: params.discardedMoneyLines ?? 0,
  });

  const canUseAiFallback =
    params.aiFallbackEnabled !== false &&
    !params.isReadOnlyMode &&
    (typeof navigator === "undefined" || navigator.onLine !== false);

  if (isCollapseAnomaly && canUseAiFallback && params.spatialRawLines && params.spatialRawLines.length > 0) {
    try {
      const sanitizedSpatialText = params.spatialRawLines
        .map((l) => maskSensitivePiiForAi(l))
        .filter((l) => l.trim().length > 0)
        .join("\n");

      if (sanitizedSpatialText.length > 0) {
        const rescueSha = params.fileSha256
          ? `${params.fileSha256}:collapse-rescue`
          : await computeTextSha256(`collapse_rescue:${params.competenceMonth}:${sanitizedSpatialText}`);
        const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
        const aiRes = await extractStatementPdfRowsWithAi({
          sha256: rescueSha,
          text: sanitizedSpatialText,
          referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
          competenceMonth: params.competenceMonth,
          userId: params.userId,
          isReadOnlyMode: params.isReadOnlyMode,
          featureEnabled: params.aiFallbackEnabled,
        });

        if (aiRes.ok && aiRes.data.rows.length > 0) {
          const built = buildTransactionsFromAiRows(aiRes.data.rows, {
            cardId: params.cardId,
            competenceMonth: params.competenceMonth,
          });
          if (built.transactions.length > (params.spatialTransactions?.length ?? 0)) {
            const officialTotal =
              aiRes.data.detectedTotalInvoiceCents ?? params.checksumGate?.officialTotalCents ?? null;
            const detectedMeta = detectStatementMetadata({
              rawText: sanitizedSpatialText,
              transactions: built.transactions,
              activeCompetenceMonth: params.competenceMonth,
              card: params.card,
              printedTotalCents: officialTotal,
              aiDetectedMeta: {
                detectedCompetenceMonth: aiRes.data.detectedCompetenceMonth,
                detectedDueDate: aiRes.data.detectedDueDate,
                detectedCardLast4: aiRes.data.detectedCardLast4,
                detectedCardBrandOrBank: aiRes.data.detectedCardBrandOrBank,
                detectedTotalInvoiceCents: aiRes.data.detectedTotalInvoiceCents,
              },
            });
            return {
              transactions: built.transactions,
              rows: built.rows,
              mapping: built.mapping,
              isOfx: false,
              usedAiFallback: true,
              printedTotalCents: officialTotal,
              detectedMeta,
              isCacheHit: true,
              mappingConfidence: 100,
            };
          }
        }
      }
    } catch {
      // Degrada silenciosamente para o fluxo espacial ou fallback textual padrão
    }
  }

  if (params.spatialTransactions && params.spatialTransactions.length > 0) {
    let activeTransactions = params.spatialTransactions;
    let activeChecksumGate = params.checksumGate;
    let usedCurator = false;

    // Se o Checksum Gate reprovou a soma e temos o total oficial impresso, aciona o line_curator
    const canRunCurator =
      params.checksumGate &&
      !params.checksumGate.passed &&
      params.checksumGate.officialTotalCents !== null &&
      params.aiFallbackEnabled !== false &&
      !params.isReadOnlyMode &&
      (typeof navigator === "undefined" || navigator.onLine !== false);

    if (canRunCurator && params.checksumGate?.officialTotalCents) {
      try {
        const candidateLines = buildCandidateCuratorLines(params.spatialTransactions);
        const curatorRes = await curateStatementLinesWithAi({
          sha256: params.fileSha256 ? `${params.fileSha256}:curator` : undefined,
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
          activeTransactions = curated.keptTransactions;
          activeChecksumGate = curated.checksumGate;
          usedCurator = true;
        }
      } catch {
        // Degrada silenciosamente mantendo transações espaciais originais
      }
    }

    const rawText = typeof params.content === "string" ? params.content : "";
    const detectedMeta = detectStatementMetadata({
      rawText,
      transactions: activeTransactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: activeChecksumGate?.officialTotalCents ?? null,
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
      usedAiFallback: usedCurator,
      printedTotalCents: activeChecksumGate?.officialTotalCents ?? null,
      detectedMeta,
      isCacheHit: true,
      mappingConfidence: 100,
    };
  }

  const lowerName = params.fileNameOrType.trim().toLowerCase();

  // 1. Planilhas Excel (.xlsx, .xls) e tabelas HTML com cache declarativo de colunas — 0 tokens de IA
  if (isSpreadsheetOrHtmlFileName(lowerName)) {
    const sheetRows = await parseSpreadsheetOrHtmlToRows(params.content);
    const headerCells = sheetRows[0]?.cells ?? [];
    const cached = getCachedColumnMapping(headerCells, sheetRows);
    const isCacheHit = Boolean(cached);
    const mapping = cached ?? sniffColumnMapping(sheetRows);
    if (!cached && mapping.hasHeader) {
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
      printedTotalCents: null,
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

  if (deterministic.isOfx) {
    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: null,
      detectedMeta,
      isCacheHit: true,
      mappingConfidence: 100,
    };
  }

  const structuredTabular = isStructuredTabularFileName(params.fileNameOrType, params.content);
  if (structuredTabular) {
    const headerCells = deterministic.rows[0]?.cells ?? [];
    const cached = getCachedColumnMapping(headerCells, deterministic.rows);
    const isCacheHit = Boolean(cached);
    const mapping = cached ?? deterministic.mapping;
    if (!cached && mapping.hasHeader) {
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
      printedTotalCents: null,
      detectedMeta,
      isCacheHit,
      mappingConfidence,
    };
  }

  const preprocessed = preprocessStatementTextForAi(textContent);
  const quality = evaluateDeterministicStatementQuality({
    rawText: textContent,
    transactions: deterministic.transactions,
    candidateAmountLineCount: preprocessed.candidateAmountLineCount,
    printedTotalCents: preprocessed.printedTotalCents,
    isStructuredTabularFile: false,
  });

  if (quality.isSufficient) {
    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: preprocessed.printedTotalCents,
    });
    const mappingConfidence = evaluateMappingConfidence({
      rows: deterministic.rows,
      mapping: deterministic.mapping,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
      mappingConfidence,
    };
  }

  // 3. Fallback IA enxuto (apenas texto podado localmente)
  if (!textContent.trim() || params.aiFallbackEnabled === false || params.isReadOnlyMode) {
    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: preprocessed.printedTotalCents,
    });
    const mappingConfidence = evaluateMappingConfidence({
      rows: deterministic.rows,
      mapping: deterministic.mapping,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
      mappingConfidence,
    };
  }

  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const chunksToSend = (
    preprocessed.chunks.length > 0 ? preprocessed.chunks : [preprocessed.compactedText]
  ).slice(0, MAX_STATEMENT_AI_CHUNKS);
  const collectedAiRows: AiStatementPdfRow[] = [];
  let latestAiMeta: {
    detectedCompetenceMonth?: string | null;
    detectedDueDate?: string | null;
    detectedCardLast4?: string | null;
    detectedCardBrandOrBank?: string | null;
    detectedTotalInvoiceCents?: number | null;
  } | null = null;

  for (let idx = 0; idx < chunksToSend.length; idx++) {
    const chunkText = chunksToSend[idx]?.trim() ?? "";
    if (!chunkText) continue;

    const chunkSha =
      chunksToSend.length === 1 && params.fileSha256
        ? params.fileSha256
        : await computeTextSha256(`stmt_chunk_${idx}:${params.competenceMonth}:${chunkText}`);

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
      break;
    }
    if (
      !latestAiMeta &&
      (aiRes.data.detectedCompetenceMonth ||
        aiRes.data.detectedDueDate ||
        aiRes.data.detectedCardLast4 ||
        aiRes.data.detectedCardBrandOrBank)
    ) {
      latestAiMeta = {
        detectedCompetenceMonth: aiRes.data.detectedCompetenceMonth,
        detectedDueDate: aiRes.data.detectedDueDate,
        detectedCardLast4: aiRes.data.detectedCardLast4,
        detectedCardBrandOrBank: aiRes.data.detectedCardBrandOrBank,
        detectedTotalInvoiceCents: aiRes.data.detectedTotalInvoiceCents,
      };
    }
    collectedAiRows.push(...aiRes.data.rows);
  }

  if (collectedAiRows.length === 0) {
    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: preprocessed.printedTotalCents,
      aiDetectedMeta: latestAiMeta,
    });
    const mappingConfidence = evaluateMappingConfidence({
      rows: deterministic.rows,
      mapping: deterministic.mapping,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
      mappingConfidence,
    };
  }

  const built = buildTransactionsFromAiRows(collectedAiRows, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  const meaningfulLocalCount = deterministic.transactions.filter((tx) => {
    const desc = tx.cleanDescription.trim();
    return Boolean(desc && desc !== "Transação" && !/^[\d\s/.,+-]+$/.test(desc));
  }).length;

  // Never-degrade: só substitui resultado parcial local se a IA extraiu pelo menos tantos lançamentos íntegros quanto o local
  if (built.transactions.length === 0 || built.transactions.length < meaningfulLocalCount) {
    const detectedMeta = detectStatementMetadata({
      rawText: textContent,
      transactions: deterministic.transactions,
      activeCompetenceMonth: params.competenceMonth,
      card: params.card,
      printedTotalCents: preprocessed.printedTotalCents,
      aiDetectedMeta: latestAiMeta,
    });
    const mappingConfidence = evaluateMappingConfidence({
      rows: deterministic.rows,
      mapping: deterministic.mapping,
    });
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
      mappingConfidence,
    };
  }

  const finalPrintedTotal =
    latestAiMeta?.detectedTotalInvoiceCents ?? preprocessed.printedTotalCents;
  const detectedMeta = detectStatementMetadata({
    rawText: textContent,
    transactions: built.transactions,
    activeCompetenceMonth: params.competenceMonth,
    card: params.card,
    printedTotalCents: finalPrintedTotal,
    aiDetectedMeta: latestAiMeta,
  });

  return {
    transactions: built.transactions,
    rows: built.rows,
    mapping: built.mapping,
    isOfx: false,
    usedAiFallback: true,
    printedTotalCents: finalPrintedTotal,
    detectedMeta,
    isCacheHit: false,
    mappingConfidence: 100,
  };
}

/**
 * Extrai lançamentos via IA Vision a partir de prints de fatura (até 3 imagens)
 * ou páginas renderizadas de PDF escaneado sem camada de texto digital.
 */
export async function parseStatementVisionBlobsWithAi(params: {
  blobs: readonly { blob: Blob; sha256?: string | null }[];
  cardId: string;
  competenceMonth: string;
  card?: CardContextForMetadata | null;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiFallbackEnabled?: boolean;
}): Promise<ParsedStatementWithFallbackResult> {
  const emptyResult: ParsedStatementWithFallbackResult = {
    transactions: [],
    rows: [],
    mapping: CANONICAL_AI_MAPPING,
    isOfx: false,
    usedAiFallback: false,
    printedTotalCents: null,
  };

  if (
    params.blobs.length === 0 ||
    params.aiFallbackEnabled === false ||
    params.isReadOnlyMode
  ) {
    return emptyResult;
  }

  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);
  const limited = params.blobs.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
  const collectedRows: AiStatementPdfRow[] = [];
  let latestAiMeta: {
    detectedCompetenceMonth?: string | null;
    detectedDueDate?: string | null;
    detectedCardLast4?: string | null;
    detectedCardBrandOrBank?: string | null;
    detectedTotalInvoiceCents?: number | null;
  } | null = null;

  for (const entry of limited) {
    const aiRes = await extractStatementPdfRowsWithAi({
      sha256: entry.sha256,
      imageBlob: entry.blob,
      referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      competenceMonth: params.competenceMonth,
      userId: params.userId,
      isReadOnlyMode: params.isReadOnlyMode,
      featureEnabled: params.aiFallbackEnabled,
    });

    if (aiRes.ok && aiRes.data.rows.length > 0) {
      if (
        !latestAiMeta &&
        (aiRes.data.detectedCompetenceMonth ||
          aiRes.data.detectedDueDate ||
          aiRes.data.detectedCardLast4 ||
          aiRes.data.detectedCardBrandOrBank)
      ) {
        latestAiMeta = {
          detectedCompetenceMonth: aiRes.data.detectedCompetenceMonth,
          detectedDueDate: aiRes.data.detectedDueDate,
          detectedCardLast4: aiRes.data.detectedCardLast4,
          detectedCardBrandOrBank: aiRes.data.detectedCardBrandOrBank,
          detectedTotalInvoiceCents: aiRes.data.detectedTotalInvoiceCents,
        };
      }
      collectedRows.push(...aiRes.data.rows);
    }
  }

  if (collectedRows.length === 0) {
    return emptyResult;
  }

  const built = buildTransactionsFromAiRows(collectedRows, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  if (built.transactions.length === 0) {
    return emptyResult;
  }

  const detectedMeta = detectStatementMetadata({
    rawText: "",
    transactions: built.transactions,
    activeCompetenceMonth: params.competenceMonth,
    card: params.card,
    printedTotalCents: latestAiMeta?.detectedTotalInvoiceCents ?? null,
    aiDetectedMeta: latestAiMeta,
  });

  return {
    transactions: built.transactions,
    rows: built.rows,
    mapping: built.mapping,
    isOfx: false,
    usedAiFallback: true,
    printedTotalCents: latestAiMeta?.detectedTotalInvoiceCents ?? null,
    detectedMeta,
  };
}
