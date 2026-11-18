import {
  isInheritedLimit,
  reallocationSuggestion,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
  type BudgetLimitEntry,
} from "@/domain/budgets";
import { sumGrossCents, sumWeightedCents } from "@/domain/money";
import type { Category, Expense } from "@/types";
import type { BudgetAdjustCategoryItem } from "./budget-adjust-dialog";
import type { BudgetCategoryRowData } from "./budget-category-row";

export function deriveBudgetsLimitsData(params: {
  categories: Category[];
  limitsByCategory: Map<string, BudgetLimitEntry[]>;
  expenses: Expense[];
  month: string;
  spendMetric: "personal" | "household";
  showAllCategories: boolean;
  effectiveHighlightId: string | null;
}) {
  const {
    categories,
    limitsByCategory,
    expenses,
    month,
    spendMetric,
    showAllCategories,
    effectiveHighlightId,
  } = params;

  const totalExpensesWeightedCents = sumWeightedCents(expenses);
  const totalExpensesGrossCents = sumGrossCents(expenses);
  const totalExpensesCents =
    spendMetric === "personal" ? totalExpensesWeightedCents : totalExpensesGrossCents;

  const spentWeightedByCategory = spentByCategoryMap(expenses);
  const spentGrossByCategory = spentGrossByCategoryMap(expenses);

  const allExpenseRows: BudgetCategoryRowData[] = categories.map((category) => {
    const ownHistory = limitsByCategory.get(category.id) ?? [];
    const spentWeighted = spentWeightedByCategory.get(category.id) ?? 0;
    const spentGross = spentGrossByCategory.get(category.id) ?? 0;
    return {
      category,
      limitCents: resolveEffectiveLimit(ownHistory, month),
      spentCents: spendMetric === "personal" ? spentWeighted : spentGross,
      spentWeightedCents: spentWeighted,
      spentGrossCents: spentGross,
      hasSplitDifference: spentGross !== spentWeighted,
      inherited: isInheritedLimit(ownHistory, month),
    };
  });

  const activeRows = allExpenseRows
    .filter((row) => row.limitCents > 0 || row.spentCents > 0)
    .sort((a, b) => {
      const pctA = a.limitCents > 0 ? a.spentCents / a.limitCents : a.spentCents > 0 ? 999 : 0;
      const pctB = b.limitCents > 0 ? b.spentCents / b.limitCents : b.spentCents > 0 ? 999 : 0;
      return pctB - pctA;
    });

  const unbudgetedRows = allExpenseRows.filter(
    (row) => row.limitCents === 0 && row.spentCents === 0,
  );
  const isHighlightedUnbudgeted = Boolean(
    effectiveHighlightId && unbudgetedRows.some((r) => r.category.id === effectiveHighlightId),
  );
  const rows = showAllCategories || isHighlightedUnbudgeted ? allExpenseRows : activeRows;

  const budgetedRows = allExpenseRows.filter((row) => row.limitCents > 0);
  const totalLimitsCents = budgetedRows.reduce((acc, row) => acc + row.limitCents, 0);
  const totalBudgetedExpensesCents = budgetedRows.reduce((acc, row) => acc + row.spentCents, 0);
  const totalUnbudgetedExpensesCents = Math.max(0, totalExpensesCents - totalBudgetedExpensesCents);
  const hasBudgetLimits = totalLimitsCents > 0;
  const hasPartialBudgets = hasBudgetLimits && totalUnbudgetedExpensesCents > 0;

  const suggestion = reallocationSuggestion(
    activeRows.map((row) => ({
      categoryId: row.category.id,
      limitCents: row.limitCents,
      spentCents: row.spentCents,
    })),
  );

  const adjustCategories: BudgetAdjustCategoryItem[] = allExpenseRows.map((r) => ({
    category: r.category,
    currentLimitCents: r.limitCents,
  }));

  return {
    totalExpensesWeightedCents,
    totalExpensesGrossCents,
    totalExpensesCents,
    rows,
    unbudgetedRows,
    budgetedRowsCount: budgetedRows.length,
    totalLimitsCents,
    totalBudgetedExpensesCents,
    totalUnbudgetedExpensesCents,
    hasBudgetLimits,
    hasPartialBudgets,
    suggestion,
    fromCategory: suggestion ? categories.find((c) => c.id === suggestion.fromCategoryId) : undefined,
    toCategory: suggestion ? categories.find((c) => c.id === suggestion.toCategoryId) : undefined,
    adjustCategories,
  };
}
