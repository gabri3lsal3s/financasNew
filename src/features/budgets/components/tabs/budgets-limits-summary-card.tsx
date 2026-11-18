import { Info, SlidersHorizontal } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";
import { formatCentsAsBRL } from "@/services/masks";
import { cn } from "@/lib/utils";

export interface BudgetsLimitsSummaryCardProps {
  spendMetric: "personal" | "household";
  totalExpensesGrossCents: number;
  totalExpensesWeightedCents: number;
  hasBudgetLimits: boolean;
  totalBudgetedExpensesCents: number;
  totalExpensesCents: number;
  hasPartialBudgets: boolean;
  totalLimitsCents: number;
  totalUnbudgetedExpensesCents: number;
  budgetedRowsCount: number;
  categoriesCount: number;
  onOpenAdjustBudget: () => void;
}

/** Card consolidado de consumo vs teto planejado no módulo de Orçamentos. */
export function BudgetsLimitsSummaryCard({
  spendMetric,
  totalExpensesGrossCents,
  totalExpensesWeightedCents,
  hasBudgetLimits,
  totalBudgetedExpensesCents,
  totalExpensesCents,
  hasPartialBudgets,
  totalLimitsCents,
  totalUnbudgetedExpensesCents,
  budgetedRowsCount,
  categoriesCount,
  onOpenAdjustBudget,
}: BudgetsLimitsSummaryCardProps) {
  const masked = usePrivacyMask();
  const ratio = totalLimitsCents > 0 ? totalBudgetedExpensesCents / totalLimitsCents : 0;
  const percent = Math.min(100, ratio * 100);

  const metricTooltip = masked
    ? undefined
    : spendMetric === "personal"
      ? `Total nominal bruto das despesas: ${formatCentsAsBRL(totalExpensesGrossCents)}`
      : `Sua parte proporcional líquida: ${formatCentsAsBRL(totalExpensesWeightedCents)}`;

  return (
    <div
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs"
      data-tour="budgets-content"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total Gasto
            </p>
            <Badge variant="muted" size="xs" className="max-w-full truncate">
              {spendMetric === "personal" ? "Minha Parte" : "Total Bruto"}
            </Badge>
            {totalExpensesGrossCents !== totalExpensesWeightedCents && (
              <span
                className="text-muted-foreground/80 hover:text-foreground cursor-help"
                title={metricTooltip}
              >
                <Info className="size-3.5 inline" aria-hidden="true" />
              </span>
            )}
          </div>
          <MoneyText
            cents={hasBudgetLimits ? totalBudgetedExpensesCents : totalExpensesCents}
            tone="default"
            animated
            className="text-base sm:text-lg font-bold text-foreground block mt-0.5"
          />
          {hasPartialBudgets && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              de{" "}
              <MoneyText
                cents={totalExpensesCents}
                tone="default"
                variant="caption"
                className="text-[11px] font-medium text-muted-foreground"
              />{" "}
              gastos no total do mês
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Teto Planejado
            </p>
            {!hasBudgetLimits && (
              <Badge variant="muted" size="xs">
                Sem limites
              </Badge>
            )}
          </div>
          {hasBudgetLimits ? (
            <MoneyText
              cents={totalLimitsCents}
              tone="default"
              animated
              className="text-base sm:text-lg font-semibold text-muted-foreground block mt-0.5"
            />
          ) : (
            <span className="text-base sm:text-lg font-semibold text-muted-foreground tabular-nums block mt-0.5">
              —
            </span>
          )}
          {!hasBudgetLimits && (
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Nenhum limite ativo no mês
            </span>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {hasBudgetLimits
              ? totalLimitsCents >= totalBudgetedExpensesCents
                ? "Disponível no Teto"
                : "Excedido no Teto"
              : "Status do Mês"}
          </p>
          {hasBudgetLimits ? (
            <MoneyText
              cents={Math.abs(totalLimitsCents - totalBudgetedExpensesCents)}
              tone={totalLimitsCents >= totalBudgetedExpensesCents ? "positive" : "negative"}
              animated
              className="text-base sm:text-lg font-bold block mt-0.5"
            />
          ) : (
            <span className="text-base sm:text-lg font-semibold text-muted-foreground whitespace-nowrap block mt-0.5">
              Livre de teto
            </span>
          )}
          {hasBudgetLimits && hasPartialBudgets && (
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              {budgetedRowsCount} de {categoriesCount} categorias orçadas
            </span>
          )}
        </div>
      </div>

      {hasBudgetLimits ? (
        <div className="mt-3.5 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 gap-2">
            <span>Consumo do Teto ({spendMetric === "personal" ? "Minha Parte" : "Total Bruto"})</span>
            <span className="font-semibold text-foreground tabular-nums shrink-0">
              {Math.round(ratio * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover/80 dark:bg-muted/80 ring-1 ring-inset ring-border/40">
            <div
              className={cn(
                "h-full rounded-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none",
                totalBudgetedExpensesCents > totalLimitsCents
                  ? "bg-critical"
                  : ratio >= 0.85
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {hasPartialBudgets && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
              Despesas em categorias livres (sem teto):{" "}
              <MoneyText
                cents={totalUnbudgetedExpensesCents}
                tone="default"
                variant="caption"
                className="font-medium text-foreground text-[11px]"
              />
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3.5 pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
          <span>
            Você não possui tetos de gastos configurados para este mês. Todas as suas categorias estão livres de limites.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAdjustBudget}
            className="shrink-0 self-start sm:self-auto gap-1.5"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Definir limites</span>
          </Button>
        </div>
      )}
    </div>
  );
}
