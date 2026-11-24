import { useEffect, useMemo, useRef, useState } from "react";
import { inferBusinessTaxDeductibility } from "@/domain/business";
import {
  matchCategoryBySlug,
  resolveMerchantIdentity,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import {
  buildTransactionsFromRows,
  calculateMatchScore,
  chunkArray,
  detectInstallmentSeriesState,
  projectFutureInstallments,
  predictCategoryForDescription,
  STATEMENT_IMPORT_CHUNK_SIZE,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type PendingLinkAdjustment,
  type RawParsedRow,
  type ReconciliationItem,
  type StatementTransaction,
  type DetectedStatementMetadata,
} from "@/domain/reconciliation";
import { categorizeDescriptionsBatchWithAi } from "@/services/ai-assistant";
import { getErrorMessage } from "@/services/errors";
import {
  autoLearnExpenseCategory,
  getMerchantLearningMemory,
} from "@/services/merchant-learning";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
} from "@/services/native/receipt-extractor";
import { computeFileSha256 } from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { setCachedColumnMapping } from "@/services/statement-mapping-cache";
import { pushToast } from "@/services/toast";
import { getActiveUserId } from "@/services/user-storage";
import {
  useBusinessMode,
  useCardExpenses,
  useCategories,
  useCreateRefund,
  useImportStatementExpenses,
  usePredictionHistory,
  useUpdateExpense,
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
  sanitizeDescriptionForStatementMicroAi,
  type ChunkedImportExpenseInput,
  type LoadedStatementSource,
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
  onCompetenceChange?: (newCompetenceMonth: string) => void;
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
  onCompetenceChange,
}: UseStatementImportParams) {
  const [step, setStep] = useState<StatementWizardStep>("upload");
  const [activeCompetenceMonth, setActiveCompetenceMonth] = useState(competenceMonth);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [unmatchedAppExpenses, setUnmatchedAppExpenses] = useState<
    ExistingExpenseForReconciliation[]
  >([]);
  const [pendingLinkAdjustments, setPendingLinkAdjustments] = useState<
    Map<string, PendingLinkAdjustment>
  >(new Map());
  const [pendingPasswordFile, setPendingPasswordFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [usedAiStructurer, setUsedAiStructurer] = useState(false);
  const [printedTotalCents, setPrintedTotalCents] = useState<number | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<DetectedStatementMetadata | null>(null);

  const reconcileRunIdRef = useRef(0);
  const manuallyEditedIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconciledItemsRef = useRef<ReconciliationItem[]>([]);
  const unmatchedAppExpensesRef = useRef<ExistingExpenseForReconciliation[]>([]);
  const loadedInputRef = useRef<{
    content: string | ArrayBuffer;
    fileNameOrType: string;
    fileSha256?: string | null;
    visionBlobs?: readonly { blob: Blob; sha256?: string | null }[];
  } | null>(null);

  useEffect(() => {
    reconciledItemsRef.current = reconciledItems;
  }, [reconciledItems]);

  useEffect(() => {
    unmatchedAppExpensesRef.current = unmatchedAppExpenses;
  }, [unmatchedAppExpenses]);

  const [prevCompetenceMonth, setPrevCompetenceMonth] = useState(competenceMonth);
  if (prevCompetenceMonth !== competenceMonth) {
    setPrevCompetenceMonth(competenceMonth);
    setActiveCompetenceMonth(competenceMonth);
  }

  useEffect(() => {
    return () => {
      reconcileRunIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const categoriesQuery = useCategories("expense");
  const expensesQuery = useCardExpenses(card.id);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportStatementExpenses();
  const updateExpenseMutation = useUpdateExpense();
  const createRefundMutation = useCreateRefund();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const defaultCategoryId = categories[0]?.id ?? "";
  const resolvedUserId = userId ?? getActiveUserId();

  const existingExpensesForReconciliation = useMemo(
    () => mapExpensesForReconciliation(expensesQuery.data ?? [], activeCompetenceMonth),
    [expensesQuery.data, activeCompetenceMonth],
  );

  const applyReconciliation = (
    transactions: Parameters<typeof runStatementReconciliation>[0]["transactions"],
    meta?: {
      usedAiStructurer?: boolean;
      printedTotalCents?: number | null;
      detectedMeta?: DetectedStatementMetadata | null;
      competenceForReconciliation?: string;
    },
  ) => {
    const runId = ++reconcileRunIdRef.current;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    manuallyEditedIdsRef.current.clear();
    setPendingLinkAdjustments(new Map());

    if (meta?.usedAiStructurer !== undefined) {
      setUsedAiStructurer(meta.usedAiStructurer);
    }
    if (meta?.printedTotalCents !== undefined) {
      setPrintedTotalCents(meta.printedTotalCents);
    }
    if (meta?.detectedMeta !== undefined) {
      setDetectedMeta(meta.detectedMeta);
    }

    const compForRecon = meta?.competenceForReconciliation ?? activeCompetenceMonth;
    const existingExpenses = meta?.competenceForReconciliation
      ? mapExpensesForReconciliation(expensesQuery.data ?? [], meta.competenceForReconciliation)
      : existingExpensesForReconciliation;

    const history = historyQuery.entries ?? [];
    const reconciliation = runStatementReconciliation({
      transactions,
      existingExpenses,
      history,
      defaultCategoryId,
    });

    // Detecta estados de séries de parcelamento
    const itemsWithSeries = reconciliation.items.map((item) => {
      const inst = item.transaction.installment;
      if (inst && inst.total > 1) {
        const seriesAnalysis = detectInstallmentSeriesState({
          transaction: item.transaction,
          competenceMonth: compForRecon,
          existingExpenses,
          cardScope: card.scope,
        });
        const canProject =
          seriesAnalysis !== null &&
          seriesAnalysis.state !== "state_4_already_projected" &&
          seriesAnalysis.missingFutureInstallments.length > 0;
        return {
          ...item,
          seriesAnalysis,
          projectSeries: canProject,
        };
      }
      return item;
    });

    const userMemory = getMerchantLearningMemory();
    const unknownMerchantImpact = new Map<
      string,
      { cleanText: string; totalAmountCents: number }
    >();

    // Camadas 1, 2 e 3 locais (histórico + memória aprendida + catálogo canônico/keywords = 0 tokens)
    const preResolvedItems = itemsWithSeries.map((item) => {
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

    reconciledItemsRef.current = preResolvedItems;
    unmatchedAppExpensesRef.current = reconciliation.unmatchedExistingExpenses;
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

    // Camada 4 silenciosa em background (Micro-IA: categorize_batch deduplicada)
    void (async () => {
      const allowedIds = new Set(categories.map((c) => c.id));
      const suggestionByNormalizedKey = new Map<
        string,
        { friendlyName: string; categoryId: string }
      >();

      try {
        for (const batch of batches) {
          if (reconcileRunIdRef.current !== runId || abortController.signal.aborted) return;

          // Mapeia itens válidos com sanitização estrita (zero PII, zero valores, zero datas, máx 80 chars)
          const sanitizedBatch = batch
            .map(([key, entry]) => ({
              key,
              originalCleanText: entry.cleanText,
              sanitizedText: sanitizeDescriptionForStatementMicroAi(entry.cleanText),
            }))
            .filter((item) => item.sanitizedText.length > 0);

          if (sanitizedBatch.length === 0) continue;

          const aiResult = await categorizeDescriptionsBatchWithAi({
            descriptions: sanitizedBatch.map((s) => s.sanitizedText),
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
            userId: resolvedUserId,
            isReadOnlyMode,
            featureEnabled: aiExtractionEnabled,
            signal: abortController.signal,
          });

          if (!aiResult.ok || reconcileRunIdRef.current !== runId || abortController.signal.aborted) {
            break;
          }

          for (const entry of aiResult.data.items) {
            const sourceTuple = sanitizedBatch[entry.index];
            if (!sourceTuple) continue;

            if (entry.categoryId && allowedIds.has(entry.categoryId)) {
              suggestionByNormalizedKey.set(sourceTuple.key, {
                friendlyName:
                  entry.canonicalMerchant || entry.friendlyName || sourceTuple.originalCleanText,
                categoryId: entry.categoryId,
              });
            }
          }
        }

        if (
          suggestionByNormalizedKey.size === 0 ||
          reconcileRunIdRef.current !== runId ||
          abortController.signal.aborted
        ) {
          return;
        }

        // Re-scoring incremental pós-IA + Hidratação protegendo dirtyFields
        let currentUnmatched = [...unmatchedAppExpensesRef.current];
        let hadAnyPromotion = false;

        const updatedItems = reconciledItemsRef.current.map((it) => {
          // Preserva estritamente itens tocados pelo usuário ou que não são unmatched_new
          if (manuallyEditedIdsRef.current.has(it.transaction.id) || it.status !== "unmatched_new") {
            return it;
          }

          const cleanTrimmed = it.transaction.cleanDescription.trim().toLowerCase();
          const rawTrimmed = it.transaction.rawDescription.trim().toLowerCase();
          const suggestion =
            suggestionByNormalizedKey.get(cleanTrimmed) ||
            suggestionByNormalizedKey.get(rawTrimmed);

          if (!suggestion) return it;

          const updatedTx: StatementTransaction = {
            ...it.transaction,
            cleanDescription: suggestion.friendlyName || it.transaction.cleanDescription,
          };

          let bestMatch: ExistingExpenseForReconciliation | null = null;
          let bestScore = -1;

          for (const existing of currentUnmatched) {
            if (existing.statementHash && existing.statementHash === updatedTx.statementHash) {
              bestMatch = existing;
              bestScore = 100;
              break;
            }

            const score = calculateMatchScore(updatedTx, existing, {
              predictedCategoryId: suggestion.categoryId,
              cardScope: card.scope,
            });

            if (score > bestScore) {
              bestScore = score;
              bestMatch = existing;
            }
          }

          // 1. Promoção a Match Exato (score >= 75 E valor idêntico)
          if (bestMatch && bestScore >= 75 && bestMatch.valueCents === updatedTx.amountCents) {
            hadAnyPromotion = true;
            currentUnmatched = currentUnmatched.filter((e) => e.id !== bestMatch!.id);
            return {
              ...it,
              status: "exact_match" as const,
              score: bestScore,
              matchedExpenseId: bestMatch.id,
              matchedExpenseDescription: bestMatch.description,
              matchedExpenseDate: bestMatch.date,
              matchedExpenseValueCents: bestMatch.valueCents,
              suggestedCategoryId: bestMatch.categoryId,
              selectedCategoryId: bestMatch.categoryId,
              selected: false,
              suggestedAction: "link_existing" as const,
              transaction: updatedTx,
            };
          }

          // 2. Promoção a Match Provável (score >= 40)
          if (bestMatch && bestScore >= 40) {
            hadAnyPromotion = true;
            currentUnmatched = currentUnmatched.filter((e) => e.id !== bestMatch!.id);
            const isCentDiff = bestMatch.valueCents !== updatedTx.amountCents;
            return {
              ...it,
              status: "probable_match" as const,
              score: bestScore,
              matchedExpenseId: bestMatch.id,
              matchedExpenseDescription: bestMatch.description,
              matchedExpenseDate: bestMatch.date,
              matchedExpenseValueCents: bestMatch.valueCents,
              suggestedCategoryId: bestMatch.categoryId,
              selectedCategoryId: bestMatch.categoryId,
              selected: false,
              suggestedAction: isCentDiff
                ? ("link_and_adjust_amount" as const)
                : ("link_existing" as const),
              transaction: updatedTx,
            };
          }

          // Sem match suficiente: mantém unmatched_new com nova categoria sugerida e nome limpo
          return {
            ...it,
            suggestedCategoryId: suggestion.categoryId,
            selectedCategoryId: suggestion.categoryId,
            transaction: updatedTx,
          };
        });

        if (reconcileRunIdRef.current !== runId || abortController.signal.aborted) {
          return;
        }

        reconciledItemsRef.current = updatedItems;
        setReconciledItems(updatedItems);

        if (hadAnyPromotion) {
          unmatchedAppExpensesRef.current = currentUnmatched;
          setUnmatchedAppExpenses(currentUnmatched);
        }
      } catch {
        // Degrada silenciosamente mantendo categoria fallback
      }
    })();
  };

  const handleProcessInput = async (
    content: string | ArrayBuffer,
    fileNameOrType: string,
    fileSha256?: string | null,
    spatialTransactions?: import("@/domain/reconciliation").StatementTransaction[],
    checksumGate?: import("@/domain/reconciliation").ChecksumGateResult,
  ) => {
    setError(null);
    loadedInputRef.current = { content, fileNameOrType, fileSha256 };
    try {
      const result = await parseStatementWithPdfAiFallback({
        content,
        fileNameOrType,
        cardId: card.id,
        competenceMonth: activeCompetenceMonth,
        card: {
          id: card.id,
          name: card.name,
          brand: card.brand,
          closing_day: card.closing_day,
          due_day: card.due_day,
          last_four_digits: card.last_four_digits,
        },
        fileSha256,
        userId: resolvedUserId,
        isReadOnlyMode,
        aiFallbackEnabled: aiExtractionEnabled,
        spatialTransactions,
        checksumGate,
      });

      if (result.transactions.length === 0 && result.rows.length === 0) {
        setError("Nenhuma linha de transação válida foi encontrada nos dados informados.");
        return;
      }

      setParsedRows(result.rows);
      setColumnMapping(result.mapping);
      setUsedAiStructurer(result.usedAiFallback);
      setPrintedTotalCents(result.printedTotalCents);
      setDetectedMeta(result.detectedMeta ?? null);

      const shouldAutoAdvance =
        result.isOfx ||
        result.usedAiFallback ||
        result.rows.length === 0 ||
        ((result.mapping.hasHeader ?? false) &&
          ((result.isCacheHit ?? false) || (result.mappingConfidence ?? 0) >= 85));

      if (shouldAutoAdvance) {
        applyReconciliation(result.transactions, {
          usedAiStructurer: result.usedAiFallback,
          printedTotalCents: result.printedTotalCents,
          detectedMeta: result.detectedMeta,
        });
      } else {
        setStep("mapping");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const processLoadedStatementSource = async (loaded: LoadedStatementSource) => {
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
          sha256: page === 1 && loaded.sha256 ? loaded.sha256 : undefined,
        });
      }

      loadedInputRef.current = {
        visionBlobs: pageBlobs,
        content: "",
        fileNameOrType: "scanned_pdf",
      };

      const scannedVision = await parseStatementVisionBlobsWithAi({
        blobs: pageBlobs,
        cardId: card.id,
        competenceMonth: activeCompetenceMonth,
        card: {
          id: card.id,
          name: card.name,
          brand: card.brand,
          closing_day: card.closing_day,
          due_day: card.due_day,
          last_four_digits: card.last_four_digits,
        },
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
      setDetectedMeta(scannedVision.detectedMeta ?? null);
      applyReconciliation(scannedVision.transactions, {
        usedAiStructurer: true,
        printedTotalCents: null,
        detectedMeta: scannedVision.detectedMeta,
      });
      return;
    }

    if (loaded.kind === "pdf_text") {
      await handleProcessInput(
        loaded.text,
        loaded.fileName,
        loaded.sha256,
        loaded.spatialTransactions,
        loaded.checksumGate,
      );
      return;
    }

    if (loaded.kind === "spreadsheet") {
      await handleProcessInput(loaded.buffer, loaded.fileName, null);
      return;
    }

    await handleProcessInput(loaded.content, loaded.fileName, null);
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

        loadedInputRef.current = {
          visionBlobs: blobsWithSha,
          content: "",
          fileNameOrType: "images",
        };

        const visionResult = await parseStatementVisionBlobsWithAi({
          blobs: blobsWithSha,
          cardId: card.id,
          competenceMonth: activeCompetenceMonth,
          card: {
            id: card.id,
            name: card.name,
            brand: card.brand,
            closing_day: card.closing_day,
            due_day: card.due_day,
            last_four_digits: card.last_four_digits,
          },
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
        setDetectedMeta(visionResult.detectedMeta ?? null);
        applyReconciliation(visionResult.transactions, {
          usedAiStructurer: true,
          printedTotalCents: null,
          detectedMeta: visionResult.detectedMeta,
        });
        return;
      }

      const primaryFile = files[0]!;
      let loaded: LoadedStatementSource;
      try {
        loaded = await readStatementFileContent(primaryFile, {
          cardId: card.id,
          competenceMonth: activeCompetenceMonth,
        });
      } catch (err: unknown) {
        if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
          setPendingPasswordFile(primaryFile);
          setPasswordError(null);
          return;
        }
        throw err;
      }

      await processLoadedStatementSource(loaded);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsReadingFile(false);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!pendingPasswordFile) return;
    setIsReadingFile(true);
    setPasswordError(null);

    try {
      const loaded = await readStatementFileContent(pendingPasswordFile, {
        cardId: card.id,
        competenceMonth: activeCompetenceMonth,
        password,
      });

      setPendingPasswordFile(null);
      setPasswordError(null);
      await processLoadedStatementSource(loaded);
    } catch (err: unknown) {
      if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
        setPasswordError("Senha incorreta. Verifique e tente novamente.");
      } else {
        setError(getErrorMessage(err));
        setPendingPasswordFile(null);
      }
    } finally {
      setIsReadingFile(false);
    }
  };

  const handlePasswordCancel = () => {
    setPendingPasswordFile(null);
    setPasswordError(null);
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

  const handleSwitchCompetence = async (newMonth: string) => {
    if (!newMonth || newMonth === activeCompetenceMonth) return;
    setActiveCompetenceMonth(newMonth);
    onCompetenceChange?.(newMonth);

    if (loadedInputRef.current) {
      setIsReadingFile(true);
      setError(null);
      try {
        if (loadedInputRef.current.visionBlobs?.length) {
          const visionResult = await parseStatementVisionBlobsWithAi({
            blobs: loadedInputRef.current.visionBlobs,
            cardId: card.id,
            competenceMonth: newMonth,
            card: {
              id: card.id,
              name: card.name,
              brand: card.brand,
              closing_day: card.closing_day,
              due_day: card.due_day,
              last_four_digits: card.last_four_digits,
            },
            userId: resolvedUserId,
            isReadOnlyMode,
            aiFallbackEnabled: aiExtractionEnabled,
          });

          setParsedRows(visionResult.rows);
          setColumnMapping(visionResult.mapping);
          setDetectedMeta(visionResult.detectedMeta ?? null);
          applyReconciliation(visionResult.transactions, {
            usedAiStructurer: true,
            printedTotalCents: visionResult.printedTotalCents,
            detectedMeta: visionResult.detectedMeta,
            competenceForReconciliation: newMonth,
          });
          return;
        }

        const result = await parseStatementWithPdfAiFallback({
          content: loadedInputRef.current.content,
          fileNameOrType: loadedInputRef.current.fileNameOrType,
          cardId: card.id,
          competenceMonth: newMonth,
          card: {
            id: card.id,
            name: card.name,
            brand: card.brand,
            closing_day: card.closing_day,
            due_day: card.due_day,
            last_four_digits: card.last_four_digits,
          },
          fileSha256: loadedInputRef.current.fileSha256,
          userId: resolvedUserId,
          isReadOnlyMode,
          aiFallbackEnabled: aiExtractionEnabled,
        });

        setParsedRows(result.rows);
        setColumnMapping(result.mapping);
        setUsedAiStructurer(result.usedAiFallback);
        setPrintedTotalCents(result.printedTotalCents);
        setDetectedMeta(result.detectedMeta ?? null);

        const shouldAutoAdvance =
          result.isOfx ||
          result.usedAiFallback ||
          result.rows.length === 0 ||
          ((result.mapping.hasHeader ?? false) &&
            ((result.isCacheHit ?? false) || (result.mappingConfidence ?? 0) >= 85));

        if (shouldAutoAdvance) {
          applyReconciliation(result.transactions, {
            usedAiStructurer: result.usedAiFallback,
            printedTotalCents: result.printedTotalCents,
            detectedMeta: result.detectedMeta,
            competenceForReconciliation: newMonth,
          });
        } else {
          setStep("mapping");
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsReadingFile(false);
      }
    }
  };

  const handleDismissCompetenceMismatch = () => {
    setDetectedMeta((prev) => (prev ? { ...prev, hasCompetenceMismatch: false } : null));
  };

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setError(null);
    if (parsedRows.length > 0 && parsedRows[0]?.cells?.length) {
      setCachedColumnMapping(parsedRows[0].cells, mapping);
    }
    try {
      applyReconciliation(
        buildTransactionsFromRows(parsedRows, mapping, { cardId: card.id, competenceMonth: activeCompetenceMonth }),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleToggleItem = (id: string) => {
    manuallyEditedIdsRef.current.add(id);
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    for (const it of reconciledItems) {
      manuallyEditedIdsRef.current.add(it.transaction.id);
    }
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

  const handleApplyCategoryBatch = (ids: string[], categoryId: string) => {
    for (const id of ids) {
      manuallyEditedIdsRef.current.add(id);
    }

    setReconciledItems((prev) =>
      prev.map((it) =>
        ids.includes(it.transaction.id) ? { ...it, selectedCategoryId: categoryId } : it,
      ),
    );

    const firstItem = reconciledItems.find((it) => ids.includes(it.transaction.id));
    if (firstItem && categoryId) {
      autoLearnExpenseCategory(
        firstItem.transaction.cleanDescription,
        categoryId,
        undefined,
        firstItem.transaction.rawDescription,
      );
    }

    triggerSensory("selection");
    pushToast({
      title: "Categoria propagada",
      description: `Categoria aplicada a ${ids.length} ${ids.length === 1 ? "compra" : "compras"}.`,
      variant: "default",
    });
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
          ? applyEditedReconciliationItem({
              cardId: card.id,
              competenceMonth: activeCompetenceMonth,
              current: it,
              updated,
            })
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
      createManualReconciliationItem({
        cardId: card.id,
        competenceMonth: activeCompetenceMonth,
        item,
        index: prev.length,
      }),
      ...prev,
    ]);
  };

  const { isBusinessModeEnabled } = useBusinessMode();

  const handleToggleScope = (id: string) => {
    manuallyEditedIdsRef.current.add(id);
    setReconciledItems((prev) =>
      prev.map((it) => {
        if (it.transaction.id !== id) return it;
        const current = it.scope ?? (card.scope === "business" ? "business" : "personal");
        const next = current === "business" ? "personal" : "business";
        return {
          ...it,
          scope: next,
          isTaxDeductible: next === "business" ? it.isTaxDeductible : false,
        };
      }),
    );
  };

  const handleSetScopeAll = (scope: "personal" | "business") => {
    setReconciledItems((prev) =>
      prev.map((it) => ({
        ...it,
        scope,
        isTaxDeductible: scope === "business" ? it.isTaxDeductible : false,
      })),
    );
  };

  const handleToggleProjectSeries = (id: string) => {
    manuallyEditedIdsRef.current.add(id);
    setReconciledItems((prev) =>
      prev.map((it) =>
        it.transaction.id === id ? { ...it, projectSeries: !(it.projectSeries ?? true) } : it,
      ),
    );
  };

  const handleLinkAndAdjust = (id: string) => {
    manuallyEditedIdsRef.current.add(id);
    const target = reconciledItems.find((it) => it.transaction.id === id);
    if (!target || !target.matchedExpenseId) return;

    const matchedCents = target.matchedExpenseValueCents ?? target.transaction.amountCents;
    const diffCents = target.transaction.amountCents - matchedCents;

    setReconciledItems((prev) =>
      prev.map((it) =>
        it.transaction.id === id
          ? {
              ...it,
              selected: false,
              isLinkedAndAdjusted: true,
              pendingAdjustmentDifferenceCents: diffCents,
            }
          : it,
      ),
    );

    setPendingLinkAdjustments((prev) => {
      const next = new Map(prev);
      next.set(id, {
        expenseId: target.matchedExpenseId!,
        newValueCents: target.transaction.amountCents,
        originalValueCents: matchedCents,
        differenceCents: diffCents,
        statementHash: target.transaction.statementHash,
      });
      return next;
    });

    triggerSensory("selection");
  };

  const handleCreateRefund = async (item: ReconciliationItem) => {
    manuallyEditedIdsRef.current.add(item.transaction.id);
    try {
      await createRefundMutation.mutateAsync({
        cardId: card.id,
        competenceMonth: activeCompetenceMonth,
        amount: Math.abs(item.transaction.amountCents) / 100,
        date: item.transaction.date,
        note: item.transaction.cleanDescription,
      });

      setReconciledItems((prev) =>
        prev.map((it) =>
          it.transaction.id === item.transaction.id
            ? { ...it, selected: false, ignoredByDefault: true }
            : it,
        ),
      );

      triggerSensory("success");
      pushToast({
        title: "Estorno registrado",
        description: `Estorno de ${(Math.abs(item.transaction.amountCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} lançado na fatura e receita gerada.`,
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar estorno",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
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
    const hasLinkedAdjustments = pendingLinkAdjustments.size > 0;
    if (toImport.length === 0 && !hasLinkedAdjustments) return;

    setError(null);
    try {
      // 1. Atualiza despesas existentes vinculadas com divergência de centavos
      if (hasLinkedAdjustments) {
        const adjustmentPromises = Array.from(pendingLinkAdjustments.values()).map((adj) =>
          updateExpenseMutation.mutateAsync({
            id: adj.expenseId,
            input: {
              value: adj.newValueCents / 100,
              statement_hash: adj.statementHash,
            },
          }),
        );
        const adjResults = await Promise.allSettled(adjustmentPromises);
        const rejected = adjResults.find((r) => r.status === "rejected");
        if (rejected && rejected.status === "rejected") {
          throw rejected.reason;
        }
      }

      // 2. Importa lançamentos selecionados da competência corrente
      let totalInserted = 0;
      let totalSkipped = 0;
      if (toImport.length > 0) {
        const result = await executeChunkedStatementImport({
          cardId: card.id,
          cardScope: card.scope,
          competenceMonth: activeCompetenceMonth,
          items: toImport,
          fallbackCategoryId: defaultCategoryId || categories[0]?.id || "",
          onProgress: setImportProgress,
          mutateChunk: (input) => importMutation.mutateAsync(input),
        });
        totalInserted = result.totalInserted;
        totalSkipped = result.totalSkipped;
      }

      // 3. Projeta parcelas futuras (K+1 .. N) agrupadas por competência
      const isBusinessCard = card.scope === "business";
      const seriesToProject: Array<{
        item: ReconciliationItem;
        projected: ReturnType<typeof projectFutureInstallments>;
      }> = [];

      for (const it of toImport) {
        if (
          it.projectSeries &&
          it.transaction.installment &&
          it.transaction.installment.total > it.transaction.installment.current
        ) {
          const itemScope = it.scope ?? (isBusinessCard ? "business" : "personal");
          const isBiz = itemScope === "business";
          const isDeductible = isBiz
            ? (it.isTaxDeductible ?? inferBusinessTaxDeductibility({ description: it.transaction.cleanDescription }).isDeductible)
            : false;

          const projected = projectFutureInstallments({
            currentInstallment: it.transaction.installment.current,
            totalInstallments: it.transaction.installment.total,
            installmentValueCents: it.transaction.amountCents,
            baseDate: it.transaction.date,
            baseCompetence: activeCompetenceMonth,
            description: it.transaction.cleanDescription,
            categoryId: it.selectedCategoryId || defaultCategoryId || categories[0]?.id || "",
            scope: itemScope,
            isTaxDeductible: isDeductible,
          });

          if (projected.length > 0) {
            seriesToProject.push({ item: it, projected });
          }
        }
      }

      if (seriesToProject.length > 0) {
        const projectionsByCompetence = new Map<string, ChunkedImportExpenseInput[]>();
        for (const { projected } of seriesToProject) {
          for (const p of projected) {
            const list = projectionsByCompetence.get(p.billCompetence) ?? [];
            list.push({
              date: p.date,
              value: p.valueCents / 100,
              category_id: p.categoryId,
              description: p.description,
              installments_total: p.installmentsTotal,
              installment_number: p.installmentNumber,
              report_weight: 1.0,
              statement_hash: undefined, // Sem statement_hash nas futuras para não conflitar com importações reais subsequentes
              charge_kind: "installment",
              scope: p.scope ?? (isBusinessCard ? "business" : "personal"),
              ...(p.isTaxDeductible ? { is_tax_deductible: true } : {}),
            });
            projectionsByCompetence.set(p.billCompetence, list);
          }
        }

        for (const [futureCompetence, futureExpenses] of projectionsByCompetence.entries()) {
          const chunks = chunkArray(futureExpenses, STATEMENT_IMPORT_CHUNK_SIZE);
          for (const chunk of chunks) {
            await importMutation.mutateAsync({
              cardId: card.id,
              competenceMonth: futureCompetence,
              expenses: chunk,
            });
          }
        }
      }

      // 4. Salva cache declarativo de colunas se houver cabeçalhos
      if (columnMapping && parsedRows.length > 0 && parsedRows[0]?.cells?.length) {
        setCachedColumnMapping(parsedRows[0].cells, columnMapping);
      }

      // 5. Precedência Humana: grava em merchant-learning apenas o que foi confirmado pelo usuário
      for (const it of toImport) {
        if (it.selectedCategoryId) {
          autoLearnExpenseCategory(
            it.transaction.cleanDescription,
            it.selectedCategoryId,
            undefined,
            it.transaction.rawDescription,
          );
        }
      }

      triggerSensory("success");
      const totalAdjusted = pendingLinkAdjustments.size;
      const futureCount = seriesToProject.reduce((acc, s) => acc + s.projected.length, 0);

      pushToast({
        variant: "default",
        title: `Fatura importada com sucesso: ${totalInserted} ${
          totalInserted === 1 ? "lançamento criado" : "lançamentos criados"
        }${totalSkipped > 0 ? ` (${totalSkipped} duplicatas ignoradas)` : ""}${
          totalAdjusted > 0 ? ` · ${totalAdjusted} despesa(s) vinculada(s)` : ""
        }${
          futureCount > 0 ? ` · ${futureCount} parcelas futuras projetadas` : ""
        }.`,
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
    activeCompetenceMonth,
    detectedMeta,
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
    pendingPasswordFile,
    passwordError,
    canOpenMapping: parsedRows.length > 0,
    isPending:
      importMutation.isPending || updateExpenseMutation.isPending || importProgress !== null,
    handleFileSelect,
    handleFilesSelect,
    handleTextSubmit,
    handlePasswordSubmit,
    handlePasswordCancel,
    handleConfirmMapping,
    handleSwitchCompetence,
    handleDismissCompetenceMismatch,
    handleToggleItem,
    handleToggleAll,
    handleChangeCategory,
    handleApplyCategoryBatch,
    handleEditItem,
    handleRemoveItem,
    handleAddManualItem,
    handleUncheckDuplicates,
    isBusinessModeEnabled,
    handleToggleScope,
    handleSetScopeAll,
    handleToggleProjectSeries,
    handleLinkAndAdjust,
    handleCreateRefund,
    handleConfirmImport,
  };
}
