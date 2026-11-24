import { useEffect, useMemo, useRef, useState } from "react";
import {
  matchCategoryBySlug,
  resolveMerchantIdentity,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import {
  buildTransactionsFromRows,
  chunkArray,
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
  recordBatchAiMerchantTeachings,
  type BatchAiMerchantTeachingItem,
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
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  applyEditedReconciliationItem,
  createManualReconciliationItem,
  executeChunkedStatementImport,
  isRasterStatementImage,
  mapExpensesForReconciliation,
  parseStatementVisionBlobsWithAi,
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
const MAX_CATEGORIZE_BATCH_CHUNKS = 2;

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
  const [usedAiStructurer, setUsedAiStructurer] = useState(false);
  const [printedTotalCents, setPrintedTotalCents] = useState<number | null>(null);

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
    meta?: { usedAiStructurer?: boolean; printedTotalCents?: number | null },
  ) => {
    const runId = ++reconcileRunIdRef.current;
    manuallyEditedIdsRef.current.clear();

    if (meta?.usedAiStructurer !== undefined) {
      setUsedAiStructurer(meta.usedAiStructurer);
    }
    if (meta?.printedTotalCents !== undefined) {
      setPrintedTotalCents(meta.printedTotalCents);
    }

    const history = historyQuery.entries ?? [];
    const reconciliation = runStatementReconciliation({
      transactions,
      existingExpenses: existingExpensesForReconciliation,
      history,
      defaultCategoryId,
    });

    const userMemory = getMerchantLearningMemory();
    const unknownMerchantImpact = new Map<
      string,
      { cleanText: string; totalAmountCents: number }
    >();

    // Camadas 1, 2 e 3 locais (histórico + memória aprendida + catálogo canônico/keywords = 0 tokens!)
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

      if (identity.categorySlug) {
        const matchedCat = matchCategoryBySlug(
          categories,
          identity.categorySlug as CanonicalCategorySlug | string,
        );

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

      const cleanTrimmed = item.transaction.cleanDescription.trim();
      const normalizedKey = cleanTrimmed.toLowerCase();
      if (normalizedKey) {
        const prev = unknownMerchantImpact.get(normalizedKey);
        if (prev) {
          prev.totalAmountCents += item.transaction.amountCents;
        } else {
          unknownMerchantImpact.set(normalizedKey, {
            cleanText: cleanTrimmed,
            totalAmountCents: item.transaction.amountCents,
          });
        }
      }

      return item;
    });

    setReconciledItems(preResolvedItems);
    setUnmatchedAppExpenses(reconciliation.unmatchedExistingExpenses);
    setStep("reconcile");

    // Ordena descrições genuinamente inéditas pelo maior impacto financeiro (FinOps)
    const prioritizedUnknowns = [...unknownMerchantImpact.entries()]
      .sort((a, b) => b[1].totalAmountCents - a[1].totalAmountCents)
      .slice(0, MAX_AI_CATEGORIZE_BATCH_ITEMS * MAX_CATEGORIZE_BATCH_CHUNKS);

    const canRunBackgroundAi =
      prioritizedUnknowns.length > 0 &&
      categories.length > 1 &&
      !isReadOnlyMode &&
      aiExtractionEnabled &&
      (typeof navigator === "undefined" || navigator.onLine !== false);

    if (!canRunBackgroundAi) {
      return;
    }

    const batches = chunkArray(prioritizedUnknowns, MAX_AI_CATEGORIZE_BATCH_ITEMS);

    // Camada 4 silenciosa em background (Balde 2: categorize_batch)
    void (async () => {
      const allowedIds = new Set(categories.map((c) => c.id));
      const suggestionByNormalizedKey = new Map<
        string,
        { friendlyName: string; categoryId: string }
      >();
      const collectedAiTeachings: BatchAiMerchantTeachingItem[] = [];

      try {
        for (const batch of batches) {
          if (reconcileRunIdRef.current !== runId) return;

          const aiResult = await categorizeDescriptionsBatchWithAi({
            descriptions: batch.map(([, entry]) => entry.cleanText),
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
            userId: resolvedUserId,
            isReadOnlyMode,
            featureEnabled: aiExtractionEnabled,
          });

          if (!aiResult.ok || reconcileRunIdRef.current !== runId) {
            break;
          }

          for (const entry of aiResult.data.items) {
            const sourceTuple = batch[entry.index];
            if (!sourceTuple) continue;

            const hasRichMetadata =
              Boolean(entry.canonicalMerchant) ||
              Boolean(entry.serviceSegment) ||
              Boolean(entry.cutTier) ||
              typeof entry.isSubscription === "boolean" ||
              Boolean(entry.semanticTags?.length);

            if (hasRichMetadata || (entry.categoryId && allowedIds.has(entry.categoryId))) {
              collectedAiTeachings.push({
                rawDescription: sourceTuple[1].cleanText,
                friendlyName: entry.canonicalMerchant || entry.friendlyName,
                canonicalMerchant: entry.canonicalMerchant,
                categoryId:
                  entry.categoryId && allowedIds.has(entry.categoryId) ? entry.categoryId : null,
                serviceSegment: entry.serviceSegment,
                cutTier: entry.cutTier,
                isSubscription: entry.isSubscription,
                semanticTags: entry.semanticTags,
              });
            }

            if (entry.categoryId && allowedIds.has(entry.categoryId)) {
              suggestionByNormalizedKey.set(sourceTuple[0], {
                friendlyName: entry.canonicalMerchant || entry.friendlyName,
                categoryId: entry.categoryId,
              });
            }
          }
        }

        if (collectedAiTeachings.length > 0 && typeof recordBatchAiMerchantTeachings === "function") {
          recordBatchAiMerchantTeachings(collectedAiTeachings);
        }

        if (suggestionByNormalizedKey.size === 0 || reconcileRunIdRef.current !== runId) {
          return;
        }

        // Retroalimenta memória semântica fora do updater puro do React (deduplicado por comerciante)
        const learnedMerchantKeys = new Set<string>();
        for (const item of preResolvedItems) {
          if (manuallyEditedIdsRef.current.has(item.transaction.id)) continue;
          const suggestion = suggestionByNormalizedKey.get(
            item.transaction.cleanDescription.trim().toLowerCase(),
          );
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
            const suggestion = suggestionByNormalizedKey.get(
              it.transaction.cleanDescription.trim().toLowerCase(),
            );
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
        setError("Nenhuma linha de transação válida foi encontrada nos dados informados.");
        return;
      }

      setParsedRows(result.rows);
      setColumnMapping(result.mapping);
      setUsedAiStructurer(result.usedAiFallback);
      setPrintedTotalCents(result.printedTotalCents);

      if (result.isOfx || result.usedAiFallback || result.rows.length === 0) {
        applyReconciliation(result.transactions, {
          usedAiStructurer: result.usedAiFallback,
          printedTotalCents: result.printedTotalCents,
        });
      } else {
        setStep("mapping");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleFilesSelect = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setIsReadingFile(true);

    try {
      const imageFiles = files.filter((f) => isRasterStatementImage(f));
      if (imageFiles.length > 0) {
        const limitedImages = imageFiles.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
        const blobsWithSha = await Promise.all(
          limitedImages.map(async (img) => ({
            blob: img,
            sha256: await computeFileSha256(img),
          })),
        );

        const visionResult = await parseStatementVisionBlobsWithAi({
          blobs: blobsWithSha,
          cardId: card.id,
          competenceMonth,
          userId: resolvedUserId,
          isReadOnlyMode,
          aiFallbackEnabled: aiExtractionEnabled,
        });

        if (visionResult.transactions.length === 0) {
          setError(
            "Não foi possível extrair lançamentos das imagens enviadas. Verifique a nitidez do print ou utilize o arquivo PDF, CSV ou OFX da fatura.",
          );
          return;
        }

        setParsedRows(visionResult.rows);
        setColumnMapping(visionResult.mapping);
        applyReconciliation(visionResult.transactions, {
          usedAiStructurer: true,
          printedTotalCents: null,
        });
        return;
      }

      const primaryFile = files[0]!;
      const loaded = await readStatementFileContent(primaryFile);

      if (loaded.kind === "pdf_scanned") {
        const { renderScannedPdfPageToBlob } = await import(
          "@/services/native/receipt-extractor"
        );
        const pageBlobs: Array<{ blob: Blob; sha256?: string | null }> = [];
        for (let page = 1; page <= MAX_STATEMENT_VISION_PAGES_OR_IMAGES; page++) {
          const blob = await renderScannedPdfPageToBlob(loaded.buffer, page);
          if (!blob) break;
          pageBlobs.push({
            blob,
            sha256:
              page === 1 && loaded.sha256
                ? loaded.sha256
                : undefined,
          });
        }

        const scannedVision = await parseStatementVisionBlobsWithAi({
          blobs: pageBlobs,
          cardId: card.id,
          competenceMonth,
          userId: resolvedUserId,
          isReadOnlyMode,
          aiFallbackEnabled: aiExtractionEnabled,
        });

        if (scannedVision.transactions.length === 0) {
          setError(
            "Não foi possível extrair os dados da fatura em PDF. Se o arquivo estiver protegido por senha, desbloqueie-o ou exporte em CSV/OFX.",
          );
          return;
        }

        setParsedRows(scannedVision.rows);
        setColumnMapping(scannedVision.mapping);
        applyReconciliation(scannedVision.transactions, {
          usedAiStructurer: true,
          printedTotalCents: null,
        });
        return;
      }

      if (loaded.kind === "pdf_text") {
        await handleProcessInput(loaded.text, loaded.fileName, loaded.sha256);
        return;
      }

      if (loaded.kind === "spreadsheet") {
        await handleProcessInput(loaded.buffer, loaded.fileName, null);
        return;
      }

      await handleProcessInput(loaded.content, loaded.fileName, null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileSelect = async (file: File) => handleFilesSelect([file]);

  const handleTextSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Cole os lançamentos ou o conteúdo da fatura antes de processar.");
      return;
    }
    setIsReadingFile(true);
    try {
      await handleProcessInput(trimmed, "pasted-statement.txt", null);
    } finally {
      setIsReadingFile(false);
    }
  };

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
    usedAiStructurer,
    printedTotalCents,
    canOpenMapping: parsedRows.length > 0,
    isPending: importMutation.isPending || importProgress !== null,
    handleFileSelect,
    handleFilesSelect,
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
