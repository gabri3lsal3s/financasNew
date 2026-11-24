import { useEffect, useMemo, useRef, useState } from "react";
import { inferBusinessTaxDeductibility } from "@/domain/business";
import {
  matchCategoryBySlug,
  resolveMerchantIdentity,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import {
  buildClipperLinePreviews,
  buildTransactionsFromRows,
  calculateMatchScore,
  chunkArray,
  detectInstallmentSeriesState,
  detectStatementMetadata,
  distillStatementBlueprintDraft,
  evaluateStatementExtractionQuality,
  extractStatementSummaryAmounts,
  findAppDuplicateCandidates,
  generateStatementHash,
  projectFutureInstallments,
  predictCategoryForDescription,
  STATEMENT_IMPORT_CHUNK_SIZE,
  validateBlueprintWithShadowReplay,
  type AppDuplicateCandidate,
  type BlueprintOrigin,
  type ChecksumGateResult,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type PendingLinkAdjustment,
  type RawParsedRow,
  type ReconciliationItem,
  type StatementQualityGateResult,
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
import { saveStatementBlueprint } from "@/services/statement-blueprint-store";
import {
  extractHeaderCellsForCache,
  setCachedColumnMapping,
} from "@/services/statement-mapping-cache";
import { pushToast } from "@/services/toast";
import { getActiveUserId } from "@/services/user-storage";
import {
  useBusinessMode,
  useCardExpenses,
  useCategories,
  useCreateRefund,
  useDeleteExpense,
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
  isRasterStatementImageByContent,
  mapAdjacentExpensesForReconciliation,
  mapExpensesForReconciliation,
  parseStatementVisionBlobsWithAi,
  parseStatementWithPdfAiFallback,
  readStatementFileContent,
  runStatementReconciliation,
  sanitizeDescriptionForStatementMicroAi,
  selectCandidatePdfVisionPages,
  shouldPreferAiCandidateByQuality,
  type ChunkedImportExpenseInput,
  type DraftStatementBlueprintSession,
  type LoadedStatementSource,
  type StatementAiStatusNotice,
  type StatementExtractionOrigin,
  type StatementItemPatch,
  type VisionEscalationOffer,
} from "./statement-import-helpers";
import type { StatementBlockClipperSelection } from "./statement-block-clipper-step";
import type { StatementImportProgress } from "./statement-reconcile-step";

export type StatementWizardStep =
  | "upload"
  | "competence_conflict"
  | "mapping"
  | "block_clipper"
  | "reconcile";

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
  const [appDuplicates, setAppDuplicates] = useState<AppDuplicateCandidate[]>([]);
  const [pendingLinkAdjustments, setPendingLinkAdjustments] = useState<
    Map<string, PendingLinkAdjustment>
  >(new Map());
  const [pendingPasswordFile, setPendingPasswordFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [readingStatusMessage, setReadingStatusMessage] = useState<string | null>(null);
  const [isReanalyzingWithAi, setIsReanalyzingWithAi] = useState(false);
  const [usedAiStructurer, setUsedAiStructurer] = useState(false);
  const [extractionOrigin, setExtractionOrigin] = useState<StatementExtractionOrigin | null>(null);
  const [qualityGate, setQualityGate] = useState<StatementQualityGateResult | null>(null);
  const [aiStatusNotice, setAiStatusNotice] = useState<StatementAiStatusNotice | null>(null);
  const [visionEscalationOffer, setVisionEscalationOffer] = useState<VisionEscalationOffer | null>(null);
  const [clipperRawLines, setClipperRawLines] = useState<string[]>([]);
  const [clipperReasonMessage, setClipperReasonMessage] = useState<string | null>(null);
  const [printedTotalCents, setPrintedTotalCents] = useState<number | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<DetectedStatementMetadata | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasLoadedInput, setHasLoadedInput] = useState(false);

  const reconcileRunIdRef = useRef(0);
  const reanalyzeNonceRef = useRef(0);
  const autoVisionEscalatedRef = useRef(false);
  const pdfPasswordRef = useRef<string | null>(null);
  const draftBlueprintRef = useRef<DraftStatementBlueprintSession | null>(null);
  const manuallyEditedIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingConflictRef = useRef<{
    transactions: import("@/domain/reconciliation").StatementTransaction[];
    usedAiStructurer: boolean;
    extractionOrigin?: StatementExtractionOrigin | null;
    qualityGate?: StatementQualityGateResult | null;
    aiStatusNotice?: StatementAiStatusNotice | null;
    printedTotalCents: number | null;
    detectedMeta?: DetectedStatementMetadata | null;
    shouldAutoAdvance: boolean;
  } | null>(null);
  const reconciledItemsRef = useRef<ReconciliationItem[]>([]);
  const unmatchedAppExpensesRef = useRef<ExistingExpenseForReconciliation[]>([]);
  const loadedInputRef = useRef<{
    content: string | ArrayBuffer;
    rawFullText?: string;
    pdfBuffer?: ArrayBuffer;
    pdfPageTexts?: string[];
    pdfTotalPages?: number;
    fileNameOrType: string;
    fileSha256?: string | null;
    visionBlobs?: readonly { blob: Blob; sha256?: string | null }[];
    spatialTransactions?: StatementTransaction[];
    checksumGate?: ChecksumGateResult;
    spatialLinesCount?: number;
    discardedMoneyLines?: number;
    spatialRawLines?: string[];
    extractedTransactions?: StatementTransaction[];
    usedAiStructurer?: boolean;
    extractionOrigin?: StatementExtractionOrigin;
    qualityGate?: StatementQualityGateResult;
    aiStatusNotice?: StatementAiStatusNotice;
    printedTotalCents?: number | null;
    rows?: RawParsedRow[];
    mapping?: ColumnMapping;
    shouldAutoAdvance?: boolean;
    sourceCompetenceMonth?: string;
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
      draftBlueprintRef.current = null;
      pdfPasswordRef.current = null;
      abortControllerRef.current?.abort();
    };
  }, []);

  const categoriesQuery = useCategories("expense");
  const expensesQuery = useCardExpenses(card.id);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportStatementExpenses();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();
  const createRefundMutation = useCreateRefund();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const defaultCategoryId = categories[0]?.id ?? "";
  const resolvedUserId = userId ?? getActiveUserId();

  const existingExpensesForReconciliation = useMemo(
    () => mapExpensesForReconciliation(expensesQuery.data ?? [], activeCompetenceMonth),
    [expensesQuery.data, activeCompetenceMonth],
  );
  const adjacentExpensesForReconciliation = useMemo(
    () => mapAdjacentExpensesForReconciliation(expensesQuery.data ?? [], activeCompetenceMonth),
    [expensesQuery.data, activeCompetenceMonth],
  );

  const applyReconciliation = (
    transactions: Parameters<typeof runStatementReconciliation>[0]["transactions"],
    meta?: {
      usedAiStructurer?: boolean;
      extractionOrigin?: StatementExtractionOrigin | null;
      qualityGate?: StatementQualityGateResult | null;
      aiStatusNotice?: StatementAiStatusNotice | null;
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
    setHasUnsavedChanges(false);

    if (meta?.usedAiStructurer !== undefined) {
      setUsedAiStructurer(meta.usedAiStructurer);
    }
    if (meta?.extractionOrigin !== undefined) {
      setExtractionOrigin(meta.extractionOrigin);
    }
    if (meta?.qualityGate !== undefined) {
      setQualityGate(meta.qualityGate);
    }
    if (meta?.aiStatusNotice !== undefined) {
      setAiStatusNotice(meta.aiStatusNotice);
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
    const adjacentExpenses = meta?.competenceForReconciliation
      ? mapAdjacentExpensesForReconciliation(expensesQuery.data ?? [], meta.competenceForReconciliation)
      : adjacentExpensesForReconciliation;

    const history = historyQuery.entries ?? [];
    const reconciliation = runStatementReconciliation({
      transactions,
      existingExpenses,
      adjacentExpenses,
      history,
      defaultCategoryId,
      cardScope: card.scope,
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
    setAppDuplicates(reconciliation.appDuplicates ?? []);
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
    spatialTransactions?: StatementTransaction[],
    checksumGate?: ChecksumGateResult,
    spatialExtras?: {
      spatialLinesCount?: number;
      discardedMoneyLines?: number;
      spatialRawLines?: string[];
      rawFullText?: string;
      pdfBuffer?: ArrayBuffer;
      pdfPageTexts?: string[];
      pdfTotalPages?: number;
      appliedBlueprintFingerprint?: string;
      appliedBlueprintOrigin?: BlueprintOrigin;
      skipVisionEscalation?: boolean;
    },
  ) => {
    setError(null);
    setVisionEscalationOffer(null);
    setAiStatusNotice(null);
    draftBlueprintRef.current = null;
    setHasLoadedInput(true);
    loadedInputRef.current = {
      content,
      rawFullText: spatialExtras?.rawFullText,
      pdfBuffer: spatialExtras?.pdfBuffer,
      pdfPageTexts: spatialExtras?.pdfPageTexts,
      pdfTotalPages: spatialExtras?.pdfTotalPages,
      fileNameOrType,
      fileSha256,
      spatialTransactions,
      checksumGate,
      spatialLinesCount: spatialExtras?.spatialLinesCount,
      discardedMoneyLines: spatialExtras?.discardedMoneyLines,
      spatialRawLines: spatialExtras?.spatialRawLines,
      sourceCompetenceMonth: activeCompetenceMonth,
    };
    try {
      let result = await parseStatementWithPdfAiFallback({
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
        spatialLinesCount: spatialExtras?.spatialLinesCount,
        discardedMoneyLines: spatialExtras?.discardedMoneyLines,
        spatialRawLines: spatialExtras?.spatialRawLines,
        rawFullText: spatialExtras?.rawFullText,
        appliedBlueprintFingerprint: spatialExtras?.appliedBlueprintFingerprint,
        appliedBlueprintOrigin: spatialExtras?.appliedBlueprintOrigin,
      });

      // Camada 3B — Escalada Vision Governada para PDFs cujo Quality Gate ainda reprovou
      const hasPdfBuffer = Boolean(spatialExtras?.pdfBuffer);
      const gateFailed = result.qualityGate
        ? !result.qualityGate.passed
        : result.transactions.length === 0;
      const blockedByQuotaOrOffline =
        result.aiStatusNotice?.kind === "quota_exceeded" ||
        result.aiStatusNotice?.kind === "offline" ||
        isReadOnlyMode ||
        !aiExtractionEnabled ||
        (typeof navigator !== "undefined" && navigator.onLine === false);

      let pendingOffer: VisionEscalationOffer | null = null;
      if (
        hasPdfBuffer &&
        gateFailed &&
        !blockedByQuotaOrOffline &&
        !spatialExtras?.skipVisionEscalation
      ) {
        const candidatePages = selectCandidatePdfVisionPages(
          spatialExtras?.pdfPageTexts ?? [],
          spatialExtras?.pdfTotalPages,
        );
        const totalPages = Math.max(
          spatialExtras?.pdfTotalPages ?? 1,
          spatialExtras?.pdfPageTexts?.length ?? 1,
        );

        if (candidatePages.length === 1 && !autoVisionEscalatedRef.current) {
          // Máximo 1 escalada automática por arquivo (somente quando há 1 página de extrato)
          autoVisionEscalatedRef.current = true;
          setReadingStatusMessage("Refinando leitura visual com IA...");
          try {
            const { renderScannedPdfPageToBlob } = await import(
              "@/services/native/receipt-extractor"
            );
            const blob = await renderScannedPdfPageToBlob(
              spatialExtras!.pdfBuffer!,
              candidatePages[0]!,
              { password: pdfPasswordRef.current ?? undefined },
            );
            if (blob) {
              const visionRes = await parseStatementVisionBlobsWithAi({
                blobs: [{ blob, sha256: fileSha256 }],
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
                officialTotalCents: result.printedTotalCents,
              });

              if (visionRes.aiStatusNotice) {
                result = { ...result, aiStatusNotice: visionRes.aiStatusNotice };
              }
              if (
                visionRes.transactions.length > 0 &&
                (!result.qualityGate ||
                  !visionRes.qualityGate ||
                  shouldPreferAiCandidateByQuality({
                    aiTransactionsCount: visionRes.transactions.length,
                    aiQuality: visionRes.qualityGate,
                    localQuality: result.qualityGate,
                  }))
              ) {
                result = visionRes;
              }
            }
          } catch {
            // Degrada silenciosamente mantendo o melhor resultado textual já obtido
          } finally {
            setReadingStatusMessage(null);
          }
        } else if (candidatePages.length > 1) {
          // 2 a 3 páginas: exige confirmação inline explícita antes de consumir múltiplos créditos Vision
          pendingOffer = {
            candidatePages,
            totalPages,
            reason:
              "A leitura textual apresentou divergência e o documento possui múltiplas páginas de extrato.",
          };
        }
      }

      if (result.aiStatusNotice) {
        setAiStatusNotice(result.aiStatusNotice);
      }
      if (pendingOffer) {
        setVisionEscalationOffer(pendingOffer);
      }
      // Mantém rascunho em memória na sessão (NÃO persiste ainda — só no commit após Shadow Replay)
      draftBlueprintRef.current = result.draftBlueprint ?? null;

      // Extrai linhas brutas para eventual uso na Camada 5 (Recorte Guiado Sem Tokens)
      const rawTextForClipper =
        spatialExtras?.rawFullText ??
        (typeof content === "string"
          ? content
          : new TextDecoder("utf-8", { fatal: false }).decode(content));
      const rawLinesForClipper =
        spatialExtras?.spatialRawLines && spatialExtras.spatialRawLines.length > 0
          ? spatialExtras.spatialRawLines
          : rawTextForClipper
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
      setClipperRawLines(rawLinesForClipper);

      // Camada 5: quando o Quality Gate reprova e a IA não está disponível
      // (offline, quota_exceeded, sem permissão ou modo somente leitura), encaminha para o
      // passo inline `block_clipper` em vez de jogar linhas degradadas na Staging Area.
      const hasClipperCandidates =
        rawLinesForClipper.length > 0 &&
        buildClipperLinePreviews({
          rawLines: rawLinesForClipper,
          cardId: card.id,
          competenceMonth: activeCompetenceMonth,
        }).some((p) => p.isCandidate);

      if (
        gateFailed &&
        blockedByQuotaOrOffline &&
        !result.isOfx &&
        hasClipperCandidates
      ) {
        setParsedRows(result.rows);
        setColumnMapping(result.mapping);
        setUsedAiStructurer(false);
        setExtractionOrigin(result.extractionOrigin ?? "local_unverified");
        setQualityGate(result.qualityGate ?? null);
        setPrintedTotalCents(result.printedTotalCents);
        setDetectedMeta(result.detectedMeta ?? null);
        setClipperReasonMessage(
          result.aiStatusNotice?.message ??
            "A leitura automática apresentou divergência sem IA disponível. Marque o início e o fim das compras para importar com precisão e ensinar este layout ao app.",
        );
        setStep("block_clipper");
        return;
      }

      if (result.transactions.length === 0 && result.rows.length === 0) {
        setError(
          result.aiStatusNotice?.kind === "quota_exceeded"
            ? result.aiStatusNotice.message
            : "Nenhuma linha de transação válida foi encontrada nos dados informados.",
        );
        return;
      }

      const shouldAutoAdvance =
        result.isOfx ||
        result.usedAiFallback ||
        result.rows.length === 0 ||
        ((result.mapping.hasHeader ?? false) &&
          ((result.isCacheHit ?? false) || (result.mappingConfidence ?? 0) >= 85));

      loadedInputRef.current = {
        ...loadedInputRef.current,
        extractedTransactions: result.transactions,
        usedAiStructurer: result.usedAiFallback,
        extractionOrigin: result.extractionOrigin,
        qualityGate: result.qualityGate,
        aiStatusNotice: result.aiStatusNotice,
        printedTotalCents: result.printedTotalCents,
        rows: result.rows,
        mapping: result.mapping,
        shouldAutoAdvance,
      };

      setParsedRows(result.rows);
      setColumnMapping(result.mapping);
      setUsedAiStructurer(result.usedAiFallback);
      setExtractionOrigin(result.extractionOrigin ?? null);
      setQualityGate(result.qualityGate ?? null);
      setPrintedTotalCents(result.printedTotalCents);
      setDetectedMeta(result.detectedMeta ?? null);

      // Se houver divergência real de competência, pausa antes de montar a Staging Area
      if (
        result.detectedMeta?.hasCompetenceMismatch &&
        result.detectedMeta.detectedCompetenceMonth
      ) {
        pendingConflictRef.current = {
          transactions: result.transactions,
          usedAiStructurer: result.usedAiFallback,
          extractionOrigin: result.extractionOrigin ?? null,
          qualityGate: result.qualityGate ?? null,
          aiStatusNotice: result.aiStatusNotice ?? null,
          printedTotalCents: result.printedTotalCents,
          detectedMeta: result.detectedMeta,
          shouldAutoAdvance,
        };
        setStep("competence_conflict");
        return;
      }

      if (shouldAutoAdvance) {
        applyReconciliation(result.transactions, {
          usedAiStructurer: result.usedAiFallback,
          extractionOrigin: result.extractionOrigin ?? null,
          qualityGate: result.qualityGate ?? null,
          aiStatusNotice: result.aiStatusNotice ?? null,
          printedTotalCents: result.printedTotalCents,
          detectedMeta: result.detectedMeta,
        });
      } else {
        setStep("mapping");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReadingStatusMessage(null);
    }
  };

  const processLoadedStatementSource = async (loaded: LoadedStatementSource) => {
    autoVisionEscalatedRef.current = false;
    draftBlueprintRef.current = null;
    setVisionEscalationOffer(null);
    setAiStatusNotice(null);

    if (loaded.kind === "image") {
      const blobsWithSha = [{ blob: loaded.file, sha256: loaded.sha256 }];
      setHasLoadedInput(true);
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

      if (visionResult.aiStatusNotice) {
        setAiStatusNotice(visionResult.aiStatusNotice);
      }

      if (visionResult.transactions.length === 0) {
        setError(
          visionResult.aiStatusNotice?.kind === "quota_exceeded"
            ? visionResult.aiStatusNotice.message
            : "Não foi possível extrair lançamentos das imagens enviadas. Verifique a nitidez do print ou utilize o arquivo PDF, CSV ou OFX da fatura.",
        );
        return;
      }

      setParsedRows(visionResult.rows);
      setColumnMapping(visionResult.mapping);
      setDetectedMeta(visionResult.detectedMeta ?? null);
      applyReconciliation(visionResult.transactions, {
        usedAiStructurer: true,
        extractionOrigin: visionResult.extractionOrigin ?? "ai_vision",
        qualityGate: visionResult.qualityGate ?? null,
        aiStatusNotice: visionResult.aiStatusNotice ?? null,
        printedTotalCents: visionResult.printedTotalCents,
        detectedMeta: visionResult.detectedMeta,
      });
      return;
    }

    if (loaded.kind === "pdf_scanned") {
      const { renderScannedPdfPageToBlob } = await import(
        "@/services/native/receipt-extractor"
      );
      const pageBlobs: Array<{ blob: Blob; sha256?: string | null }> = [];
      for (let page = 1; page <= MAX_STATEMENT_VISION_PAGES_OR_IMAGES; page++) {
        const blob = await renderScannedPdfPageToBlob(loaded.buffer, page, {
          password: pdfPasswordRef.current ?? undefined,
        });
        if (!blob) break;
        pageBlobs.push({
          blob,
          sha256: page === 1 && loaded.sha256 ? loaded.sha256 : undefined,
        });
      }

      // Degradação graciosa: se não foi possível renderizar páginas em canvas (ex.: PDF híbrido curto
      // ou ambiente sem canvas 2D), mas existe texto extraído, cai para o pipeline textual.
      if (pageBlobs.length === 0 && loaded.fallbackRawText?.trim()) {
        await handleProcessInput(
          loaded.fallbackRawText,
          loaded.fileName,
          loaded.sha256,
          undefined,
          undefined,
          {
            rawFullText: loaded.fallbackRawText,
            pdfBuffer: loaded.buffer,
            pdfPageTexts: loaded.pdfPageTexts,
            pdfTotalPages: loaded.pdfTotalPages,
            skipVisionEscalation: true,
          },
        );
        return;
      }

      setHasLoadedInput(true);
      loadedInputRef.current = {
        visionBlobs: pageBlobs,
        pdfBuffer: loaded.buffer,
        pdfPageTexts: loaded.pdfPageTexts,
        pdfTotalPages: loaded.pdfTotalPages,
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

      if (scannedVision.aiStatusNotice) {
        setAiStatusNotice(scannedVision.aiStatusNotice);
      }

      if (scannedVision.transactions.length === 0) {
        setError(
          scannedVision.aiStatusNotice?.kind === "quota_exceeded"
            ? scannedVision.aiStatusNotice.message
            : "Não foi possível extrair os dados da fatura em PDF. Se o arquivo estiver protegido por senha, desbloqueie-o ou exporte em CSV/OFX.",
        );
        return;
      }

      loadedInputRef.current = {
        ...loadedInputRef.current,
        content: "",
        fileNameOrType: "scanned_pdf",
        extractedTransactions: scannedVision.transactions,
        usedAiStructurer: true,
        extractionOrigin: scannedVision.extractionOrigin ?? "ai_vision",
        qualityGate: scannedVision.qualityGate,
        aiStatusNotice: scannedVision.aiStatusNotice,
        printedTotalCents: scannedVision.printedTotalCents,
        rows: scannedVision.rows,
        mapping: scannedVision.mapping,
        shouldAutoAdvance: true,
        sourceCompetenceMonth: activeCompetenceMonth,
      };

      setParsedRows(scannedVision.rows);
      setColumnMapping(scannedVision.mapping);
      setDetectedMeta(scannedVision.detectedMeta ?? null);

      if (
        scannedVision.detectedMeta?.hasCompetenceMismatch &&
        scannedVision.detectedMeta.detectedCompetenceMonth
      ) {
        pendingConflictRef.current = {
          transactions: scannedVision.transactions,
          usedAiStructurer: true,
          extractionOrigin: scannedVision.extractionOrigin ?? "ai_vision",
          qualityGate: scannedVision.qualityGate ?? null,
          aiStatusNotice: scannedVision.aiStatusNotice ?? null,
          printedTotalCents: scannedVision.printedTotalCents,
          detectedMeta: scannedVision.detectedMeta,
          shouldAutoAdvance: true,
        };
        setStep("competence_conflict");
        return;
      }

      applyReconciliation(scannedVision.transactions, {
        usedAiStructurer: true,
        extractionOrigin: scannedVision.extractionOrigin ?? "ai_vision",
        qualityGate: scannedVision.qualityGate ?? null,
        aiStatusNotice: scannedVision.aiStatusNotice ?? null,
        printedTotalCents: scannedVision.printedTotalCents,
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
        {
          spatialLinesCount: loaded.spatialLinesCount,
          discardedMoneyLines: loaded.discardedMoneyLines,
          spatialRawLines: loaded.spatialRawLines,
          rawFullText: loaded.rawFullText,
          pdfBuffer: loaded.buffer,
          pdfPageTexts: loaded.pdfPageTexts,
          pdfTotalPages: loaded.pdfTotalPages,
          appliedBlueprintFingerprint: loaded.appliedBlueprintFingerprint,
          appliedBlueprintOrigin: loaded.appliedBlueprintOrigin,
        },
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
    setVisionEscalationOffer(null);
    setAiStatusNotice(null);
    draftBlueprintRef.current = null;
    pdfPasswordRef.current = null;
    autoVisionEscalatedRef.current = false;
    setIsReadingFile(true);

    try {
      const imageChecks = await Promise.all(
        files.map(async (f) => ({ file: f, isImage: await isRasterStatementImageByContent(f) })),
      );
      const imageFiles = imageChecks.filter((entry) => entry.isImage).map((entry) => entry.file);
      if (imageFiles.length > 0) {
        const limitedImages = imageFiles.slice(0, MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
        const blobsWithSha = await Promise.all(
          limitedImages.map(async (img) => ({
            blob: img,
            sha256: await computeFileSha256(img),
          })),
        );

        setHasLoadedInput(true);
        loadedInputRef.current = {
          visionBlobs: blobsWithSha,
          content: "",
          fileNameOrType: "images",
        };

        const visionResult = await parseStatementVisionBlobsWithAi({
          blobs: blobsWithSha,
          totalUploadedCount: imageFiles.length,
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

        if (visionResult.aiStatusNotice) {
          setAiStatusNotice(visionResult.aiStatusNotice);
        }

        if (visionResult.visionTruncationWarning) {
          pushToast({
            title: "Limite de imagens por lote",
            description: visionResult.visionTruncationWarning,
            variant: "default",
          });
        }

        if (visionResult.transactions.length === 0) {
          setError(
            visionResult.aiStatusNotice?.kind === "quota_exceeded"
              ? visionResult.aiStatusNotice.message
              : "Não foi possível extrair lançamentos das imagens enviadas. Verifique a nitidez do print ou utilize o arquivo PDF, CSV ou OFX da fatura.",
          );
          return;
        }

        loadedInputRef.current = {
          ...loadedInputRef.current,
          extractedTransactions: visionResult.transactions,
          usedAiStructurer: true,
          extractionOrigin: visionResult.extractionOrigin ?? "ai_vision",
          qualityGate: visionResult.qualityGate,
          aiStatusNotice: visionResult.aiStatusNotice,
          printedTotalCents: visionResult.printedTotalCents,
          rows: visionResult.rows,
          mapping: visionResult.mapping,
          shouldAutoAdvance: true,
          sourceCompetenceMonth: activeCompetenceMonth,
        };

        setParsedRows(visionResult.rows);
        setColumnMapping(visionResult.mapping);
        setDetectedMeta(visionResult.detectedMeta ?? null);
        applyReconciliation(visionResult.transactions, {
          usedAiStructurer: true,
          extractionOrigin: visionResult.extractionOrigin ?? "ai_vision",
          qualityGate: visionResult.qualityGate ?? null,
          aiStatusNotice: visionResult.aiStatusNotice ?? null,
          printedTotalCents: visionResult.printedTotalCents,
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

      pdfPasswordRef.current = password;
      setPendingPasswordFile(null);
      setPasswordError(null);
      await processLoadedStatementSource(loaded);
    } catch (err: unknown) {
      if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
        pdfPasswordRef.current = null;
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
    pdfPasswordRef.current = null;
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
    pendingConflictRef.current = null;

    const loaded = loadedInputRef.current;
    if (loaded) {
      setIsReadingFile(true);
      setError(null);
      try {
        const sameYear =
          (loaded.sourceCompetenceMonth?.slice(0, 4) ?? activeCompetenceMonth.slice(0, 4)) ===
          newMonth.slice(0, 4);

        // Reaproveita transações já extraídas (PDF espacial ou Vision IA) sem rebaixar ao text-parser nem chamar IA 2x
        if (loaded.extractedTransactions && loaded.extractedTransactions.length > 0 && sameYear) {
          const rehashedTransactions = loaded.extractedTransactions.map((tx) => ({
            ...tx,
            statementHash: generateStatementHash({
              cardId: card.id,
              competenceMonth: newMonth,
              date: tx.originalDate || tx.date,
              amountCents: tx.amountCents,
              cleanDescription: tx.cleanDescription,
              occurrenceIndex: tx.occurrenceIndex,
            }),
          }));

          const metadataRawText =
            loaded.rawFullText ?? (typeof loaded.content === "string" ? loaded.content : "");
          const refreshedMeta = detectStatementMetadata({
            rawText: metadataRawText,
            transactions: rehashedTransactions,
            activeCompetenceMonth: newMonth,
            card: {
              id: card.id,
              name: card.name,
              brand: card.brand,
              closing_day: card.closing_day,
              due_day: card.due_day,
              last_four_digits: card.last_four_digits,
            },
            printedTotalCents: loaded.printedTotalCents ?? null,
          });

          loadedInputRef.current = {
            ...loaded,
            extractedTransactions: rehashedTransactions,
            sourceCompetenceMonth: newMonth,
          };

          if (loaded.rows) setParsedRows(loaded.rows);
          if (loaded.mapping) setColumnMapping(loaded.mapping);
          setUsedAiStructurer(Boolean(loaded.usedAiStructurer));
          setPrintedTotalCents(loaded.printedTotalCents ?? null);
          setDetectedMeta(refreshedMeta);

          if (loaded.shouldAutoAdvance ?? true) {
            applyReconciliation(rehashedTransactions, {
              usedAiStructurer: Boolean(loaded.usedAiStructurer),
              printedTotalCents: loaded.printedTotalCents ?? null,
              detectedMeta: refreshedMeta,
              competenceForReconciliation: newMonth,
            });
          } else {
            setStep("mapping");
          }
          return;
        }

        if (loaded.visionBlobs?.length) {
          const visionResult = await parseStatementVisionBlobsWithAi({
            blobs: loaded.visionBlobs,
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
          content: loaded.content,
          fileNameOrType: loaded.fileNameOrType,
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
          fileSha256: loaded.fileSha256,
          userId: resolvedUserId,
          isReadOnlyMode,
          aiFallbackEnabled: aiExtractionEnabled,
          spatialTransactions: loaded.spatialTransactions,
          checksumGate: loaded.checksumGate,
          spatialLinesCount: loaded.spatialLinesCount,
          discardedMoneyLines: loaded.discardedMoneyLines,
          spatialRawLines: loaded.spatialRawLines,
          rawFullText: loaded.rawFullText,
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

  const handleConfirmKeepCurrentCompetence = () => {
    const pending = pendingConflictRef.current;
    pendingConflictRef.current = null;
    setDetectedMeta((prev) => (prev ? { ...prev, hasCompetenceMismatch: false } : null));
    if (!pending) {
      setStep("reconcile");
      return;
    }
    if (pending.shouldAutoAdvance) {
      applyReconciliation(pending.transactions, {
        usedAiStructurer: pending.usedAiStructurer,
        extractionOrigin: pending.extractionOrigin ?? null,
        qualityGate: pending.qualityGate ?? null,
        aiStatusNotice: pending.aiStatusNotice ?? null,
        printedTotalCents: pending.printedTotalCents,
        detectedMeta: pending.detectedMeta
          ? { ...pending.detectedMeta, hasCompetenceMismatch: false }
          : null,
      });
    } else {
      setStep("mapping");
    }
  };

  const handleCancelCompetenceConflict = () => {
    pendingConflictRef.current = null;
    loadedInputRef.current = null;
    draftBlueprintRef.current = null;
    setHasLoadedInput(false);
    setParsedRows([]);
    setColumnMapping(null);
    setDetectedMeta(null);
    setExtractionOrigin(null);
    setQualityGate(null);
    setAiStatusNotice(null);
    setVisionEscalationOffer(null);
    setError(null);
    setHasUnsavedChanges(false);
    setStep("upload");
  };

  const handleDismissVisionEscalation = () => {
    setVisionEscalationOffer(null);
  };

  const handleOpenBlockClipper = () => {
    setVisionEscalationOffer(null);
    if (!clipperReasonMessage) {
      setClipperReasonMessage(
        "Marque o início e o fim das compras abaixo e desmarque eventuais linhas intrusas.",
      );
    }
    setStep("block_clipper");
  };

  const handleConfirmBlockClipper = (selection: StatementBlockClipperSelection) => {
    const loaded = loadedInputRef.current;
    const rawText =
      loaded?.rawFullText ??
      clipperRawLines.join("\n");
    const summaryAmounts = extractStatementSummaryAmounts(rawText);
    const officialTotal = printedTotalCents ?? summaryAmounts.invoiceTotalCents;

    const clippedQuality = evaluateStatementExtractionQuality({
      transactions: selection.transactions,
      officialTotalCents: officialTotal,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
      previousBalanceCents: summaryAmounts.previousBalanceCents,
      paymentsCents: summaryAmounts.paymentsCents,
    });

    // Alimenta BlueprintLearner com origem `user_learned` em memória (NÃO salvo ainda — só no commit após Shadow Replay)
    const fileKind = (loaded?.fileNameOrType ?? "").toLowerCase().endsWith(".pdf")
      ? "pdf_text"
      : "text";
    const distilled = distillStatementBlueprintDraft({
      rawText,
      rawLines: clipperRawLines,
      extractedTransactions: selection.transactions,
      fileKind,
      fileName: loaded?.fileNameOrType,
      extractionSource: "user_manual",
      officialTotalCents: officialTotal,
      cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
    });

    draftBlueprintRef.current = distilled.blueprint
      ? {
          blueprint: distilled.blueprint,
          rawLines: clipperRawLines,
          officialTotalCents: officialTotal,
          cycleNetTargetCents: summaryAmounts.cycleNetTargetCents,
          previousBalanceCents: summaryAmounts.previousBalanceCents,
          paymentsCents: summaryAmounts.paymentsCents,
        }
      : null;

    const refreshedMeta = detectStatementMetadata({
      rawText,
      transactions: selection.transactions,
      activeCompetenceMonth,
      card: {
        id: card.id,
        name: card.name,
        brand: card.brand,
        closing_day: card.closing_day,
        due_day: card.due_day,
        last_four_digits: card.last_four_digits,
      },
      printedTotalCents: officialTotal,
    });

    if (loadedInputRef.current) {
      loadedInputRef.current = {
        ...loadedInputRef.current,
        extractedTransactions: selection.transactions,
        usedAiStructurer: false,
        extractionOrigin: clippedQuality.passed ? "local_verified" : "local_unverified",
        qualityGate: clippedQuality,
        printedTotalCents: officialTotal,
      };
    }

    setError(null);
    setDetectedMeta(refreshedMeta);
    applyReconciliation(selection.transactions, {
      usedAiStructurer: false,
      extractionOrigin: clippedQuality.passed ? "local_verified" : "local_unverified",
      qualityGate: clippedQuality,
      printedTotalCents: officialTotal,
      detectedMeta: refreshedMeta,
    });
  };

  const handleConfirmVisionEscalation = async () => {
    const offer = visionEscalationOffer;
    const loaded = loadedInputRef.current;
    if (!offer || !loaded?.pdfBuffer) {
      setVisionEscalationOffer(null);
      return;
    }

    setVisionEscalationOffer(null);
    setIsReanalyzingWithAi(true);
    setReadingStatusMessage(
      `Analisando visualmente ${offer.candidatePages.length} páginas com IA...`,
    );
    setError(null);

    try {
      const { renderScannedPdfPageToBlob } = await import(
        "@/services/native/receipt-extractor"
      );
      const pageBlobs: Array<{ blob: Blob; sha256?: string | null }> = [];
      for (const pageNum of offer.candidatePages) {
        const blob = await renderScannedPdfPageToBlob(loaded.pdfBuffer, pageNum, {
          password: pdfPasswordRef.current ?? undefined,
        });
        if (!blob) continue;
        pageBlobs.push({
          blob,
          sha256: loaded.fileSha256 ? `${loaded.fileSha256}:p${pageNum}` : undefined,
        });
      }

      if (pageBlobs.length === 0) {
        setAiStatusNotice({
          kind: "ai_unavailable",
          message:
            "Não foi possível renderizar as páginas deste PDF para leitura visual neste dispositivo.",
        });
        return;
      }

      const nonce = ++reanalyzeNonceRef.current;
      const visionResult = await parseStatementVisionBlobsWithAi({
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
        reanalyzeNonce: nonce,
        officialTotalCents: printedTotalCents,
      });

      if (visionResult.aiStatusNotice) {
        setAiStatusNotice(visionResult.aiStatusNotice);
      }

      if (visionResult.transactions.length === 0) {
        if (visionResult.aiStatusNotice?.kind === "quota_exceeded") {
          pushToast({
            title: "Limite de IA atingido",
            description: visionResult.aiStatusNotice.message,
            variant: "default",
          });
        } else {
          setError(
            "A leitura visual não encontrou lançamentos adicionais. Você pode revisar ou editar os itens manualmente.",
          );
        }
        return;
      }

      loadedInputRef.current = {
        ...loaded,
        visionBlobs: pageBlobs,
        extractedTransactions: visionResult.transactions,
        usedAiStructurer: true,
        extractionOrigin: "ai_vision",
        qualityGate: visionResult.qualityGate,
        aiStatusNotice: visionResult.aiStatusNotice,
        printedTotalCents: visionResult.printedTotalCents ?? printedTotalCents,
        rows: visionResult.rows,
        mapping: visionResult.mapping,
        shouldAutoAdvance: true,
      };

      setParsedRows(visionResult.rows);
      setColumnMapping(visionResult.mapping);
      setDetectedMeta(visionResult.detectedMeta ?? detectedMeta);
      applyReconciliation(visionResult.transactions, {
        usedAiStructurer: true,
        extractionOrigin: "ai_vision",
        qualityGate: visionResult.qualityGate ?? null,
        aiStatusNotice: visionResult.aiStatusNotice ?? null,
        printedTotalCents: visionResult.printedTotalCents ?? printedTotalCents,
        detectedMeta: visionResult.detectedMeta ?? detectedMeta,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsReanalyzingWithAi(false);
      setReadingStatusMessage(null);
    }
  };

  /**
   * Reanálise explícita sob demanda via botão "Reanalisar com IA" (Item #8):
   * Usa salt determinístico `${baseSha}:reanalyze:${nonce}` (SHA-256 64-hex válido)
   * para contornar cache remoto sem exigir deploy na Edge Function.
   */
  const handleReanalyzeWithAi = async () => {
    const loaded = loadedInputRef.current;
    if (!loaded || isReanalyzingWithAi) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAiStatusNotice({
        kind: "offline",
        message: "Sem conexão no momento. Conecte-se à internet para reanalisar com IA.",
      });
      return;
    }

    if (isReadOnlyMode || !aiExtractionEnabled) {
      setAiStatusNotice({
        kind: "ai_unavailable",
        message: "A análise por IA está indisponível neste modo.",
      });
      return;
    }

    const nonce = ++reanalyzeNonceRef.current;
    setIsReanalyzingWithAi(true);
    setReadingStatusMessage("Reanalisando fatura com IA...");
    setError(null);
    setVisionEscalationOffer(null);

    try {
      if (loaded.visionBlobs?.length) {
        const visionResult = await parseStatementVisionBlobsWithAi({
          blobs: loaded.visionBlobs,
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
          reanalyzeNonce: nonce,
          officialTotalCents: printedTotalCents,
        });

        if (visionResult.aiStatusNotice) {
          setAiStatusNotice(visionResult.aiStatusNotice);
        }

        if (visionResult.transactions.length > 0) {
          loadedInputRef.current = {
            ...loaded,
            extractedTransactions: visionResult.transactions,
            usedAiStructurer: true,
            extractionOrigin: visionResult.extractionOrigin ?? "ai_vision",
            qualityGate: visionResult.qualityGate,
            aiStatusNotice: visionResult.aiStatusNotice,
            printedTotalCents: visionResult.printedTotalCents ?? printedTotalCents,
            rows: visionResult.rows,
            mapping: visionResult.mapping,
          };
          setParsedRows(visionResult.rows);
          setColumnMapping(visionResult.mapping);
          applyReconciliation(visionResult.transactions, {
            usedAiStructurer: true,
            extractionOrigin: visionResult.extractionOrigin ?? "ai_vision",
            qualityGate: visionResult.qualityGate ?? null,
            aiStatusNotice: visionResult.aiStatusNotice ?? null,
            printedTotalCents: visionResult.printedTotalCents ?? printedTotalCents,
            detectedMeta: visionResult.detectedMeta ?? detectedMeta,
          });
        }
        return;
      }

      const result = await parseStatementWithPdfAiFallback({
        content: loaded.content,
        fileNameOrType: loaded.fileNameOrType,
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
        fileSha256: loaded.fileSha256,
        userId: resolvedUserId,
        isReadOnlyMode,
        aiFallbackEnabled: aiExtractionEnabled,
        spatialTransactions: loaded.spatialTransactions,
        checksumGate: loaded.checksumGate,
        spatialLinesCount: loaded.spatialLinesCount,
        discardedMoneyLines: loaded.discardedMoneyLines,
        spatialRawLines: loaded.spatialRawLines,
        rawFullText: loaded.rawFullText,
        forceAiReanalyze: true,
        reanalyzeNonce: nonce,
      });

      if (result.aiStatusNotice) {
        setAiStatusNotice(result.aiStatusNotice);
      }

      // Se a reanálise textual ainda reprovou no Quality Gate e há PDF multi-página,
      // oferece escalada Vision governada (sem consumir créditos sem aviso)
      if (
        loaded.pdfBuffer &&
        result.qualityGate &&
        !result.qualityGate.passed &&
        result.aiStatusNotice?.kind !== "quota_exceeded" &&
        result.aiStatusNotice?.kind !== "offline"
      ) {
        const candidatePages = selectCandidatePdfVisionPages(
          loaded.pdfPageTexts ?? [],
          loaded.pdfTotalPages,
        );
        setVisionEscalationOffer({
          candidatePages,
          totalPages: Math.max(loaded.pdfTotalPages ?? 1, loaded.pdfPageTexts?.length ?? 1),
          reason:
            "A reanálise textual ainda apresentou diferença em relação ao valor oficial da fatura.",
        });
      }

      if (result.transactions.length > 0) {
        loadedInputRef.current = {
          ...loaded,
          extractedTransactions: result.transactions,
          usedAiStructurer: result.usedAiFallback,
          extractionOrigin: result.extractionOrigin,
          qualityGate: result.qualityGate,
          aiStatusNotice: result.aiStatusNotice,
          printedTotalCents: result.printedTotalCents ?? printedTotalCents,
          rows: result.rows,
          mapping: result.mapping,
        };
        setParsedRows(result.rows);
        setColumnMapping(result.mapping);
        draftBlueprintRef.current = result.draftBlueprint ?? draftBlueprintRef.current;
        applyReconciliation(result.transactions, {
          usedAiStructurer: result.usedAiFallback,
          extractionOrigin: result.extractionOrigin ?? null,
          qualityGate: result.qualityGate ?? null,
          aiStatusNotice: result.aiStatusNotice ?? null,
          printedTotalCents: result.printedTotalCents ?? printedTotalCents,
          detectedMeta: result.detectedMeta ?? detectedMeta,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsReanalyzingWithAi(false);
      setReadingStatusMessage(null);
    }
  };

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setError(null);
    const headerCells = extractHeaderCellsForCache(parsedRows, mapping);
    if (headerCells.length > 0) {
      setCachedColumnMapping(headerCells, mapping);
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
    setHasUnsavedChanges(true);
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    for (const it of reconciledItems) {
      manuallyEditedIdsRef.current.add(it.transaction.id);
    }
    setHasUnsavedChanges(true);
    setReconciledItems((prev) => prev.map((it) => ({ ...it, selected })));
  };

  const handleChangeCategory = (id: string, categoryId: string) => {
    manuallyEditedIdsRef.current.add(id);
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);

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
    setHasUnsavedChanges(true);
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
        description: target.transaction.cleanDescription,
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

  const recomputeAppDuplicatesFromLists = (
    nextItems: ReconciliationItem[],
    nextUnmatched: ExistingExpenseForReconciliation[],
  ) => {
    const baseExisting = mapExpensesForReconciliation(expensesQuery.data ?? [], activeCompetenceMonth);
    const remainingIds = new Set(nextUnmatched.map((e) => e.id));
    const filteredExisting = baseExisting.filter(
      (e) =>
        remainingIds.has(e.id) ||
        nextItems.some((it) => it.matchedExpenseId === e.id),
    );
    setAppDuplicates(
      findAppDuplicateCandidates({
        items: nextItems,
        existingExpenses: filteredExisting,
        unmatchedExistingExpenses: nextUnmatched,
      }),
    );
  };

  const handleDeleteAppExpense = async (
    expenseId: string,
    mode: "single" | "all" = "single",
  ) => {
    try {
      await deleteExpenseMutation.mutateAsync({ expenseId, mode });
      const nextUnmatched = unmatchedAppExpensesRef.current.filter((e) => e.id !== expenseId);
      unmatchedAppExpensesRef.current = nextUnmatched;
      setUnmatchedAppExpenses(nextUnmatched);
      recomputeAppDuplicatesFromLists(reconciledItemsRef.current, nextUnmatched);
      triggerSensory("success");
      pushToast({
        title: "Duplicata excluída do aplicativo",
        description: "A despesa excedente foi removida mantendo a conciliação intacta.",
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível excluir a despesa",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleMoveExpenseToCompetence = async (params: {
    expenseId: string;
    targetCompetence: string;
    statementHash?: string;
    transactionId?: string;
  }) => {
    const { expenseId, targetCompetence, statementHash, transactionId } = params;
    try {
      await updateExpenseMutation.mutateAsync({
        id: expenseId,
        input: {
          bill_competence: targetCompetence,
          ...(statementHash ? { statement_hash: statementHash } : {}),
        },
      });

      if (targetCompetence === activeCompetenceMonth && transactionId) {
        setReconciledItems((prev) =>
          prev.map((it) => {
            if (it.transaction.id !== transactionId || !it.crossCompetenceMatch) return it;
            return {
              ...it,
              status: "exact_match",
              score: it.crossCompetenceMatch.score,
              matchedExpenseId: it.crossCompetenceMatch.expenseId,
              matchedExpenseDescription: it.crossCompetenceMatch.expenseDescription,
              matchedExpenseDate: it.crossCompetenceMatch.expenseDate,
              matchedExpenseValueCents: it.crossCompetenceMatch.expenseValueCents,
              crossCompetenceMatch: undefined,
              selected: false,
              suggestedAction: "link_existing",
            };
          }),
        );
      } else {
        const nextUnmatched = unmatchedAppExpensesRef.current.filter((e) => e.id !== expenseId);
        unmatchedAppExpensesRef.current = nextUnmatched;
        setUnmatchedAppExpenses(nextUnmatched);
        recomputeAppDuplicatesFromLists(reconciledItemsRef.current, nextUnmatched);
      }

      triggerSensory("success");
      const [y, m] = targetCompetence.split("-");
      pushToast({
        title: "Competência atualizada",
        description: `Despesa movida para a fatura ${m}/${y}.`,
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao mover competência",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleMoveAllCrossCompetenceMatches = async (sourceCompetence?: string) => {
    const targets = reconciledItems.filter(
      (it) =>
        it.crossCompetenceMatch &&
        (!sourceCompetence || it.crossCompetenceMatch.currentBillCompetence === sourceCompetence),
    );
    if (targets.length === 0) return;

    const results = await Promise.allSettled(
      targets.map((it) =>
        updateExpenseMutation.mutateAsync({
          id: it.crossCompetenceMatch!.expenseId,
          input: {
            bill_competence: activeCompetenceMonth,
            statement_hash: it.crossCompetenceMatch!.statementHash,
          },
        }),
      ),
    );

    const movedTxIds = new Set<string>();
    results.forEach((res, idx) => {
      if (res.status === "fulfilled" && targets[idx]) {
        movedTxIds.add(targets[idx]!.transaction.id);
      }
    });

    if (movedTxIds.size > 0) {
      setReconciledItems((prev) =>
        prev.map((it) => {
          if (!movedTxIds.has(it.transaction.id) || !it.crossCompetenceMatch) return it;
          return {
            ...it,
            status: "exact_match",
            score: it.crossCompetenceMatch.score,
            matchedExpenseId: it.crossCompetenceMatch.expenseId,
            matchedExpenseDescription: it.crossCompetenceMatch.expenseDescription,
            matchedExpenseDate: it.crossCompetenceMatch.expenseDate,
            matchedExpenseValueCents: it.crossCompetenceMatch.expenseValueCents,
            crossCompetenceMatch: undefined,
            selected: false,
            suggestedAction: "link_existing",
          };
        }),
      );
      triggerSensory("success");
      const [y, m] = activeCompetenceMonth.split("-");
      pushToast({
        title: "Fatura realinhada",
        description: `${movedTxIds.size} ${movedTxIds.size === 1 ? "despesa movida" : "despesas movidas"} para ${m}/${y}.`,
        variant: "default",
      });
    }

    if (movedTxIds.size < targets.length) {
      triggerSensory("error");
      pushToast({
        title: "Algumas despesas não puderam ser movidas",
        description: "Verifique sua conexão e tente novamente nos itens restantes.",
        variant: "destructive",
      });
    }
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

      // 4. Salva cache declarativo de colunas usando a linha real de cabeçalho
      if (columnMapping && parsedRows.length > 0) {
        const headerCells = extractHeaderCellsForCache(parsedRows, columnMapping);
        if (headerCells.length > 0) {
          setCachedColumnMapping(headerCells, columnMapping);
        }
      }

      // 4b. Auto-aprendizado blindado (Camada 4): executa Shadow Replay determinístico antes de persistir
      // Só salva o blueprint se o dry-run atingir score >= 85 e Checksum válido no próprio documento.
      const draftSession = draftBlueprintRef.current;
      if (draftSession) {
        const replay = validateBlueprintWithShadowReplay({
          blueprint: draftSession.blueprint,
          rawLines: draftSession.rawLines,
          cardId: card.id,
          competenceMonth: activeCompetenceMonth,
          officialTotalCents: draftSession.officialTotalCents,
          cycleNetTargetCents: draftSession.cycleNetTargetCents,
          previousBalanceCents: draftSession.previousBalanceCents,
          paymentsCents: draftSession.paymentsCents,
        });
        if (replay.passed) {
          saveStatementBlueprint(draftSession.blueprint);
        }
        draftBlueprintRef.current = null;
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

  const showScopeControls = isBusinessModeEnabled && card.scope === "mixed";

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
    appDuplicates,
    importProgress,
    categories,
    selectedCount,
    isReadingFile,
    readingStatusMessage,
    isReanalyzingWithAi,
    usedAiStructurer,
    extractionOrigin,
    qualityGate,
    aiStatusNotice,
    visionEscalationOffer,
    clipperRawLines,
    clipperReasonMessage,
    printedTotalCents,
    pendingPasswordFile,
    passwordError,
    hasUnsavedChanges,
    showScopeControls,
    canOpenMapping: parsedRows.length > 0,
    canOpenBlockClipper: clipperRawLines.length > 0,
    canReanalyzeWithAi:
      hasLoadedInput &&
      !isReadOnlyMode &&
      aiExtractionEnabled &&
      aiStatusNotice?.kind !== "quota_exceeded",
    isPending:
      importMutation.isPending ||
      updateExpenseMutation.isPending ||
      deleteExpenseMutation.isPending ||
      importProgress !== null ||
      isReanalyzingWithAi,
    handleFileSelect,
    handleFilesSelect,
    handleTextSubmit,
    handlePasswordSubmit,
    handlePasswordCancel,
    handleConfirmMapping,
    handleSwitchCompetence,
    handleDismissCompetenceMismatch,
    handleConfirmKeepCurrentCompetence,
    handleCancelCompetenceConflict,
    handleConfirmVisionEscalation,
    handleDismissVisionEscalation,
    handleOpenBlockClipper,
    handleConfirmBlockClipper,
    handleReanalyzeWithAi,
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
    handleDeleteAppExpense,
    handleMoveExpenseToCompetence,
    handleMoveAllCrossCompetenceMatches,
    handleConfirmImport,
  };
}
