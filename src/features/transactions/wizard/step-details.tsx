import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui";
import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { DescriptionSuggestion } from "@/domain/predictions";
import type { ChargeKind, DebtType, PaymentMethod, ReceiveType, TransactionScope } from "@/types";
import { ReportWeightField } from "../components/report-weight-field";
import { DetailsPrimaryFields } from "./details-primary-fields";
import { LaunchContextSelector } from "./launch-context-selector";
import { LinkedDebtSection } from "./linked-debt-section";
import { PaymentConditionSection } from "./payment-condition-section";
import { CUSTOM_WEIGHT_VALUE, effectiveReportWeight, isPresetWeight } from "./wizard-schemas";
import type { LaunchState } from "./wizard-types";

export interface StepDetailsProps {
  state: LaunchState;
  onDateChange: (date: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onChargeKindChange?: (kind: ChargeKind) => void;
  onInstallmentsChange?: (count: number) => void;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onFamilyChange: (isFamily: boolean) => void;
  isFamilyModeEnabled?: boolean;
  isBusinessModeEnabled?: boolean;
  onScopeChange?: (scope: TransactionScope) => void;
  onTaxDeductibleChange?: (deductible: boolean) => void;
  onReportWeightChange: (weight: number) => void;
  onReportCustomAmountChange: (cents: number) => void;
  onSplitToggle?: (enabled: boolean) => void;
  onSplitPeopleCountChange?: (count: number) => void;
  onDebtToggle: (enabled: boolean) => void;
  onDebtTypeChange: (type: DebtType) => void;
  onDebtAmountChange: (cents: number) => void;
  onDebtDueDateChange: (date: string) => void;
  onRecurringToggle: (enabled: boolean) => void;
  onRecurrenceFrequencyChange: (frequency: RecurrenceFrequency) => void;
  onRecurrenceEndModeChange: (mode: "date" | "count") => void;
  onRecurrenceEndDateChange: (date: string) => void;
  onRecurrenceCountChange: (count: number) => void;
  descriptionSuggestions: DescriptionSuggestion[];
  cards: { id: string; name: string }[] | undefined;
  cardsLoading: boolean;
  cardsError: unknown;
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  onTripChange?: (tripId: string | null) => void;
  activeTripMemberName?: string;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
  onNext?: () => void;
}

export function StepDetails(props: StepDetailsProps) {
  const {
    state, onDateChange, onPaymentMethodChange, onCardChange, onChargeKindChange, onInstallmentsChange,
    onReceiveTypeChange, onDescriptionChange, onFamilyChange, isFamilyModeEnabled = false,
    isBusinessModeEnabled = false, onScopeChange, onTaxDeductibleChange,
    onReportWeightChange, onReportCustomAmountChange, onSplitToggle, onSplitPeopleCountChange,
    onDebtToggle, onDebtTypeChange, onDebtAmountChange, onDebtDueDateChange,
    onRecurringToggle, onRecurrenceFrequencyChange, onRecurrenceEndModeChange,
    onRecurrenceEndDateChange, onRecurrenceCountChange, descriptionSuggestions,
    cards, cardsLoading, cardsError, activeTrips, onTripChange, activeTripMemberName,
    onSplitDebtModeChange, onNext,
  } = props;

  const isExpense = state.type === "expense";
  const showReportWeight = !state.splitEnabled;
  const showLinkedDebt = isExpense && !state.recurring && !state.splitEnabled;
  const hasAdvancedData =
    (showReportWeight && (!isPresetWeight(state.reportWeight) || effectiveReportWeight(state) < 1)) ||
    (showLinkedDebt && state.debtEnabled);

  const [accordionValue, setAccordionValue] = useState<string>(() => (hasAdvancedData ? "advanced" : ""));
  const [prevHasAdvancedData, setPrevHasAdvancedData] = useState(hasAdvancedData);
  if (hasAdvancedData !== prevHasAdvancedData) {
    setPrevHasAdvancedData(hasAdvancedData);
    if (hasAdvancedData) setAccordionValue("advanced");
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailsPrimaryFields
        isExpense={isExpense}
        date={state.date}
        paymentMethod={state.paymentMethod}
        cardId={state.cardId}
        chargeKind={state.chargeKind}
        receiveType={state.receiveType}
        description={state.description}
        descriptionSuggestions={descriptionSuggestions}
        cards={cards}
        cardsLoading={cardsLoading}
        cardsError={cardsError}
        onDateChange={onDateChange}
        onPaymentMethodChange={onPaymentMethodChange}
        onCardChange={onCardChange}
        onChargeKindChange={onChargeKindChange}
        onReceiveTypeChange={onReceiveTypeChange}
        onDescriptionChange={onDescriptionChange}
        onNext={onNext}
      />

      <PaymentConditionSection
        state={state}
        onInstallmentsChange={onInstallmentsChange}
        onRecurringToggle={onRecurringToggle}
        onRecurrenceFrequencyChange={onRecurrenceFrequencyChange}
        onRecurrenceEndModeChange={onRecurrenceEndModeChange}
        onRecurrenceEndDateChange={onRecurrenceEndDateChange}
        onRecurrenceCountChange={onRecurrenceCountChange}
      />

      <LaunchContextSelector
        state={state}
        title="Contexto do Lançamento"
        isFamilyModeEnabled={isFamilyModeEnabled}
        isBusinessModeEnabled={isBusinessModeEnabled}
        activeTrips={activeTrips}
        activeTripMemberName={activeTripMemberName}
        onScopeChange={onScopeChange}
        onTaxDeductibleChange={onTaxDeductibleChange}
        onFamilyChange={onFamilyChange}
        onTripChange={onTripChange}
        onSplitToggle={onSplitToggle}
        onSplitPeopleCountChange={onSplitPeopleCountChange}
        onSplitDebtModeChange={onSplitDebtModeChange}
        allowCustomPeopleStepper
      />

      {showReportWeight || showLinkedDebt ? (
        <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
          <AccordionItem value="advanced">
            <AccordionTrigger>Mais detalhes · Rateio e cobrança vinculada</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3.5">
              {showReportWeight ? (
                <ReportWeightField
                  valueCents={state.valueCents}
                  mode={isPresetWeight(state.reportWeight) ? String(state.reportWeight) : "custom"}
                  onModeChange={(value) =>
                    onReportWeightChange(value === "custom" ? CUSTOM_WEIGHT_VALUE : Number(value))
                  }
                  customAmountCents={state.reportCustomAmountCents}
                  onCustomAmountChange={onReportCustomAmountChange}
                  customLabel="Sua cota considerada no relatório"
                  ariaLabelCustom="Sua cota considerada no relatório"
                />
              ) : null}

              {showLinkedDebt ? (
                <LinkedDebtSection
                  debtEnabled={state.debtEnabled}
                  debtType={state.debtType}
                  debtAmountCents={state.debtAmountCents}
                  debtDueDate={state.debtDueDate}
                  onDebtToggle={onDebtToggle}
                  onDebtTypeChange={onDebtTypeChange}
                  onDebtAmountChange={onDebtAmountChange}
                  onDebtDueDateChange={onDebtDueDateChange}
                />
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
