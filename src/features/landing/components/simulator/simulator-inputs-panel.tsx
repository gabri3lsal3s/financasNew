import { useId } from "react";
import { FormField } from "@/components/ui/form-field";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { STRATEGY_PRESETS, type StrategyPresetKey } from "@/domain/portfolio/simulation-presets";
import { numberToCents } from "@/domain/money/parse";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

const PATRIMONY_PRESETS = [25000, 100000, 300000] as const;
const APORTE_PRESETS = [1500, 3000, 6000] as const;

export interface SimulatorInputsPanelProps {
  strategy: StrategyPresetKey;
  onStrategyChange: (key: StrategyPresetKey) => void;
  patrimonyBase: number;
  onPatrimonyBaseChange: (value: number) => void;
  aporteAmount: number;
  onAporteAmountChange: (value: number) => void;
}

export function SimulatorInputsPanel({
  strategy,
  onStrategyChange,
  patrimonyBase,
  onPatrimonyBaseChange,
  aporteAmount,
  onAporteAmountChange,
}: SimulatorInputsPanelProps) {
  const patrimonyInputId = useId();
  const aporteInputId = useId();
  const currentStrategy = STRATEGY_PRESETS[strategy];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 border-b border-border/60 pb-5 sm:pb-8">
      <div className="space-y-2">
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-semibold">
          <span className="text-foreground">Perfil de Alocação:</span>
          <span className="text-primary-strong dark:text-primary font-bold">
            {currentStrategy.buttonLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {(Object.keys(STRATEGY_PRESETS) as StrategyPresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                triggerSensory("selection", { skipSound: true });
                onStrategyChange(key);
              }}
              aria-pressed={strategy === key}
              className={cn(
                "min-h-11 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border text-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                strategy === key
                  ? "bg-primary-strong text-primary-foreground border-primary-strong dark:bg-primary dark:border-primary shadow-xs font-bold"
                  : "bg-surface border-border/80 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {STRATEGY_PRESETS[key].buttonLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2.5 min-w-0">
          <div className="flex justify-between items-center gap-2 text-xs font-semibold">
            <span className="text-foreground">Patrimônio Atual:</span>
            <MoneyText
              cents={numberToCents(patrimonyBase)}
              hideCents
              tone="default"
              className="font-bold text-primary-strong dark:text-primary text-sm"
            />
          </div>
          <FormField htmlFor={patrimonyInputId}>
            <MoneyInput
              id={patrimonyInputId}
              cents={numberToCents(patrimonyBase)}
              onCentsChange={(cents) => onPatrimonyBaseChange(cents / 100)}
              aria-label="Valor do patrimônio atual"
            />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            {PATRIMONY_PRESETS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  triggerSensory("selection", { skipSound: true });
                  onPatrimonyBaseChange(val);
                }}
                aria-pressed={patrimonyBase === val}
                className={cn(
                  "min-h-11 py-2 px-2 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer border text-center whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  patrimonyBase === val
                    ? "bg-primary-strong text-primary-foreground border-primary-strong dark:bg-primary dark:border-primary shadow-xs font-bold"
                    : "bg-surface border-border/80 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {`R$ ${val / 1000}k`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 min-w-0">
          <div className="flex justify-between items-center gap-2 text-xs font-semibold">
            <span className="text-foreground">Aporte Mensal:</span>
            <MoneyText
              cents={numberToCents(aporteAmount)}
              hideCents
              tone="default"
              className="font-bold text-primary-strong dark:text-primary text-sm"
            />
          </div>
          <FormField htmlFor={aporteInputId}>
            <MoneyInput
              id={aporteInputId}
              cents={numberToCents(aporteAmount)}
              onCentsChange={(cents) => onAporteAmountChange(cents / 100)}
              aria-label="Valor do aporte mensal"
            />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            {APORTE_PRESETS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  triggerSensory("selection", { skipSound: true });
                  onAporteAmountChange(val);
                }}
                aria-pressed={aporteAmount === val}
                className={cn(
                  "min-h-11 py-2 px-2 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer border text-center whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  aporteAmount === val
                    ? "bg-primary-strong text-primary-foreground border-primary-strong dark:bg-primary dark:border-primary shadow-xs font-bold"
                    : "bg-surface border-border/80 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {`R$ ${val / 1000}k`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
