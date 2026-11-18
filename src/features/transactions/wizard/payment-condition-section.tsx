import { Checkbox, DatePicker, MoneyText, NumberStepper, RadioGroup, Select, Tabs } from "@/components/ui";
import { MAX_RECURRENCE_OCCURRENCES, RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from "@/domain/recurrences";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import type { LaunchState } from "./wizard-types";

export interface PaymentConditionSectionProps {
  state: LaunchState;
  onInstallmentsChange?: (count: number) => void;
  onRecurringToggle: (enabled: boolean) => void;
  onRecurrenceFrequencyChange: (frequency: RecurrenceFrequency) => void;
  onRecurrenceEndModeChange: (mode: "date" | "count") => void;
  onRecurrenceEndDateChange: (date: string) => void;
  onRecurrenceCountChange: (count: number) => void;
}

export function PaymentConditionSection({
  state,
  onInstallmentsChange,
  onRecurringToggle,
  onRecurrenceFrequencyChange,
  onRecurrenceEndModeChange,
  onRecurrenceEndDateChange,
  onRecurrenceCountChange,
}: PaymentConditionSectionProps) {
  const paymentCondition: "single" | "installments" | "recurring" = state.recurring
    ? "recurring"
    : state.installments > 1
      ? "installments"
      : "single";

  const handlePaymentConditionChange = (condition: string) => {
    if (condition === "single") {
      onRecurringToggle(false);
      onInstallmentsChange?.(1);
    } else if (condition === "installments") {
      onRecurringToggle(false);
      onInstallmentsChange?.(state.installments > 1 ? state.installments : 2);
    } else if (condition === "recurring") {
      onRecurringToggle(true);
      onInstallmentsChange?.(1);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Condição de Pagamento</span>
        {paymentCondition === "installments" && state.installments > 1 && state.valueCents > 0 ? (
          <span className="text-xs font-medium text-foreground">
            {state.installments}× de <MoneyText cents={Math.ceil(state.valueCents / state.installments)} tone="default" />
          </span>
        ) : null}
      </div>

      <Tabs
        value={paymentCondition}
        fullWidth
        onValueChange={handlePaymentConditionChange}
        items={[
          { value: "single", label: "À vista", content: null },
          { value: "installments", label: "Parcelado", content: null },
          { value: "recurring", label: "Recorrente", content: null },
        ]}
      />

      {paymentCondition === "single" ? (
        <p className="text-[11px] text-muted-foreground">
          Lançamento pontual com valor integral liquidado na data informada.
        </p>
      ) : null}

      {paymentCondition === "installments" ? (
        <div className="flex flex-col gap-2 border-t border-border/80 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Número de Parcelas</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{state.installments}×</span>
          </div>
          <NumberStepper
            value={state.installments}
            onValueChange={(val) => onInstallmentsChange?.(val)}
            min={1}
            max={60}
            decreaseLabel="Diminuir parcelas"
            increaseLabel="Aumentar parcelas"
            format={(value) => `${value}×`}
          />
        </div>
      ) : null}

      {paymentCondition === "recurring" ? (
        <div className="flex flex-col gap-3 border-t border-border/80 pt-2">
          <Checkbox
            checked={state.recurring}
            onCheckedChange={onRecurringToggle}
            label="Lançamento recorrente"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Frequência</span>
            <Select
              value={state.recurrenceFrequency}
              onValueChange={(value) => onRecurrenceFrequencyChange(value as RecurrenceFrequency)}
              options={RECURRENCE_FREQUENCIES.map((frequency) => ({
                value: frequency,
                label: RECURRENCE_FREQUENCY_LABELS[frequency],
              }))}
              ariaLabel="Frequência da recorrência"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Quando termina</span>
            <RadioGroup
              value={state.recurrenceEndMode}
              onValueChange={(val) => onRecurrenceEndModeChange(val as "date" | "count")}
              name="recurrence-end"
              options={[
                { value: "date", label: "Data de fim" },
                { value: "count", label: "Número de ocorrências" },
              ]}
            />
          </div>
          {state.recurrenceEndMode === "date" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Data de fim</span>
              <DatePicker value={state.recurrenceEndDate} onValueChange={onRecurrenceEndDateChange} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Número de ocorrências</span>
              <NumberStepper
                value={state.recurrenceCount}
                onValueChange={onRecurrenceCountChange}
                min={1}
                max={MAX_RECURRENCE_OCCURRENCES}
                decreaseLabel="Diminuir ocorrências"
                increaseLabel="Aumentar ocorrências"
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            A primeira ocorrência será lançada na data informada acima; as demais seguirão a frequência escolhida.
          </p>
        </div>
      ) : null}
    </div>
  );
}
