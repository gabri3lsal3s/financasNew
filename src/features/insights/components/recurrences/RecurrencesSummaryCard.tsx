import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface RecurrencesSummaryCardProps {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
  cancelledAnnualSavingsCents: number;
  fixedCommitmentRate: number | null;
}

export function RecurrencesSummaryCard({
  totalRecurringCents,
  totalAnnualRecurringCents,
  canCutRecurringCents,
  canCutAnnualCents,
  cancelledAnnualSavingsCents,
  fixedCommitmentRate,
}: RecurrencesSummaryCardProps) {
  const totalMetricsCount =
    3 +
    (canCutRecurringCents > 0 ? 1 : 0) +
    (cancelledAnnualSavingsCents > 0 ? 1 : 0);

  const gridColsClass =
    totalMetricsCount >= 5
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : totalMetricsCount === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0">
      <div className={cn("grid gap-4 sm:gap-6 w-full", gridColsClass)}>
        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Total mensal recorrente</span>
          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
            <MoneyText
              cents={totalRecurringCents}
              tone="default"
              animated
              className="text-xl sm:text-2xl font-bold"
            />
            <span className="text-xs text-muted-foreground">/mês</span>
          </div>
        </div>

        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Comprometimento fixo</span>
          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
            <span
              className={cn(
                "num text-xl sm:text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap",
                fixedCommitmentRate != null && fixedCommitmentRate > 50
                  ? "text-negative-strong"
                  : fixedCommitmentRate != null && fixedCommitmentRate > 30
                    ? "text-warning-strong"
                    : "text-foreground",
              )}
            >
              {fixedCommitmentRate != null
                ? `${fixedCommitmentRate.toFixed(1).replace(".", ",")}%`
                : "—"}
            </span>
            <span className="text-xs text-muted-foreground">da renda</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {fixedCommitmentRate != null
              ? "Fatia da renda comprometida antes do mês iniciar"
              : "Cadastre sua renda para ver o percentual"}
          </p>
        </div>

        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Total anual projetado</span>
          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
            <MoneyText
              cents={totalAnnualRecurringCents}
              tone="default"
              animated
              className="text-xl sm:text-2xl font-bold"
            />
            <span className="text-xs text-muted-foreground">/ano</span>
          </div>
        </div>

        {canCutRecurringCents > 0 ? (
          <div className="min-w-0">
            <span className="text-xs font-medium text-positive-strong">
              Economia potencial (corte)
            </span>
            <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
              <MoneyText
                cents={canCutRecurringCents}
                tone="positive"
                animated
                className="text-xl sm:text-2xl font-bold"
              />
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs font-medium text-positive-strong mt-0.5">
              +<MoneyText cents={canCutAnnualCents} tone="positive" /> ao ano
            </p>
          </div>
        ) : null}

        {cancelledAnnualSavingsCents > 0 ? (
          <div className="min-w-0">
            <span className="text-xs font-medium text-positive-strong">
              Economia celebrada (canceladas)
            </span>
            <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
              <MoneyText
                cents={cancelledAnnualSavingsCents}
                tone="positive"
                animated
                className="text-xl sm:text-2xl font-bold"
              />
              <span className="text-xs text-muted-foreground">/ano</span>
            </div>
            <p className="text-xs font-medium text-positive-strong mt-0.5">
              Conquistada com sucesso
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
