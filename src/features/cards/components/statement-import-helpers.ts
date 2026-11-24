import { inferBusinessTaxDeductibility } from "@/domain/business";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import { numberToCents } from "@/domain/money";
import {
  MAX_STATEMENT_AI_CHUNKS,
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildTransactionsFromRows,
  chunkArray,
  evaluateDeterministicStatementQuality,
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
} from "@/domain/reconciliation";
import {
  computeTextSha256,
  extractStatementPdfRowsWithAi,
} from "@/services/ai-assistant";
import { computeFileSha256 } from "@/services/receipt-resolution";
import type { Expense } from "@/types";
import type { AiStatementPdfRow } from "../../../../supabase/functions/_shared/ai-schemas";
import type { StatementImportProgress } from "./statement-reconcile-step";

export const MAX_STATEMENT_VISION_PAGES_OR_IMAGES = 3;

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
  | { kind: "pdf_text"; text: string; buffer: ArrayBuffer; fileName: string; sha256: string | null }
  | { kind: "pdf_scanned"; buffer: ArrayBuffer; fileName: string; sha256: string | null }
  | { kind: "spreadsheet"; buffer: ArrayBuffer; fileName: string }
  | { kind: "binary_or_text"; content: ArrayBuffer | string; fileName: string };

export async function readStatementFileContent(file: File): Promise<LoadedStatementSource> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const [buffer, sha256] = await Promise.all([
      file.arrayBuffer(),
      computeFileSha256(file),
    ]);
    const { extractText } = await import("unpdf");
    const { text } = await extractText(buffer.slice(0));
    const fullText = Array.isArray(text) ? text.join("\n") : (text ?? "");
    if (!fullText.trim()) {
      return {
        kind: "pdf_scanned",
        buffer,
        fileName: file.name,
        sha256,
      };
    }
    return {
      kind: "pdf_text",
      text: fullText,
      buffer,
      fileName: file.name,
      sha256,
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
  statement_hash: string;
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
    const isDeductible = isBusinessCard
      ? inferBusinessTaxDeductibility({ description: it.transaction.cleanDescription }).isDeductible
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
      scope: isBusinessCard ? "business" : "personal",
      ...(isBusinessCard && isDeductible ? { is_tax_deductible: true } : {}),
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
}

export interface ParsedStatementWithFallbackResult {
  transactions: StatementTransaction[];
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isOfx: boolean;
  usedAiFallback: boolean;
  printedTotalCents: number | null;
  detectedMeta?: DetectedStatementMetadata;
}

/**
 * Interpreta extratos/faturas priorizando sempre custo zero de IA:
 * 1) Planilhas (.xlsx/.xls/.html), OFX e CSV/TSV resolvem 100% localmente;
 * 2) PDFs digitais e textos colados rodam parser determinístico + auditoria de cobertura;
 * 3) Somente se o parser local falhar ou perder linhas (PDF multi-coluna / colagem desestruturada),
 *    envia apenas o texto cirurgicamente pré-processado (60%-85% menor) ao modo `statement_pdf_rows`.
 */
export async function parseStatementWithPdfAiFallback(
  params: ParseStatementWithFallbackParams,
): Promise<ParsedStatementWithFallbackResult> {
  const lowerName = params.fileNameOrType.trim().toLowerCase();

  // 1. Planilhas Excel (.xlsx, .xls) e tabelas HTML exportadas por bancos — 0 tokens de IA
  if (isSpreadsheetOrHtmlFileName(lowerName)) {
    const sheetRows = await parseSpreadsheetOrHtmlToRows(params.content);
    const mapping = sniffColumnMapping(sheetRows);
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
    };
  }

  const structuredTabular = isStructuredTabularFileName(params.fileNameOrType, params.content);
  if (structuredTabular) {
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
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
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
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
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
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
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
    return {
      ...deterministic,
      usedAiFallback: false,
      printedTotalCents: preprocessed.printedTotalCents,
      detectedMeta,
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
