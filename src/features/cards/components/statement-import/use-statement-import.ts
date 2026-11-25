import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "@/services/errors";
import { getMerchantLearningMemory } from "@/services/merchant-learning";
import { isLocalTabularBlueprintId, loadLocalTabularBlueprints, recordLocalTabularBlueprintOutcome } from "@/services/statement-tabular-blueprints";
import {
  useAiQuota,
  useBusinessMode,
  useCardBillRollovers,
  useCardExpenses,
  useCardPayments,
  useCategories,
  useCreditCards,
  usePredictionHistory,
  useRecordStatementBlueprintOutcome,
  useStatementBlueprints,
} from "@/state";
import type { CreditCard } from "@/types";
import { runSyncBatchCategorization } from "./statement-import-pipeline";
import type { StatementWizardStep } from "./statement-import-types";
import {
  mapAdjacentExpensesForReconciliation,
  mapAllCardExpensesForReconciliation,
  mapCardRefundsForReconciliation,
  mapExpensesForReconciliation,
} from "./statement-reconcile-mappers";
import { useStatementCommit } from "./use-statement-commit";
import { useStatementIngestion, type ExtractedStatementPayload } from "./use-statement-ingestion";
import { useStatementReconciliation } from "./use-statement-reconciliation";

export interface UseStatementImportParams {
  card: CreditCard;
  availableCards?: readonly CreditCard[];
  competenceMonth: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onClose: () => void;
  onCompetenceChange?: (newMonth: string) => void;
  onCardChange?: (newCard: CreditCard) => void;
}

