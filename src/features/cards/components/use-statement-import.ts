import { useMemo, useState } from "react";
import {
  buildTransactionsFromRows,
  parseStatementInput,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
} from "@/domain/reconciliation";
import { getErrorMessage } from "@/services/errors";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCardExpenses,
  useCategories,
  useImportStatementExpenses,
  usePredictionHistory,
} from "@/state";
import type { CreditCard } from "@/types";
import {
  applyEditedReconciliationItem,
  createManualReconciliationItem,
  executeChunkedStatementImport,
  mapExpensesForReconciliation,
  readStatementFileContent,
  runStatementReconciliation,
  type StatementItemPatch,
} from "./statement-import-helpers";
import type { StatementImportProgress } from "./statement-reconcile-step";

export type StatementWizardStep = "upload" | "mapping" | "reconcile";

export interface UseStatementImportParams {
  card: CreditCard;
  competenceMonth: string;
  onClose: () => void;
}

export function useStatementImport({ card, competenceMonth, onClose }: UseStatementImportParams) {
  const [step, setStep] = useState<StatementWizardStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [unmatchedAppExpenses, setUnmatchedAppExpenses] = useState<ExistingExpenseForReconciliation[]>([]);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);

  const categoriesQuery = useCategories("expense");
  const expensesQuery = useCardExpenses(card.id);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportStatementExpenses();

  const categories = categoriesQuery.data ?? [];
  const defaultCategoryId = categories[0]?.id ?? "";

  const existingExpensesForReconciliation = useMemo(
    () => mapExpensesForReconciliation(expensesQuery.data ?? [], competenceMonth),
    [expensesQuery.data, competenceMonth],
  );

  const applyReconciliation = (transactions: Parameters<typeof runStatementReconciliation>[0]["transactions"]) => {
    const reconciliation = runStatementReconciliation({
      transactions,
      existingExpenses: existingExpensesForReconciliation,
      history: historyQuery.entries ?? [],
      defaultCategoryId,
    });
    setReconciledItems(reconciliation.items);
    setUnmatchedAppExpenses(reconciliation.unmatchedExistingExpenses);
    setStep("reconcile");
  };

  const handleProcessInput = (content: string | ArrayBuffer, fileNameOrType: string) => {
    setError(null);
    try {
      const result = parseStatementInput(content, fileNameOrType, { cardId: card.id, competenceMonth });
      if (result.transactions.length === 0 && result.rows.length === 0) {
        setError("Nenhuma linha de transação válida foi encontrada no extrato.");
        return;
      }
      setParsedRows(result.rows);
      setColumnMapping(result.mapping);
      if (result.isOfx || result.rows.length === 0) applyReconciliation(result.transactions);
      else setStep("mapping");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    try {
      handleProcessInput(await readStatementFileContent(file), file.name);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleTextSubmit = (text: string) => handleProcessInput(text, "pasted-statement.txt");

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setError(null);
    try {
      applyReconciliation(buildTransactionsFromRows(parsedRows, mapping, { cardId: card.id, competenceMonth }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleToggleItem = (id: string) => {
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)));
  };

  const handleToggleAll = (selected: boolean) => {
    setReconciledItems((prev) => prev.map((it) => ({ ...it, selected })));
  };

  const handleChangeCategory = (id: string, categoryId: string) => {
    setReconciledItems((prev) => prev.map((it) => (it.transaction.id === id ? { ...it, selectedCategoryId: categoryId } : it)));
    const targetItem = reconciledItems.find((it) => it.transaction.id === id);
    if (targetItem && categoryId) {
      autoLearnExpenseCategory(targetItem.transaction.cleanDescription, categoryId, undefined, targetItem.transaction.rawDescription);
    }
  };

  const handleEditItem = (id: string, updated: StatementItemPatch) => {
    const existing = reconciledItems.find((it) => it.transaction.id === id);
    if (updated.selectedCategoryId) {
      autoLearnExpenseCategory(updated.cleanDescription, updated.selectedCategoryId, undefined, existing?.transaction.rawDescription);
    }
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? applyEditedReconciliationItem({ cardId: card.id, competenceMonth, current: it, updated }) : it)),
    );
  };

  const handleRemoveItem = (id: string) => setReconciledItems((prev) => prev.filter((it) => it.transaction.id !== id));

  const handleAddManualItem = (item: StatementItemPatch) => {
    setReconciledItems((prev) => [
      createManualReconciliationItem({ cardId: card.id, competenceMonth, item, index: prev.length }),
      ...prev,
    ]);
  };

  const handleUncheckDuplicates = () => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.isInternalDuplicate || it.status === "exact_match" ? { ...it, selected: false } : it)),
    );
  };

  const handleConfirmImport = async () => {
    const toImport = reconciledItems.filter((it) => it.selected);
    if (toImport.length === 0) return;

    setError(null);
    try {
      const { totalInserted, totalSkipped } = await executeChunkedStatementImport({
        cardId: card.id,
        competenceMonth,
        items: toImport,
        fallbackCategoryId: defaultCategoryId || categories[0]?.id || "",
        onProgress: setImportProgress,
        mutateChunk: (input) => importMutation.mutateAsync(input),
      });

      triggerSensory("success");
      pushToast({
        variant: "default",
        title: `Fatura importada com sucesso: ${totalInserted} ${
          totalInserted === 1 ? "lançamento criado" : "lançamentos criados"
        }${totalSkipped > 0 ? ` (${totalSkipped} duplicatas ignoradas)` : ""}.`,
      });
      onClose();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    } finally {
      setImportProgress(null);
    }
  };

  const selectedCount = useMemo(() => reconciledItems.filter((it) => it.selected).length, [reconciledItems]);

  return {
    step,
    setStep,
    error,
    parsedRows,
    columnMapping,
    reconciledItems,
    unmatchedAppExpenses,
    importProgress,
    categories,
    selectedCount,
    isPending: importMutation.isPending || importProgress !== null,
    handleFileSelect,
    handleTextSubmit,
    handleConfirmMapping,
    handleToggleItem,
    handleToggleAll,
    handleChangeCategory,
    handleEditItem,
    handleRemoveItem,
    handleAddManualItem,
    handleUncheckDuplicates,
    handleConfirmImport,
  };
}
