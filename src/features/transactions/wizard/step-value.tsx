import { Clock } from "lucide-react";
import { Badge, MoneyInput, NumberStepper, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import type { HabitualEntry } from "@/domain/predictions";
import type { LaunchState, EntryType } from "./wizard-state";

export interface StepValueProps {
  state: LaunchState;
  onTypeChange: (type: EntryType) => void;
  onValueChange: (cents: number) => void;
  onInstallmentsChange: (count: number) => void;
  /** Preenche o lançamento a partir de um habitual (F21 — 1 toque). */
  onApplyHabitual: (habit: HabitualEntry) => void;
  /** Lançamentos habituais derivados do histórico (F21) — vazio oculta. */
  habits: HabitualEntry[];
  /** Callback para avançar de etapa no Enter */
  onNext?: () => void;
}

/** Passo 1 — tipo, valor e parcelas (defaults inteligentes: focar no valor). */
export function StepValue({ state, onTypeChange, onValueChange, onInstallmentsChange, onApplyHabitual, habits, onNext }: StepValueProps) {
  const isExpense = state.type === "expense";
  // Fase 32 — parcelamento e recorrência são mutuamente exclusivos; o stepper
  // de parcelas vale para despesas E rendas parceladas.
  const showInstallments = !state.recurring;

  return (
    <div className="flex flex-col gap-6">
      {habits.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            Habituais ({isExpense ? "despesas" : "rendas"})
          </p>
          <div className="flex flex-col gap-1.5">
            {habits.map((habit) => (
              <button
                key={`${habit.description}-${habit.categoryName}`}
                type="button"
                onClick={() => {
                  triggerSensory("action");
                  onApplyHabitual(habit);
                }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-raised px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">{habit.description}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{habit.categoryName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <MoneyText cents={Math.round(habit.value * 100)} tone="default" className="num text-sm tabular-nums whitespace-nowrap" />
                  <Badge variant="muted" size="xs">
                    {habit.frequency}×
                  </Badge>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Tabs
        value={state.type}
        onValueChange={(value) => {
          triggerSensory("selection");
          onTypeChange(value as EntryType);
        }}
        items={[
          { value: "expense", label: "Despesa", content: null },
          { value: "income", label: "Renda", content: null },
        ]}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="wizard-value" className="text-xs font-semibold text-foreground">
          Valor
        </label>
        <MoneyInput
          id="wizard-value"
          cents={state.valueCents}
          onCentsChange={onValueChange}
          aria-label="Valor do lançamento"
          onKeyDown={(event) => {
            if (event.key === "Enter" && state.valueCents > 0) {
              event.preventDefault();
              onNext?.();
            }
          }}
        />
      </div>

      {showInstallments ? (
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
