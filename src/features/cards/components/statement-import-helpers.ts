import { numberToCents } from "@/domain/money";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildTransactionsFromRows,
  chunkArray,
  generateStatementHash,
  parseStatementInput,
  reconcileStatementTransactions,
  type CategoryPredictionSource,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
  type StatementTransaction,
} from "@/domain/reconciliation";
import {
  computeTextSha256,
  extractStatementPdfRowsWithAi,
} from "@/services/ai-assistant";
import type { Expense } from "@/types";
import type { AiStatementPdfRow } from "../../../../supabase/functions/_shared/ai-schemas";
import type { StatementImportProgress } from "./statement-reconcile-step";

export interface StatementItemPatch {
  date: string;
  cleanDescription: string;
  amountCents: number;
  selectedCategoryId: string;
  installment?: { current: number; total: number };
}

export async function readStatementFileContent(file: File): Promise<string | ArrayBuffer> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    const { extractText } = await import("unpdf");
    const { text } = await extractText(buffer);
    const fullText = Array.isArray(text) ? text.join("\n") : (text ?? "");
    if (!fullText.trim()) {
      throw new Error(
        "Não foi possível extrair os dados da fatura em PDF. Se o arquivo for protegido ou escaneado (imagem), utilize o arquivo CSV ou OFX exportado pelo seu banco.",
      );
    }
    return fullText;
  }
  return file.arrayBuffer();
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
}

export async function executeChunkedStatementImport(params: {
  cardId: string;
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
  const payload: ChunkedImportExpenseInput[] = params.items.map((it) => ({
    date: it.transaction.date,
    value: it.transaction.amountCents / 100,
    category_id: it.selectedCategoryId || params.fallbackCategoryId,
    description: it.transaction.cleanDescription,
    installments_total: it.transaction.installment?.total ?? 1,
    installment_number: it.transaction.installment?.current ?? 1,
    report_weight: 1.0,
    statement_hash: it.transaction.statementHash,
  }));

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

/**
 * Converte linhas extraídas de PDF multi-coluna em `RawParsedRow[]` para alimentar
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
    const amountCell = formatStatementAmountCell(row.amountCents);

    return {
      rowIndex: index,
      rawText: `${row.date}\t${descriptionCell}\t${amountCell}`,
      cells: [row.date, descriptionCell, amountCell],
    };
  });
}

export interface ParseStatementWithFallbackParams {
  content: string | ArrayBuffer;
  fileNameOrType: string;
  cardId: string;
  competenceMonth: string;
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
}

/**
 * Interpreta extratos/faturas com o parser determinístico local e, exclusivamente
 * para PDFs multi-coluna cujo parser tabular local retornar vazio, aciona o fallback
 * `statement_pdf_rows` (Balde 2) mantendo soma, hash e conciliação determinísticos.
 */
export async function parseStatementWithPdfAiFallback(
  params: ParseStatementWithFallbackParams,
): Promise<ParsedStatementWithFallbackResult> {
  const deterministic = parseStatementInput(params.content, params.fileNameOrType, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  if (deterministic.transactions.length > 0 || deterministic.rows.length > 0) {
    return { ...deterministic, usedAiFallback: false };
  }

  const isPdfText =
    params.fileNameOrType.toLowerCase().endsWith(".pdf") &&
    typeof params.content === "string" &&
    params.content.trim().length > 0;

  if (!isPdfText) {
    return { ...deterministic, usedAiFallback: false };
  }

  const pdfText = params.content as string;
  const resolvedSha = params.fileSha256 || (await computeTextSha256(pdfText));
  const parsedYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10);

  const aiRes = await extractStatementPdfRowsWithAi({
    sha256: resolvedSha,
    text: pdfText,
    referenceYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
    userId: params.userId,
    isReadOnlyMode: params.isReadOnlyMode,
    featureEnabled: params.aiFallbackEnabled,
  });

  if (!aiRes.ok || aiRes.data.rows.length === 0) {
    return { ...deterministic, usedAiFallback: false };
  }

  const aiRows = convertAiStatementRowsToRawParsedRows(aiRes.data.rows);
  const canonicalMapping: ColumnMapping = {
    dateColIndex: 0,
    descriptionColIndex: 1,
    amountColIndex: 2,
    hasHeader: false,
    startRowIndex: 0,
  };
  const transactions = buildTransactionsFromRows(aiRows, canonicalMapping, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
  });

  if (transactions.length === 0) {
    return { ...deterministic, usedAiFallback: false };
  }

  return {
    transactions,
    rows: aiRows,
    mapping: canonicalMapping,
    isOfx: false,
    usedAiFallback: true,
  };
}