export function useStatementImport({
  card,
  availableCards: providedCards,
  competenceMonth,
  userId = null,
  isReadOnlyMode = false,
  aiExtractionEnabled = true,
  onClose,
  onCompetenceChange,
  onCardChange,
}: UseStatementImportParams) {
  const [step, setStep] = useState<StatementWizardStep>("upload");
  const [activeCard, setActiveCard] = useState<CreditCard>(card);
  const [activeCompetenceMonth, setActiveCompetenceMonth] = useState(competenceMonth);
  const [pendingCardSwitchId, setPendingCardSwitchId] = useState<string | null>(null);
  const [switchingStatusMessage, setSwitchingStatusMessage] = useState<string | null>(null);

  const [prevCardId, setPrevCardId] = useState(card.id);
  if (prevCardId !== card.id) {
    setPrevCardId(card.id);
    setActiveCard(card);
  }
  const [prevCompetenceMonth, setPrevCompetenceMonth] = useState(competenceMonth);
  if (prevCompetenceMonth !== competenceMonth) {
    setPrevCompetenceMonth(competenceMonth);
    setActiveCompetenceMonth(competenceMonth);
  }

  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const expensesQuery = useCardExpenses(activeCard.id);
  const paymentsQuery = useCardPayments(activeCard.id);
  const rolloversQuery = useCardBillRollovers(activeCard.id);
  const historyQuery = usePredictionHistory(true);
  const blueprintsQuery = useStatementBlueprints();
  const aiQuota = useAiQuota();
  const recordBlueprintOutcomeMutation = useRecordStatementBlueprintOutcome();
  const { isBusinessModeEnabled } = useBusinessMode();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const defaultCategoryId = categories[0]?.id ?? "";
  const allExpenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const allPayments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const allRollovers = useMemo(() => rolloversQuery.data ?? [], [rolloversQuery.data]);
  const allCardExpensesForSeries = useMemo(() => mapAllCardExpensesForReconciliation(allExpenses), [allExpenses]);

  const availableCardsList = useMemo(() => {
    const map = new Map<string, CreditCard>();
    for (const c of cardsQuery.data ?? []) map.set(c.id, c);
    for (const c of providedCards ?? []) map.set(c.id, c);
    map.set(activeCard.id, activeCard);
    return Array.from(map.values());
  }, [activeCard, cardsQuery.data, providedCards]);

  const reconciliation = useStatementReconciliation({
    activeCard, availableCards: availableCardsList, activeCompetenceMonth,
    allExpenses, allPayments, allRollovers, allCardExpensesForSeries, categories, defaultCategoryId,
  });
  const commit = useStatementCommit({ userId, onError: reconciliation.setError, onSuccessCloseOrStep: () => setStep("success") });

  const reconcileRunIdRef = useRef(0);
  const reconcileAbortRef = useRef<AbortController | null>(null);
  const inFlightCardSwitchRef = useRef<string | null>(null);
  const [categorizeStatusMessage, setCategorizeStatusMessage] = useState<string | null>(null);

  useEffect(() => () => {
    reconcileRunIdRef.current += 1;
    inFlightCardSwitchRef.current = null;
    reconcileAbortRef.current?.abort();
  }, []);

  const applyReconciliation = useCallback(
    async (
      transactions: ExtractedStatementPayload["transactions"],
      meta?: Partial<ExtractedStatementPayload> & {
        skipAiCategorization?: boolean;
        expensesSource?: typeof allExpenses;
        paymentsSource?: typeof allPayments;
        targetCardScope?: CreditCard["scope"];
      },
    ) => {
      const runId = ++reconcileRunIdRef.current;
      reconcileAbortRef.current?.abort();
      const abortController = new AbortController();
      reconcileAbortRef.current = abortController;

      if (meta?.usedAiStructurer !== undefined) reconciliation.setUsedAiStructurer(meta.usedAiStructurer);
      if (meta?.extractionOrigin !== undefined) reconciliation.setExtractionOrigin(meta.extractionOrigin);
      if (meta?.qualityGate !== undefined) reconciliation.setQualityGate(meta.qualityGate);
      if (meta?.aiStatusNotice !== undefined) reconciliation.setAiStatusNotice(meta.aiStatusNotice);
      if (meta?.printedTotalCents !== undefined) reconciliation.setPrintedTotalCents(meta.printedTotalCents);
      if (meta?.detectedMeta !== undefined) reconciliation.setDetectedMeta(meta.detectedMeta);

      const comp = meta?.competenceForReconciliation ?? activeCompetenceMonth;
      const expSrc = meta?.expensesSource ?? allExpenses;
      const paySrc = meta?.paymentsSource ?? allPayments;
      const officialTotalValidated = Boolean(
        meta?.qualityGate && meta.qualityGate.effectiveTargetCents !== null && meta.qualityGate.diffCents <= 5,
      );

      const result = await runSyncBatchCategorization({
        transactions,
        existingExpenses: mapExpensesForReconciliation(expSrc, comp),
        adjacentExpenses: mapAdjacentExpensesForReconciliation(expSrc, comp),
        existingRefunds: mapCardRefundsForReconciliation(paySrc, comp),
        allCardExpenses: mapAllCardExpensesForReconciliation(expSrc),
        competenceMonth: comp,
        cardScope: meta?.targetCardScope ?? activeCard.scope,
        categories,
        history: historyQuery.entries ?? [],
        defaultCategoryId,
        userMemory: getMerchantLearningMemory(),
        userId,
        isReadOnlyMode,
        aiExtractionEnabled: meta?.skipAiCategorization ? false : aiExtractionEnabled,
        canRunPassiveCategorizeBatch: meta?.skipAiCategorization ? false : aiQuota.summary.canRunPassiveCategorizeBatch,
        officialTotalValidated,
        isMultiImageOverlapRisk: meta?.isMultiImageOverlapRisk,
        signal: abortController.signal,
        onStatusMessage: (msg) => {
          if (reconcileRunIdRef.current === runId && !abortController.signal.aborted) setCategorizeStatusMessage(msg);
        },
      });

      if (reconcileRunIdRef.current !== runId || abortController.signal.aborted) return;
      reconciliation.loadReconciliationSnapshot(result);
      setCategorizeStatusMessage(null);
      setStep("reconcile");
    },
    [activeCard.scope, activeCompetenceMonth, aiExtractionEnabled, aiQuota.summary.canRunPassiveCategorizeBatch, allExpenses, allPayments, categories, defaultCategoryId, historyQuery.entries, isReadOnlyMode, reconciliation, userId],
  );

  const ingestion = useStatementIngestion({
    activeCard,
    activeCompetenceMonth,
    userId,
    isReadOnlyMode,
    aiExtractionEnabled,
    availableBatchCalls: aiQuota.summary.getAffordableBatchCalls(6),
    learnedBlueprints: useMemo(
      () => [...loadLocalTabularBlueprints(userId), ...(blueprintsQuery.data ?? [])],
      [blueprintsQuery.data, userId],
    ),
    onRecordBlueprintOutcome: (outcome) => {
      if (isLocalTabularBlueprintId(outcome.blueprintId)) {
        recordLocalTabularBlueprintOutcome(outcome.blueprintId, outcome.exactChecksumHit, userId);
        return;
      }
      void recordBlueprintOutcomeMutation.mutateAsync(outcome).catch(() => {});
    },
    onCompetenceConflict: (payload) => {
      reconciliation.setUsedAiStructurer(payload.usedAiStructurer);
      reconciliation.setExtractionOrigin(payload.extractionOrigin);
      reconciliation.setQualityGate(payload.qualityGate);
      reconciliation.setPrintedTotalCents(payload.printedTotalCents);
      reconciliation.setDetectedMeta(payload.detectedMeta);
      setStep("competence_conflict");
    },
    onMappingRequired: (payload) => {
      reconciliation.setUsedAiStructurer(payload.usedAiStructurer);
      reconciliation.setExtractionOrigin(payload.extractionOrigin);
      reconciliation.setQualityGate(payload.qualityGate);
      reconciliation.setPrintedTotalCents(payload.printedTotalCents);
      reconciliation.setDetectedMeta(payload.detectedMeta);
      setStep("mapping");
    },
    onExtractionReady: (payload) => applyReconciliation(payload.transactions, payload),
    onError: reconciliation.setError,
    onStatusNotice: reconciliation.setAiStatusNotice,
    onUploadStepRequested: () => setStep("upload"),
  });

  const handleSwitchCompetence = useCallback(
    async (newMonth: string) => {
      if (!newMonth || newMonth === activeCompetenceMonth) return;
      const comingFromConflict = step === "competence_conflict";
      setActiveCompetenceMonth(newMonth);
      onCompetenceChange?.(newMonth);
      ingestion.clearPendingConflict();
      const payload = ingestion.reNormalizeLoadedEntries({ targetCard: activeCard, targetCompetenceMonth: newMonth });
      if (!payload) return;
      reconciliation.setError(null);
      reconciliation.setDetectedMeta(payload.detectedMeta);
      reconciliation.setQualityGate(payload.qualityGate);
      reconciliation.setPrintedTotalCents(payload.printedTotalCents);
      if (payload.shouldAutoAdvance) {
        await applyReconciliation(payload.transactions, { ...payload, competenceForReconciliation: newMonth, skipAiCategorization: !comingFromConflict });
      } else {
        setStep("mapping");
      }
    },
    [activeCard, activeCompetenceMonth, applyReconciliation, ingestion, onCompetenceChange, reconciliation, step],
  );

  // Troca de cartão em 1 clique (D17) com espera estrita pela hidratação de useCardExpenses e useCardPayments
  const handleSwitchCard = useCallback(
    (targetCardId: string) => {
      if (!targetCardId || targetCardId === activeCard.id) return;
      const targetCard = availableCardsList.find((c) => c.id === targetCardId);
      if (!targetCard) return;
      reconcileRunIdRef.current += 1;
      inFlightCardSwitchRef.current = null;
      reconcileAbortRef.current?.abort();
      setSwitchingStatusMessage("Conferindo valores e parcelas...");
      setPendingCardSwitchId(targetCard.id);
      setActiveCard(targetCard);
      onCardChange?.(targetCard);
    },
    [activeCard.id, availableCardsList, onCardChange],
  );

  useEffect(() => {
    if (!pendingCardSwitchId || pendingCardSwitchId !== activeCard.id) return;
    if (inFlightCardSwitchRef.current === pendingCardSwitchId) return;
    let cancelled = false;
    if (expensesQuery.isError || paymentsQuery.isError || rolloversQuery.isError) {
      inFlightCardSwitchRef.current = null;
      const errMsg = getErrorMessage(expensesQuery.error ?? paymentsQuery.error ?? rolloversQuery.error);
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setPendingCardSwitchId(null); setSwitchingStatusMessage(null); reconciliation.setError(errMsg);
      });
      return () => { cancelled = true; };
    }
    const isHydrated =
      !expensesQuery.isLoading && !expensesQuery.isFetching && expensesQuery.data !== undefined &&
      !paymentsQuery.isLoading && !paymentsQuery.isFetching && paymentsQuery.data !== undefined &&
      !rolloversQuery.isLoading && !rolloversQuery.isFetching;
    if (!isHydrated) return;

    const switchTargetId = pendingCardSwitchId;
    inFlightCardSwitchRef.current = switchTargetId;
    const payload = ingestion.reNormalizeLoadedEntries({ targetCard: activeCard, targetCompetenceMonth: activeCompetenceMonth });
    if (!payload) {
      inFlightCardSwitchRef.current = null;
      void Promise.resolve().then(() => {
        if (!cancelled) { setPendingCardSwitchId(null); setSwitchingStatusMessage(null); }
      });
      return () => { cancelled = true; };
    }
    void applyReconciliation(payload.transactions, {
      ...payload, skipAiCategorization: true, expensesSource: expensesQuery.data, paymentsSource: paymentsQuery.data, targetCardScope: activeCard.scope,
    })
      .catch((err) => { reconciliation.setError(getErrorMessage(err)); })
      .finally(() => {
        if (inFlightCardSwitchRef.current === switchTargetId) {
          inFlightCardSwitchRef.current = null;
          setPendingCardSwitchId((curr) => (curr === switchTargetId ? null : curr));
          setSwitchingStatusMessage(null);
        }
      });
    return () => { cancelled = true; };
  }, [activeCard, activeCompetenceMonth, applyReconciliation, expensesQuery.data, expensesQuery.error, expensesQuery.isError, expensesQuery.isFetching, expensesQuery.isLoading, ingestion, paymentsQuery.data, paymentsQuery.error, paymentsQuery.isError, paymentsQuery.isFetching, paymentsQuery.isLoading, pendingCardSwitchId, reconciliation, rolloversQuery.error, rolloversQuery.isError, rolloversQuery.isFetching, rolloversQuery.isLoading]);

  const handleConfirmKeepCurrentCompetence = useCallback(async () => {
    const pending = ingestion.consumePendingConflict();
    reconciliation.handleDismissCompetenceMismatch();
    if (!pending) { setStep("reconcile"); return; }
    if (pending.shouldAutoAdvance) {
      await applyReconciliation(pending.transactions, { ...pending, detectedMeta: pending.detectedMeta ? { ...pending.detectedMeta, hasCompetenceMismatch: false } : null });
    } else {
      setStep("mapping");
    }
  }, [applyReconciliation, ingestion, reconciliation]);

  const handleConfirmImport = useCallback(() => {
    return commit.handleConfirmCommit({
      plan: reconciliation.reconciliationPlan, closingDay: activeCard.closing_day, categoriesCount: categories.length, isReadOnlyMode,
      hasUnconfirmedCardMismatch: reconciliation.hasUnconfirmedCardMismatch, openBalanceBeforeCents: reconciliation.billProtection.openBalanceCents,
      draftBlueprint: ingestion.getDraftBlueprint(), onConsumeDraftBlueprint: ingestion.clearDraftBlueprint,
    });
  }, [activeCard.closing_day, categories.length, commit, ingestion, isReadOnlyMode, reconciliation]);

  const handleCancelAll = useCallback(() => {
    reconcileRunIdRef.current += 1;
    inFlightCardSwitchRef.current = null;
    reconcileAbortRef.current?.abort();
    setCategorizeStatusMessage(null);
    setPendingCardSwitchId(null);
    setSwitchingStatusMessage(null);
    ingestion.handleCancelProcessing();
  }, [ingestion]);

  const handleChangeFile = useCallback(() => {
    reconciliation.resetStagingState();
    commit.clearCommitState();
    ingestion.resetIngestionSession();
  }, [commit, ingestion, reconciliation]);

  return {
    step, setStep, activeCard, activeCompetenceMonth, availableCards: availableCardsList,
    categories, isBusinessModeEnabled, showScopeControls: isBusinessModeEnabled && activeCard.scope === "mixed",
    isSwitchingCard: pendingCardSwitchId !== null,
    isReadingFile: ingestion.isReadingFile || pendingCardSwitchId !== null || Boolean(categorizeStatusMessage),
    readingStatusMessage: switchingStatusMessage ?? categorizeStatusMessage ?? ingestion.readingStatusMessage,
    parsedRows: ingestion.parsedRows, columnMapping: ingestion.columnMapping, spreadsheetSheets: ingestion.spreadsheetSheets, activeSheetIndex: ingestion.activeSheetIndex, handleSelectSpreadsheetSheet: ingestion.handleSelectSpreadsheetSheet,
    canOpenMapping: ingestion.canOpenMapping, canAdjustColumns: ingestion.canAdjustColumns,
    pendingPasswordFile: ingestion.pendingPasswordFile, passwordError: ingestion.passwordError,
    handleFileSelect: ingestion.handleFileSelect, handleFilesSelect: ingestion.handleFilesSelect,
    handleTextSubmit: ingestion.handleTextSubmit, handlePasswordSubmit: ingestion.handlePasswordSubmit,
    handlePasswordCancel: ingestion.handlePasswordCancel, handleConfirmMapping: ingestion.handleConfirmMapping,
    handleCancelProcessing: handleCancelAll,
    handleSwitchCompetence, handleSwitchCard,
    handleConfirmKeepCurrentCompetence,
    handleCancelCompetenceConflict: handleChangeFile,
    handleChangeFile,
    handleCloseDialog: onClose,
    ...reconciliation,
    isPending: commit.isPending,
    importProgress: commit.importProgress,
    commitRetryState: commit.commitRetryState,
    commitSummary: commit.commitSummary,
    handleConfirmImport,
    handleRetryPendingChunks: useCallback(() => commit.handleRetryPendingChunks(activeCard.closing_day), [activeCard.closing_day, commit]),
  };
}
