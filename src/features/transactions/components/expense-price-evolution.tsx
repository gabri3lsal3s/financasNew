import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { monthLabel } from "@/lib/date";
import type { evaluateExpensePriceEvolution } from "@/domain/insights";

export type PriceEvolutionData = NonNullable<ReturnType<typeof evaluateExpensePriceEvolution>>;

export interface ExpensePriceEvolutionProps {
  evolution: PriceEvolutionData;
}

/** Card comparativo da evolução histórica do gasto em relação aos meses anteriores. */
export function ExpensePriceEvolution({ evolution }: ExpensePriceEvolutionProps) {
  const prevCents = evolution.deltaPreviousCents ?? 0;
  const medianCents = evolution.deltaMedianCents ?? 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-xs shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          {evolution.hasPriceIncrease ? (
            <TrendingUp className="size-4 text-warning-strong" aria-hidden="true" />
          ) : prevCents < 0 ? (
            <TrendingDown className="size-4 text-positive-strong" aria-hidden="true" />
          ) : (
            <Minus className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span>Evolução do Gasto</span>
        </div>
        {evolution.hasPriceIncrease && evolution.deltaPreviousPercent !== null ? (
          <Badge variant="warning" size="xs">
            Reajuste +{evolution.deltaPreviousPercent}%
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-surface p-2">
          <span className="text-muted-foreground">vs Mês Anterior</span>
          <div className="flex items-center gap-1 font-semibold tabular-nums">
            <MoneyText
              cents={prevCents}
              tone={prevCents > 0 ? "negative" : prevCents < 0 ? "positive" : "default"}
              sign="explicit"
            />
            {evolution.deltaPreviousPercent !== null ? (
              <span className="text-muted-foreground">
                ({evolution.deltaPreviousPercent > 0 ? `+${evolution.deltaPreviousPercent}%` : `${evolution.deltaPreviousPercent}%`})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-surface p-2">
          <span className="text-muted-foreground">vs Média Histórica</span>
          <div className="flex items-center gap-1 font-semibold tabular-nums">
            <MoneyText
              cents={medianCents}
              tone={medianCents > 0 ? "negative" : medianCents < 0 ? "positive" : "default"}
              sign="explicit"
            />
            {evolution.deltaMedianPercent !== null ? (
              <span className="text-muted-foreground">
                ({evolution.deltaMedianPercent > 0 ? `+${evolution.deltaMedianPercent}%` : `${evolution.deltaMedianPercent}%`})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-surface p-2">
          <span className="text-muted-foreground">
            1º Registro{evolution.firstOccurrenceDate ? ` (${monthLabel(evolution.firstOccurrenceDate.slice(0, 7))})` : ""}
          </span>
          <div className="flex items-center gap-1 font-semibold tabular-nums">
            <MoneyText cents={evolution.firstOccurrenceCents ?? 0} tone="default" />
            {evolution.deltaFirstPercent !== null ? (
              <span className="text-muted-foreground">
                ({evolution.deltaFirstPercent >= 0 ? `+${evolution.deltaFirstPercent}%` : `${evolution.deltaFirstPercent}%`})
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
