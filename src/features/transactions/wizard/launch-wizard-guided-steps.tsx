import { Stepper } from "@/components/ui";
import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { DescriptionSuggestion, HabitualEntry } from "@/domain/predictions";
import type { Category, CreditCard, PaymentMethod, ReceiveType, Trip } from "@/types";
import { StepCategory } from "./step-category";
import { StepDetails } from "./step-details";
import { StepReview } from "./step-review";
import { StepValue } from "./step-value";
import { canProceed, isPresetWeight, WIZARD_STEPS } from "./wizard-state";
import type { EntryType, LaunchState } from "./wizard-types";

export interface LaunchWizardGuidedStepsProps {
  state: LaunchState;
  set: <K extends keyof LaunchState>(key: K, value: LaunchState[K]) => void;
  setError: (error: string | null) => void;
  habits: HabitualEntry[];
  descriptionSuggestions: DescriptionSuggestion[];
  categories: Category[] | undefined;
  categoriesLoading: boolean;
  categoriesIsError: boolean;
  categoriesError: unknown;
  cards: CreditCard[] | undefined;
  cardsLoading: boolean;
  cardsError: unknown;
  activeTrips: Trip[];
  activeTripMemberName?: string;
  selectedCategoryName?: string;
  selectedCardClosingDay?: number;
  isFamilyActive: boolean;
  onTypeChange: (type: EntryType) => void;
  onValueChange: (cents: number) => void;
  onCategorySelect: (categoryId: string) => void;
  onApplyHabitual: (habit: HabitualEntry) => void;
  onSplitToggle: (enabled: boolean) => void;
  onSplitPeopleCountChange: (count: number) => void;
  onTripChange: (tripId: string | null) => void;
}

/** Corpo do fluxo guiado em 4 passos do LaunchWizard. */
export function LaunchWizardGuidedSteps({
  state,
  set,
  setError,
  habits,
  descriptionSuggestions,
  categories,
  categoriesLoading,
  categoriesIsError,
  categoriesError,
  cards,
  cardsLoading,
  cardsError,
  activeTrips,
  activeTripMemberName,
  selectedCategoryName,
  selectedCardClosingDay,
  isFamilyActive,
  onTypeChange,
  onValueChange,
  onCategorySelect,
  onApplyHabitual,
  onSplitToggle,
  onSplitPeopleCountChange,
  onTripChange,
}: LaunchWizardGuidedStepsProps) {
  return (
    <>
      <Stepper steps={[...WIZARD_STEPS]} current={state.step} />
      {state.step === 1 ? (
        <StepValue
          state={state}
          habits={habits}
          onTypeChange={onTypeChange}
          onValueChange={onValueChange}
          onInstallmentsChange={(c) => set("installments", c)}
          onApplyHabitual={onApplyHabitual}
          onNext={() => {
            if (canProceed(state)) {
              setError(null);
              set("step", 2);
            }
          }}
        />
      ) : null}
      {state.step === 2 ? (
        <StepCategory
          categories={categories}
          isLoading={categoriesLoading}
          isError={categoriesIsError}
          error={categoriesError}
          selectedId={state.categoryId}
          isFamilyModeEnabled={isFamilyActive}
          onSelect={onCategorySelect}
        />
      ) : null}
      {state.step === 3 ? (
        <StepDetails
          state={state}
          onDateChange={(d) => set("date", d)}
          onPaymentMethodChange={(m: PaymentMethod) => {
            set("paymentMethod", m);
            if (m !== "credit_card") set("cardId", null);
          }}
          onCardChange={(id) => set("cardId", id)}
          onInstallmentsChange={(c) => set("installments", c)}
          onReceiveTypeChange={(r: ReceiveType) => set("receiveType", r)}
          onDescriptionChange={(d) => set("description", d)}
          onFamilyChange={(f) => set("isFamily", f)}
          isFamilyModeEnabled={isFamilyActive}
          descriptionSuggestions={descriptionSuggestions}
          onReportWeightChange={(w) => {
            set("reportWeight", w);
            if (!isPresetWeight(w) && state.reportCustomAmountCents === 0) {
              set("reportCustomAmountCents", state.valueCents);
            }
          }}
          onReportCustomAmountChange={(c) => set("reportCustomAmountCents", c)}
          onSplitToggle={onSplitToggle}
          onSplitPeopleCountChange={onSplitPeopleCountChange}
          onDebtToggle={(e) => set("debtEnabled", e)}
          onDebtTypeChange={(t) => set("debtType", t)}
          onDebtAmountChange={(c) => set("debtAmountCents", c)}
          onDebtDueDateChange={(d) => set("debtDueDate", d)}
          onRecurringToggle={(e) => {
            set("recurring", e);
            if (e) set("installments", 1);
          }}
          onRecurrenceFrequencyChange={(f: RecurrenceFrequency) => set("recurrenceFrequency", f)}
          onRecurrenceEndModeChange={(m) => set("recurrenceEndMode", m)}
          onRecurrenceEndDateChange={(d) => set("recurrenceEndDate", d)}
          onRecurrenceCountChange={(c) => set("recurrenceCount", c)}
          cards={cards}
          cardsLoading={cardsLoading}
          cardsError={cardsError}
          activeTrips={activeTrips}
          onTripChange={onTripChange}
          activeTripMemberName={activeTripMemberName}
          onSplitDebtModeChange={(m) => set("splitDebtMode", m)}
          onNext={() => {
            if (canProceed(state)) {
              setError(null);
              set("step", 4);
            }
          }}
        />
      ) : null}
      {state.step === 4 ? (
        <StepReview
          state={state}
          categoryName={selectedCategoryName}
          closingDay={selectedCardClosingDay}
          isFamilyModeEnabled={isFamilyActive}
          tripName={activeTrips.find((t) => t.id === state.tripId)?.title}
          tripMemberName={activeTripMemberName}
        />
      ) : null}
    </>
  );
}
