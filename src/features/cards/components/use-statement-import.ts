import { useEffect, useMemo, useRef, useState } from "react";
import {
  matchCategoryBySlug,
  resolveMerchantIdentity,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import {
  buildTransactionsFromRows,
  predictCategoryForDescription,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
} from "@/domain/reconciliation";
import { categorizeDescriptionsBatchWithAi } from "@/services/ai-assistant";
import { getErrorMessage } from "@/services/errors";
import {
  autoLearnExpenseCategory,
  getMerchantLearningMemory,
} from "@/services/merchant-learning";
import { computeFileSha256 } from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getActiveUserId } from "@/services/user-storage";
import {
  useCardExpenses,
  useCategories,
  useImportStatementExpenses,
  usePredictionHistory,
} from "@/state";
import type { CreditCard } from "@/types";
import { MAX_AI_CATEGORIZE_BATCH_ITEMS } from "../../../../supabase/functions/_shared/ai-schemas";
import {
  applyEditedReconciliationItem,
  createManualReconciliationItem,
  executeChunkedStatementImport,
  mapExpensesForReconciliation,
  parseStatementWithPdfAiFallback,
  readStatementFileContent,
  runStatementReconciliation,
  type StatementItemPatch,
} from "./statement-import-helpers";
import type { StatementImportProgress } from "./statement-reconcile-step";

export type StatementWizardStep = "upload" | "mapping" | "reconcile";

export interface UseStatementImportParams {
  card: CreditCard;
  competenceMonth: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onClose: () => void;
}

const NO_HISTORY_SENTINEL = "__NO_HISTORY_MATCH__";

