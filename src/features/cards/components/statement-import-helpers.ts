import { numberToCents } from "@/domain/money";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  chunkArray,
  generateStatementHash,
  reconcileStatementTransactions,
  type CategoryPredictionSource,
  type ExistingExpenseForReconciliation,
  type ReconciliationItem,
  type StatementTransaction,
} from "@/domain/reconciliation";
import type { Expense } from "@/types";
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
