import { Flag } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { Switch } from "@/components/ui/switch";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import type { PatrimonyProjectionResult, PatrimonyProjectionYear } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface FireProjectionMetricsProps {
  years: number;
  monthlyAporte: number;
  monthlyExpenses: number;
  hasComparison: boolean;
  realValues: boolean;
  onRealValuesChange: (checked: boolean) => void;
  activePoint: PatrimonyProjectionYear;
  fireCrossover: PatrimonyProjectionYear | null;
  projection: PatrimonyProjectionResult;
  onSelectMilestone: (year: number) => void;
}

export function FireProjectionMetrics({
  years,
  monthlyAporte,
  monthlyExpenses,
  hasComparison,
  realValues,
  onRealValuesChange,
  activePoint,
  fireCrossover,
  projection,
  onSelectMilestone,
}: FireProjectionMetricsProps) {
  const livingCostCents = Math.round(monthlyExpenses * 100);
  const livingCostCoveragePct =
    livingCostCents > 0
      ? Math.round((activePoint.monthlyPassiveIncomeCents / livingCostCents) * 100)
      : 0;
  const horizonProgressPct =
    fireCrossover && fireCrossover.year > 0
      ? Math.min(100, (activePoint.year / fireCrossover.year) * 100)
      : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-positive-strong" aria-hidden="true" />
            <span>Com aportes</span>
          </span>
          {hasComparison ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-4 border-t border-dashed border-muted-foreground/70"
                aria-hidden="true"
              />
              <span>Sem aportes</span>
            </span>
          ) : null}
        </div>
        <Switch
          checked={realValues}
          onCheckedChange={onRealValuesChange}
          label="Valores reais"
          aria-label="Descontar a inflação de 4% ao ano"
          className="shrink-0"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
        <button
          type="button"
          onClick={() => onSelectMilestone(0)}
          className={cn(
            "min-h-11 sm:min-h-9 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border text-center font-semibold",
            activePoint.year === 0
              ? "bg-primary-strong text-primary-foreground border-primary-strong dark:bg-primary dark:border-primary"
              : "bg-surface border-border/80 text-muted-foreground hover:text-foreground",
          )}
        >
          Hoje
        </button>

        {fireCrossover ? (
          <button
            type="button"
            onClick={() => onSelectMilestone(fireCrossover.year)}
            className={cn(
              "min-h-11 sm:min-h-9 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border text-center font-semibold flex items-center gap-1.5",
              activePoint.year === fireCrossover.year
                ? "bg-positive/15 border-positive-strong text-positive-strong shadow-xs"
                : "bg-surface border-positive-strong/40 text-positive-strong hover:bg-positive/10",
            )}
          >
            <Flag className="size-3" aria-hidden="true" />
            <span>Independência ({fireCrossover.year}a)</span>
          </button>
        ) : (
          <span className="px-2 py-1.5 text-xs text-muted-foreground">
            Meta não alcançada em {years} anos
          </span>
        )}
      </div>

      {projection.interestExceedsContributionAt ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Ponto de inflexão: a partir de {projection.interestExceedsContributionAt.year}a
          {projection.interestExceedsContributionAt.month}m a rentabilidade mensal supera o aporte de{" "}
          {formatCentsAsBRL(Math.round(monthlyAporte * 100), { hideCents: true })}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Horizonte</span>
            <span className="size-1.5 rounded-full bg-positive-strong shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <span className="font-mono font-bold text-foreground text-sm sm:text-base tabular-nums tracking-tight block whitespace-nowrap">
              {activePoint.year === 0 ? "Hoje" : `${activePoint.year} anos`}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {fireCrossover
                ? `Meta em ${fireCrossover.year} anos`
                : `Horizonte de ${years} anos`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, horizonProgressPct))}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Patrimônio</span>
            <span className="size-1.5 rounded-full bg-portfolio shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <MoneyText
              cents={activePoint.balanceCents}
              tone="default"
              hideCents
              className="font-bold text-foreground text-sm sm:text-base block"
            />
            <span className="text-xs text-muted-foreground block mt-0.5">
              {formatPercent(activePoint.targetProgressPct)}% da meta
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-portfolio transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, activePoint.targetProgressPct))}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 rounded-xl bg-surface border border-border/80 shadow-xs text-left min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-muted-foreground">Renda passiva</span>
            <span className="size-1.5 rounded-full bg-positive-strong shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 min-w-0">
            <MoneyText
              cents={activePoint.monthlyPassiveIncomeCents}
              tone="positive"
              hideCents
              className="font-bold text-sm sm:text-base block"
            />
            <span className="text-xs text-muted-foreground block mt-0.5">
              {livingCostCoveragePct}% do custo de vida
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 mt-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-positive-strong transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, livingCostCoveragePct))}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