export function useStatementImport({
  card,
  competenceMonth,
  userId,
  isReadOnlyMode = false,
  aiExtractionEnabled = true,
  onClose,
}: UseStatementImportParams) {
  const [step, setStep] = useState<StatementWizardStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [unmatchedAppExpenses, setUnmatchedAppExpenses] = useState<
    ExistingExpenseForReconciliation[]
  >([]);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const reconcileRunIdRef = useRef(0);
  const manuallyEditedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      reconcileRunIdRef.current += 1;
    };
  }, []);

  const categoriesQuery = useCategories("expense");
  const expensesQuery = useCardExpenses(card.id);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportStatementExpenses();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const defaultCategoryId = categories[0]?.id ?? "";
  const resolvedUserId = userId ?? getActiveUserId();

  const existingExpensesForReconciliation = useMemo(
    () => mapExpensesForReconciliation(expensesQuery.data ?? [], competenceMonth),
    [expensesQuery.data, competenceMonth],
  );

  const applyReconciliation = (
    transactions: Parameters<typeof runStatementReconciliation>[0]["transactions"],
  ) => {
    const runId = ++reconcileRunIdRef.current;
    manuallyEditedIdsRef.current.clear();

    const history = historyQuery.entries ?? [];
    const reconciliation = runStatementReconciliation({
      transactions,
      existingExpenses: existingExpensesForReconciliation,
      history,
      defaultCategoryId,
    });

    const userMemory = getMerchantLearningMemory();
    const unknownDescriptions: string[] = [];
    const unknownDescIndexByKey = new Map<string, number>();

    // Camada 1-2 local imediata (R$ 0,00 em meses recorrentes) + coleta para Camada 4
    const preResolvedItems = reconciliation.items.map((item) => {
      if (
        item.status !== "unmatched_new" ||
        item.ignoredByDefault ||
        item.transaction.isRefund
      ) {
        return item;
      }

      const historyMatch = predictCategoryForDescription(
        item.transaction.cleanDescription,
        history,
        NO_HISTORY_SENTINEL,
      );
      if (historyMatch !== NO_HISTORY_SENTINEL) {
        return item;
      }

      const identity = resolveMerchantIdentity({
        merchantOrDescription: item.transaction.cleanDescription,
        rawText: item.transaction.rawDescription,
        userMemory,
      });

      if (identity.isLearned && identity.categorySlug) {
        const matchedCat =
          categories.find((c) => c.id === identity.categorySlug) ??
          matchCategoryBySlug(categories, identity.categorySlug as CanonicalCategorySlug);

        if (matchedCat) {
          return {
            ...item,
            suggestedCategoryId: matchedCat.id,
            selectedCategoryId: matchedCat.id,
            transaction: {
              ...item.transaction,
              cleanDescription: identity.friendlyName || item.transaction.cleanDescription,
            },
          };
        }
      }

      const normalizedKey = item.transaction.cleanDescription.trim().toLowerCase();
      if (normalizedKey && !unknownDescIndexByKey.has(normalizedKey)) {
        if (unknownDescriptions.length < MAX_AI_CATEGORIZE_BATCH_ITEMS) {
          unknownDescIndexByKey.set(normalizedKey, unknownDescriptions.length);
          unknownDescriptions.push(item.transaction.cleanDescription.trim());
        }
      }

      return item;
    });

    setReconciledItems(preResolvedItems);
    setUnmatchedAppExpenses(reconciliation.unmatchedExistingExpenses);
    setStep("reconcile");

    const canRunBackgroundAi =
      unknownDescriptions.length > 0 &&
      categories.length > 1 &&
      !isReadOnlyMode &&
      aiExtractionEnabled &&
      (typeof navigator === "undefined" || navigator.onLine !== false);

    if (!canRunBackgroundAi) {
      return;
    }

    // Camada 4 silenciosa em background (Balde 2: categorize_batch)
    void (async () => {
      try {
        const aiResult = await categorizeDescriptionsBatchWithAi({
          descriptions: unknownDescriptions,
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          userId: resolvedUserId,
          isReadOnlyMode,
          featureEnabled: aiExtractionEnabled,
        });

        if (!aiResult.ok || reconcileRunIdRef.current !== runId) {
          return;
        }

        const allowedIds = new Set(categories.map((c) => c.id));
        const suggestionByIndex = new Map<
          number,
          { friendlyName: string; categoryId: string }
        >();

        for (const entry of aiResult.data.items) {
          if (entry.categoryId && allowedIds.has(entry.categoryId)) {
            suggestionByIndex.set(entry.index, {
              friendlyName: entry.friendlyName,
              categoryId: entry.categoryId,
            });
          }
        }

        if (suggestionByIndex.size === 0) {
          return;
        }

        // Retroalimenta memória semântica fora do updater puro do React (deduplicado por comerciante no lote)
        const learnedMerchantKeys = new Set<string>();
        for (const item of preResolvedItems) {
          if (manuallyEditedIdsRef.current.has(item.transaction.id)) continue;
          const descIdx = unknownDescIndexByKey.get(
            item.transaction.cleanDescription.trim().toLowerCase(),
          );
          if (descIdx === undefined) continue;
          const suggestion = suggestionByIndex.get(descIdx);
          if (!suggestion) continue;
          const merchantKey = suggestion.friendlyName.trim().toLowerCase();
          if (!merchantKey || learnedMerchantKeys.has(merchantKey)) continue;
          learnedMerchantKeys.add(merchantKey);
          autoLearnExpenseCategory(
            suggestion.friendlyName,
            suggestion.categoryId,
            undefined,
            item.transaction.rawDescription,
          );
        }

        setReconciledItems((prev) =>
          prev.map((it) => {
            if (manuallyEditedIdsRef.current.has(it.transaction.id)) return it;
            const descIdx = unknownDescIndexByKey.get(
              it.transaction.cleanDescription.trim().toLowerCase(),
            );
            if (descIdx === undefined) return it;
            const suggestion = suggestionByIndex.get(descIdx);
            if (!suggestion) return it;

            return {
              ...it,
              suggestedCategoryId: suggestion.categoryId,
              selectedCategoryId: suggestion.categoryId,
              transaction: {
                ...it.transaction,
                cleanDescription: suggestion.friendlyName || it.transaction.cleanDescription,
              },
            };
          }),
        );
      } catch {
        // Degrada silenciosamente mantendo categoria fallback
      }
    })();
  };

  const handleProcessInput = async (
    content: string | ArrayBuffer,
    fileNameOrType: string,
    fileSha256?: string | null,
  ) => {
    setError(null);
    try {
      const result = await parseStatementWithPdfAiFallback({
        content,
        fileNameOrType,
        cardId: card.id,
        competenceMonth,
        fileSha256,
        userId: resolvedUserId,
        isReadOnlyMode,
        aiFallbackEnabled: aiExtractionEnabled,
      });

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
    setIsReadingFile(true);
    try {
      const isPdf =
        file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const fileSha256 = isPdf ? await computeFileSha256(file) : null;
      const content = await readStatementFileContent(file);
      await handleProcessInput(content, file.name, fileSha256);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleTextSubmit = (text: string) => handleProcessInput(text, "pasted-statement.txt");

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setError(null);
    try {
      applyReconciliation(
        buildTransactionsFromRows(parsedRows, mapping, { cardId: card.id, competenceMonth }),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleToggleItem = (id: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    setReconciledItems((prev) => prev.map((it) => ({ ...it, selected })));
  };

  const handleChangeCategory = (id: string, categoryId: string) => {
    manuallyEditedIdsRef.current.add(id);
    setReconciledItems((prev) =>
      prev.map((it) =>
        it.transaction.id === id ? { ...it, selectedCategoryId: categoryId } : it,
      ),
    );
    const targetItem = reconciledItems.find((it) => it.transaction.id === id);
    if (targetItem && categoryId) {
      autoLearnExpenseCategory(
        targetItem.transaction.cleanDescription,
        categoryId,
        undefined,
        targetItem.transaction.rawDescription,
      );
    }
  };

  const handleEditItem = (id: string, updated: StatementItemPatch) => {
    manuallyEditedIdsRef.current.add(id);
    const existing = reconciledItems.find((it) => it.transaction.id === id);
    if (updated.selectedCategoryId) {
      autoLearnExpenseCategory(
        updated.cleanDescription,
        updated.selectedCategoryId,
        undefined,
        existing?.transaction.rawDescription,
      );
    }
    setReconciledItems((prev) =>
      prev.map((it) =>
        it.transaction.id === id
          ? applyEditedReconciliationItem({ cardId: card.id, competenceMonth, current: it, updated })
          : it,
      ),
    );
  };

  const handleRemoveItem = (id: string) => {
    manuallyEditedIdsRef.current.add(id);
    setReconciledItems((prev) => prev.filter((it) => it.transaction.id !== id));
  };

  const handleAddManualItem = (item: StatementItemPatch) => {
    setReconciledItems((prev) => [
      createManualReconciliationItem({ cardId: card.id, competenceMonth, item, index: prev.length }),
      ...prev,
    ]);
  };

  const handleUncheckDuplicates = () => {
    setReconciledItems((prev) =>
      prev.map((it) =>
        it.isInternalDuplicate || it.status === "exact_match" ? { ...it, selected: false } : it,
      ),
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

  const selectedCount = useMemo(
    () => reconciledItems.filter((it) => it.selected).length,
    [reconciledItems],
  );

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
    isReadingFile,
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
