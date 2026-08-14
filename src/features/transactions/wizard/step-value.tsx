import { MoneyInput, NumberStepper, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { LaunchState, EntryType } from "./wizard-state";

export interface StepValueProps {
  state: LaunchState;
  onTypeChange: (type: EntryType) => void;
  onValueChange: (cents: number) => void;
  onInstallmentsChange: (count: number) => void;
}

/** Passo 1 — tipo, valor e parcelas (defaults inteligentes: focar no valor). */
export function StepValue({ state, onTypeChange, onValueChange, onInstallmentsChange }: StepValueProps) {
  const isExpense = state.type === "expense";

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={state.type}
        onValueChange={(value) => onTypeChange(value as EntryType)}
        items={[
          { value: "expense", label: "Despesa", content: null },
          { value: "income", label: "Renda", content: null },
        ]}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="wizard-value" className="text-sm font-medium">
          Valor
        </label>
        <MoneyInput
          id="wizard-value"
          cents={state.valueCents}
          onCentsChange={onValueChange}
          autoFocus
          aria-label="Valor do lançamento"
        />
      </div>

      {isExpense ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Parcelas</span>
            <span className="num text-sm text-muted-foreground">{state.installments}×</span>
          </div>
          <NumberStepper
            value={state.installments}
            onValueChange={onInstallmentsChange}
            min={1}
            max={60}
            decreaseLabel="Diminuir parcelas"
            increaseLabel="Aumentar parcelas"
            format={(value) => `${value}×`}
          />
          {state.installments > 1 && state.valueCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              {state.installments}× de <MoneyText cents={Math.ceil(state.valueCents / state.installments)} tone="default" className="privacy-mask text-xs" />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
