import { PiggyBank, Plus, Target } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import type { Category } from "@/types";
import { BudgetCategoryRow, type BudgetCategoryRowData } from "../budget-category-row";
import { BudgetsLimitsSummaryCard } from "./budgets-limits-summary-card";
import { BudgetsMetricToggle } from "./budgets-metric-toggle";
import { BudgetsReallocationBanner } from "./budgets-reallocation-banner";

export type BudgetsLimitsRow = BudgetCategoryRowData;

export interface BudgetsLimitsTabProps {
  month: string;
  onMonthChange: (month: string) => void;
  spendMetric: "personal" | "household";
  onSpendMetricChange: (metric: "personal" | "household") => void;
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
  suggestion: { amountCents: number; fromCategoryId: string; toCategoryId: string } | null;
  fromCategory: Category | undefined;
  toCategory: Category | undefined;
  onOpenReallocate: () => void;
  isLoading: boolean;
  rows: BudgetsLimitsRow[];
  unbudgetedRows: BudgetsLimitsRow[];
  effectiveHighlightId: string | null;
  onOpenLimit: (category: Category) => void;
  onEditCategory: (category: Category) => void;
  onOpenCreateCategory: () => void;
  showAllCategories: boolean;
  onToggleShowAllCategories: () => void;
}

export function BudgetsLimitsTab({
  month,
  onMonthChange,
  spendMetric,
  onSpendMetricChange,
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
  suggestion,
  fromCategory,
  toCategory,
  onOpenReallocate,
  isLoading,
  rows,
  unbudgetedRows,
  effectiveHighlightId,
  onOpenLimit,
  onEditCategory,
  onOpenCreateCategory,
  showAllCategories,
  onToggleShowAllCategories,
}: BudgetsLimitsTabProps) {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <MonthPicker value={month} onValueChange={onMonthChange} />

      <BudgetsMetricToggle
        spendMetric={spendMetric}
        onSpendMetricChange={onSpendMetricChange}
      />

      <BudgetsLimitsSummaryCard
        spendMetric={spendMetric}
        totalExpensesGrossCents={totalExpensesGrossCents}
        totalExpensesWeightedCents={totalExpensesWeightedCents}
        hasBudgetLimits={hasBudgetLimits}
        totalBudgetedExpensesCents={totalBudgetedExpensesCents}
        totalExpensesCents={totalExpensesCents}
        hasPartialBudgets={hasPartialBudgets}
        totalLimitsCents={totalLimitsCents}
        totalUnbudgetedExpensesCents={totalUnbudgetedExpensesCents}
        budgetedRowsCount={budgetedRowsCount}
        categoriesCount={categoriesCount}
        onOpenAdjustBudget={onOpenAdjustBudget}
      />

      {suggestion && fromCategory && toCategory ? (
        <BudgetsReallocationBanner
          fromCategory={fromCategory}
          toCategory={toCategory}
          amountCents={suggestion.amountCents}
          onOpenReallocate={onOpenReallocate}
        />
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs min-w-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-28 sm:w-36" />
                    <Skeleton className="h-3 w-20 sm:w-28" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" aria-hidden="true" />}
          title="Nenhum orçamento configurado"
          description={
            categoriesCount > 0
              ? "Você já possui categorias criadas. Ative a visualização de categorias para definir o teto mensal de cada uma."
              : "Defina um limite mensal por categoria de despesa para acompanhar os gastos ou crie uma nova categoria."
          }
          action={
            categoriesCount > 0 ? (
              <Button size="sm" sensoryIntent="selection" onClick={onToggleShowAllCategories} className="gap-1.5">
                <Target className="size-4" aria-hidden="true" />
                Definir limites por categoria
              </Button>
            ) : (
              <Button size="sm" onClick={onOpenCreateCategory} className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                Nova categoria
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <BudgetCategoryRow
              key={row.category.id}
              row={row}
              spendMetric={spendMetric}
              highlightId={effectiveHighlightId}
              onOpenLimit={onOpenLimit}
              onEditCategory={onEditCategory}
            />
          ))}

          {unbudgetedRows.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                sensoryIntent="selection"
                onClick={onToggleShowAllCategories}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAllCategories
                  ? "Ocultar categorias sem limite ou gasto no mês"
                  : `Ver outras ${unbudgetedRows.length} categorias cadastradas`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
