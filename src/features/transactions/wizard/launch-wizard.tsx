import { useCallback, useMemo, useState, type ClipboardEvent } from "react";
import { useNavigate } from "react-router";
import { Alert, Modal } from "@/components/ui";
import { buildDescriptionSuggestions, buildHabitualEntries, dayOfMonth } from "@/domain/predictions";
import { parseClipboardTransactionCandidate, type ReceiptUserContext } from "@/domain/notifications";
import { todayISO } from "@/domain/debts";
import { resolveActiveTripMember } from "@/domain/trips";
import { useAuth } from "@/hooks/use-auth";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { usePixClipboardDetector } from "@/hooks";
import {
  useActiveCreditCards,
  useCategories,
  useFamilyMode,
  usePredictionHistory,
  useTripMode,
  useUserAccess,
  useUserPreferences,
} from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useTripDetails, useUserTrips } from "@/state/queries/use-trips";
import { LaunchWizardFooter } from "./launch-wizard-footer";
import { LaunchWizardGuidedSteps } from "./launch-wizard-guided-steps";
import { LaunchWizardHeaderActions } from "./launch-wizard-header";
import { LaunchWizardModals } from "./launch-wizard-modals";
import { StepQuick } from "./step-quick";
import { useLaunchWizardState } from "./use-launch-wizard-state";
import { useLaunchWizardSubmit } from "./use-launch-wizard-submit";
import { useReceiptAutofill } from "./use-receipt-autofill";
import { defaultLaunchState, getStoredWizardMode, isPresetWeight } from "./wizard-state";
import type { CreatedSplitExpense, EntryType, LaunchState, ReceiptMeta, WizardMode } from "./wizard-types";

export interface LaunchWizardProps {
  open?: boolean;
  initialMode?: WizardMode;
  initialType?: EntryType;
  initialValues?: Partial<LaunchState>;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
}

