import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Badge, NumberStepperInput } from "@/components/ui";
import type { AllocationTarget } from "@/types";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepTargetProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  targets: readonly AllocationTarget[];
}

export function StepTarget({ state, onChange, targets }: StepTargetProps) {
  const currentSum = useMemo(
    () => targets.reduce((acc, t) => acc + t.target_percentage, 0),
    [targets],
  );

  const newTarget = state.targetPercentage ?? 0;
  const projectedSum = currentSum + newTarget;
  const isOver100 = projectedSum > 100;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Definir Meta de Alocação %</h3>
        <p className="text-xs text-muted-foreground">
          Indique quanto este ativo deve representar no seu patrimônio ideal (utilizado pela calculadora de rebalanceamento).
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface/80 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-foreground">{state.ticker}</span>
          <Badge variant="muted" className="text-xs">
            {state.assetClass}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <NumberStepperInput
            value={state.targetPercentage ?? 0}
            onValueChange={(val) => {
              const num = val ? Number(val) : null;
              onChange({ targetPercentage: Number.isFinite(num) ? num : null });
            }}
            min={0}
            max={100}
            step={1}
            placeholder="0"
            className="w-full"
          />
        </div>
      </div>

      {/* Barra de Progresso da Soma de Metas */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/40 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Soma das metas da carteira:</span>
          <span className={`font-mono font-bold ${isOver100 ? "text-negative-strong" : "text-foreground"}`}>
            {projectedSum.toFixed(1)}% / 100%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover/80">
          <div
            className={`h-full transition-all duration-300 ${
              isOver100 ? "bg-negative-strong" : projectedSum === 100 ? "bg-positive-strong" : "bg-primary"
            }`}
            style={{ width: `${Math.min(100, projectedSum)}%` }}
          />
        </div>

        {isOver100 && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-negative-strong">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>A soma das metas excederá 100%. Você poderá normalizá-las depois na aba Metas.</span>
          </div>
        )}
      </div>
    </div>
  );
}