/** Wizard de lançamento guiado (D10) e modo rápido em 1 tela. */
export function LaunchWizard({
  open = true,
  initialMode = "guided",
  initialType = "expense",
  initialValues,
  onOpenChange,
  onClose,
  onSuccess,
}: LaunchWizardProps = {}) {
  const { isDemoActive } = useDemoSession();
  const navigate = useNavigate();
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({ moduleKey: "transactions" });

  const [confirmClose, setConfirmClose] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [isCategoryUnconfirmed, setIsCategoryUnconfirmed] = useState(false);
  const [receiptMeta, setReceiptMeta] = useState<ReceiptMeta | null>(() => {
    if (
      initialValues?.paymentMethod === "pix" &&
      !initialValues?.valueCents &&
      Boolean(initialValues?.description)
    ) {
      return {
        merchant: initialValues.description,
        needsAmountInput: true,
      };
    }
    return null;
  });
  const [createdSplitExpense, setCreatedSplitExpense] = useState<CreatedSplitExpense | null>(null);
  const [activeType, setActiveType] = useState<EntryType>(initialValues?.type ?? initialType);

  const categoriesQuery = useCategories(activeType);
  const cardsQuery = useActiveCreditCards();
  const { isTripModeEnabled } = useTripMode();
  const userTripsQuery = useUserTrips();
  const activeTrips = isTripModeEnabled
    ? (userTripsQuery.data ?? []).filter((t) => t.status === "active" || t.status === "planning")
    : [];
  const { session, user } = useAuth();
  const { profile, hasFeature, isLoading: isAccessLoading } = useUserAccess();
  const aiExtractionEnabled =
    typeof hasFeature === "function" ? (isAccessLoading ? true : hasFeature("ai_extraction")) : true;
  const currentUserId = user?.id ?? session?.user?.id ?? profile?.id;
  const userFullName =
    profile?.name ??
    (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : undefined);
  const userContext = useMemo<ReceiptUserContext | undefined>(
    () => (userFullName ? { userFullName } : undefined),
    [userFullName],
  );
  const userPreferencesQuery = useUserPreferences();
  const { isFamilyModeEnabled } = useFamilyMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const { detectedPix, clearDetectedPix } = usePixClipboardDetector();

  const wizard = useLaunchWizardState({
    initialMode,
    initialType,
    initialValues,
    categories: categoriesQuery.data,
    preferredTripCategoryId: userPreferencesQuery.data?.custom_settings?.preferredTripCategoryId,
    isFamilyActive,
    onSetCategoryUnconfirmed: setIsCategoryUnconfirmed,
  });
  const { mode, setMode, state, setState, set } = wizard;
  if (state.type !== activeType) setActiveType(state.type);

  const selectedTripDetails = useTripDetails(state.tripId ?? "");
  const tripMembers = useMemo(() => selectedTripDetails.data?.members ?? [], [selectedTripDetails.data?.members]);
  const currentTrip = selectedTripDetails.data?.trip;
  const activeTripMember = useMemo(() => {
    if (!state.tripId || tripMembers.length === 0) return null;
    return resolveActiveTripMember(tripMembers, currentUserId, currentTrip?.host_user_id);
  }, [state.tripId, tripMembers, currentUserId, currentTrip?.host_user_id]);

  const prediction = usePredictionHistory(mode === "quick" || state.step === 1 || state.step === 3);
  const today = todayISO();
  const selectedCategory = categoriesQuery.data?.find((c) => c.id === state.categoryId);
  const selectedCard = state.paymentMethod === "credit_card" ? cardsQuery.data?.find((c) => c.id === state.cardId) : undefined;

  const habits = buildHabitualEntries(prediction.entries, state.type, {
    limit: 3, referenceDay: dayOfMonth(state.date), todayISO: today,
    targetMonth: state.date.slice(0, 7), referenceDate: state.date, currentHour: new Date().getHours(),
  });
  const descriptionSuggestions = buildDescriptionSuggestions(prediction.entries, state.type, {
    limit: 3, categoryName: selectedCategory?.name ?? null, query: state.description, todayISO: today,
  });

  const {
    handleReceiptParsed,
    handlePasteText,
    handlePasteImageFile,
    handlePastePixFromClipboard,
  } = useReceiptAutofill({
    state, setState, setMode, setIsCategoryUnconfirmed, setReceiptMeta,
    categories: categoriesQuery.data, cards: cardsQuery.data, initialValues,
    detectedPix, clearDetectedPix, onOpenAttachDialog: () => setAttachOpen(true),
    userContext,
    userId: currentUserId,
    isReadOnlyMode,
    aiExtractionEnabled,
  });

  const handleWizardPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        event.preventDefault();
        void handlePasteImageFile(imageFile);
        return;
      }

      const pastedText = event.clipboardData?.getData("text")?.trim() ?? "";
      if (!pastedText) return;

      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const isEditingInput = targetTag === "INPUT" || targetTag === "TEXTAREA";

      if (isEditingInput) {
        const candidate = parseClipboardTransactionCandidate(pastedText);
        if (candidate && candidate.kind !== "NONE") {
          event.preventDefault();
          handlePasteText(pastedText);
        }
        return;
      }

      if (handlePasteText(pastedText)) {
        event.preventDefault();
      }
    },
    [handlePasteImageFile, handlePasteText],
  );

  const { submit, pending, error, setError } = useLaunchWizardSubmit({
    state, setState, initialType, initialValues, isReadOnlyMode, guardAction,
    isFamilyActive, categories: categoriesQuery.data, selectedCard, currentUserId,
    currentTrip, tripMembers, receiptMeta, setReceiptMeta, setCreatedSplitExpense,
    onSuccess, onOpenChange, onFallbackBack: () => navigate(-1),
  });

  const handleClose = () => {
    setState(defaultLaunchState(initialType, initialValues));
    setMode(initialMode === "quick" ? "quick" : (getStoredWizardMode() ?? initialMode));
    setError(null);
    setReceiptMeta(null);
    onClose?.();
    onOpenChange?.(false);
    if (!onClose && !onOpenChange) navigate(-1);
  };

  const requestClose = () => {
    if (state.valueCents > 0 || state.categoryId !== "" || state.description.trim() !== "") setConfirmClose(true);
    else handleClose();
  };

  const canSubmitQuick = state.valueCents > 0 && state.categoryId.trim() !== "" && !(state.type === "expense" && state.paymentMethod === "credit_card" && !state.cardId);
  const showCalculator = mode === "quick" || state.step === 1 || (state.step === 3 && (!isPresetWeight(state.reportWeight) || state.debtEnabled));

  return (
    <>
      <Modal
        open={open && !createdSplitExpense}
        data-tour="launch-wizard-dialog"
        modal={!isDemoActive}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        title={mode === "quick" ? "Lançamento rápido" : "Novo lançamento"}
        size={mode === "quick" ? "lg" : "xl"}
        showCalculator={showCalculator}
        wideHeaderActions={mode === "guided"}
        headerActions={
          <LaunchWizardHeaderActions
            mode={mode}
            hasDetectedPix={Boolean(detectedPix)}
            showPastePix={mode === "quick" || state.step === 1}
            onSwitchToQuick={wizard.switchToQuick}
            onPastePix={() => void handlePastePixFromClipboard()}
            onOpenAttach={() => setAttachOpen(true)}
          />
        }
        footer={
          <LaunchWizardFooter
            mode={mode} state={state} pending={pending} canSubmitQuick={canSubmitQuick}
            onRequestClose={requestClose}
            onGoToStep={(step) => { setError(null); set("step", step); }}
            onSubmit={() => void submit()}
          />
        }
      >
        <div className="flex flex-col gap-6 pt-2" onPaste={handleWizardPaste}>
          {error ? <Alert variant="error">{error}</Alert> : null}
          {mode === "quick" ? (
            <StepQuick
              state={state} habits={habits} onApplyHabitual={wizard.applyHabitual}
              onTypeChange={wizard.handleTypeChange} onValueChange={wizard.handleValueChange} onCategoryChange={wizard.handleCategorySelect}
              onPaymentMethodChange={(m) => { set("paymentMethod", m); if (m !== "credit_card") set("cardId", null); }}
              onCardChange={(id) => set("cardId", id)} onInstallmentsChange={(c) => set("installments", c)}
              isCategoryUnconfirmed={isCategoryUnconfirmed} onReceiveTypeChange={(r) => set("receiveType", r)}
              onDescriptionChange={(d) => set("description", d)} onFamilyChange={(f) => set("isFamily", f)}
              isFamilyModeEnabled={isFamilyActive} onSplitToggle={wizard.handleSplitToggle}
              onSplitPeopleCountChange={wizard.handleSplitPeopleCountChange} onSwitchToGuided={wizard.switchToGuided}
              categories={categoriesQuery.data} categoriesLoading={categoriesQuery.isLoading}
              predictionEntries={prediction.entries} cards={cardsQuery.data} cardsLoading={cardsQuery.isLoading}
              receiptMeta={receiptMeta}
              activeTrips={activeTrips} onTripChange={wizard.handleTripChange} activeTripMemberName={activeTripMember?.name}
              onSplitDebtModeChange={(m) => set("splitDebtMode", m)}
              onSubmit={() => { if (canSubmitQuick && !pending) void submit(); }}
            />
          ) : (
            <LaunchWizardGuidedSteps
              state={state}
              set={set}
              setError={setError}
              habits={habits}
              descriptionSuggestions={descriptionSuggestions}
              categories={categoriesQuery.data}
              categoriesLoading={categoriesQuery.isLoading}
              categoriesIsError={categoriesQuery.isError}
              categoriesError={categoriesQuery.error}
              cards={cardsQuery.data}
              cardsLoading={cardsQuery.isLoading}
              cardsError={cardsQuery.error}
              activeTrips={activeTrips}
              activeTripMemberName={activeTripMember?.name}
              selectedCategoryName={selectedCategory?.name}
              selectedCardClosingDay={selectedCard?.closing_day}
              isFamilyActive={isFamilyActive}
              onTypeChange={wizard.handleTypeChange}
              onValueChange={wizard.handleValueChange}
              onCategorySelect={wizard.handleCategorySelect}
              onApplyHabitual={wizard.applyHabitual}
              onSplitToggle={wizard.handleSplitToggle}
              onSplitPeopleCountChange={wizard.handleSplitPeopleCountChange}
              onTripChange={wizard.handleTripChange}
            />
          )}
        </div>
      </Modal>

      <LaunchWizardModals
        confirmClose={confirmClose}
        onConfirmCloseChange={setConfirmClose}
        onConfirmDiscard={() => { setConfirmClose(false); handleClose(); }}
        attachOpen={attachOpen}
        onAttachOpenChange={setAttachOpen}
        onReceiptParsed={(parsed) => handleReceiptParsed(parsed, { silentFeedback: true })}
        onNavigateToStatementImport={() => {
          setAttachOpen(false);
          handleClose();
          navigate("/cartoes");
        }}
        userContext={userContext}
        userId={currentUserId}
        isReadOnlyMode={isReadOnlyMode}
        aiExtractionEnabled={aiExtractionEnabled}
        cards={cardsQuery.data}
        createdSplitExpense={createdSplitExpense}
        onClearCreatedSplit={() => setCreatedSplitExpense(null)}
        onSplitFinished={() => {
          onSuccess?.();
          onOpenChange?.(false);
          if (!onSuccess && !onOpenChange) navigate(-1);
        }}
        upgradeModal={upgradeModal}
      />
    </>
  );
}
