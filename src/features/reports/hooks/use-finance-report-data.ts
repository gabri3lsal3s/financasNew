import { useCallback, useMemo } from "react";
import { budgetLimitsByCategory } from "@/domain/budgets";
import { numberToCents } from "@/domain/money";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  weightedCents,
  type ReportPeriodMode,
} from "@/domain/reports";
import { currentMonth, shiftMonth, yearRange } from "@/lib/date";
import {
  useBudgets,
  useCategories,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useFamilyConsolidation,
  useFamilyMode,
  useIncomes,
  useIncomesByRange,
  useMyFamily,
  useRealCashBalance,
} from "@/state";

export interface UseFinanceReportDataParams {
  enabled: boolean;
  weightsEnabled: boolean;
  mode: ReportPeriodMode;
  month: string;
  year: number;
  range: { start: string; end: string };
  isYear: boolean;
  isCustom: boolean;
  customValid: boolean;
}

/**
 * Consulta e agrega dados financeiros (receitas, despesas, categorias, dívidas e família)
 * para a aba Finanças & DRE, respeitando o gate `enabled`.
 */
export function useFinanceReportData({
  enabled,
  weightsEnabled,
  mode,
  month,
  year,
  range,
  isYear,
  isCustom,
  customValid,
}: UseFinanceReportDataParams) {
  const monthlyExpenses = useExpenses(month, { enabled });
  const monthlyIncomes = useIncomes(month, { enabled });
  const prevExpenses = useExpenses(shiftMonth(month, -1), { enabled });
  const prevIncomes = useIncomes(shiftMonth(month, -1), { enabled });

  const yearExpenses = useExpensesByRange(range.start, range.end, { enabled: isYear && enabled });
  const yearIncomes = useIncomesByRange(range.start, range.end, { enabled: isYear && enabled });
  const prevYearRange = isYear ? yearRange(year - 1) : { start: "", end: "" };
  const prevYearExpenses = useExpensesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && enabled });
  const prevYearIncomes = useIncomesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && enabled });

  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid && enabled });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid && enabled });
  const debtsQuery = useDebts({ enabled });
  const realCashQuery = useRealCashBalance();
  const categoriesQuery = useCategories(undefined, { enabled });
  const budgetsQuery = useBudgets();
  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily({ enabled });
  const hasFamily = Boolean(myFamilyQuery.data?.family?.id);
  const familyConsolidationQuery = useFamilyConsolidation(mode === "month" ? month : currentMonth(), {
    enabled: enabled && hasFamily && isFamilyModeEnabled && mode === "month",
  });

  const expenses = useMemo(
    () =>
      !enabled
        ? []
        : mode === "month"
          ? monthlyExpenses.data ?? []
          : mode === "year"
            ? yearExpenses.data ?? []
            : customValid
              ? rangeExpenses.data ?? []
              : [],
    [enabled, mode, monthlyExpenses.data, yearExpenses.data, customValid, rangeExpenses.data],
  );

  const incomes = useMemo(
    () =>
      !enabled
        ? []
        : mode === "month"
          ? monthlyIncomes.data ?? []
          : mode === "year"
            ? yearIncomes.data ?? []
            : customValid
              ? rangeIncomes.data ?? []
              : [],
    [enabled, mode, monthlyIncomes.data, yearIncomes.data, customValid, rangeIncomes.data],
  );

  const loading = enabled
    ? (mode === "month"
        ? monthlyExpenses.isLoading || monthlyIncomes.isLoading || prevExpenses.isLoading || prevIncomes.isLoading
        : mode === "year"
          ? yearExpenses.isLoading || yearIncomes.isLoading || prevYearExpenses.isLoading || prevYearIncomes.isLoading
          : rangeExpenses.isLoading || rangeIncomes.isLoading) ||
      debtsQuery.isLoading ||
      categoriesQuery.isLoading
    : false;

  const error = enabled
    ? (mode === "month"
        ? monthlyExpenses.error ?? monthlyIncomes.error ?? prevExpenses.error ?? prevIncomes.error
        : mode === "year"
          ? yearExpenses.error ?? yearIncomes.error ?? prevYearExpenses.error ?? prevYearIncomes.error
          : rangeExpenses.error ?? rangeIncomes.error) ??
      debtsQuery.error ??
      categoriesQuery.error
    : null;

  const categories = useMemo(() => (enabled ? categoriesQuery.data ?? [] : []), [enabled, categoriesQuery.data]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const debts = useMemo(() => (enabled ? debtsQuery.data ?? [] : []), [enabled, debtsQuery.data]);

  const expenseEntries = useMemo(
    () =>
      expenses.map((item) => {
        const cat = categoryById.get(item.category_id);
        return {
          id: item.id,
          date: item.date,
          kind: "expense" as const,
          categoryId: item.category_id,
          categoryName: cat?.name ?? "Sem categoria",
          categoryIcon: cat?.icon,
          paymentMethod: item.payment_method,
          baseCents: numberToCents(item.value),
          weight: weightsEnabled ? item.report_weight : 1,
        };
      }),
    [expenses, categoryById, weightsEnabled],
  );

  const incomeEntries = useMemo(
    () =>
      incomes.map((item) => {
        const cat = categoryById.get(item.category_id);
        return {
          id: item.id,
          date: item.date,
          kind: "income" as const,
          categoryId: item.category_id,
          categoryName: cat?.name ?? "Sem categoria",
          categoryIcon: cat?.icon,
          paymentMethod: undefined,
          baseCents: numberToCents(item.value),
          weight: weightsEnabled ? item.report_weight : 1,
        };
      }),
    [incomes, categoryById, weightsEnabled],
  );

  const byCategory = useMemo(() => aggregateByCategory(expenseEntries), [expenseEntries]);
  const byMethod = useMemo(() => aggregateByPaymentMethod(expenseEntries), [expenseEntries]);
  const byWeekday = useMemo(() => aggregateByWeekday(expenseEntries), [expenseEntries]);
  const limitsByCategory = useMemo(() => budgetLimitsByCategory(budgetsQuery.data ?? []), [budgetsQuery.data]);

  const currentUserId = myFamilyQuery.data?.currentMember?.user_id;
  const householdData = isFamilyModeEnabled && mode === "month" ? familyConsolidationQuery.data : null;

  const householdSummary = useMemo(() => {
    if (!householdData || householdData.monthly_ceiling_cents <= 0) return null;
    const currentMemberSpent = householdData.members.find((m) => m.user_id === currentUserId);
    return {
      familyTitle: householdData.family.name,
      monthlyCeilingCents: householdData.monthly_ceiling_cents,
      totalSpentCents: householdData.total_spent_cents,
      spentPercentage: householdData.spent_percentage,
      userContributionCents: currentMemberSpent?.spent_cents ?? 0,
      userPercentageOfTotal: currentMemberSpent?.percentage_of_total ?? 0,
    };
  }, [householdData, currentUserId]);

  const grossExpenseBrutoCents = useMemo(() => expenseEntries.reduce((acc, e) => acc + e.baseCents, 0), [expenseEntries]);
  const grossIncomeBrutoCents = useMemo(() => incomeEntries.reduce((acc, e) => acc + e.baseCents, 0), [incomeEntries]);
  const grossSavingsBrutoCents = grossIncomeBrutoCents - grossExpenseBrutoCents;
  const grossSavingsRatePercent = grossIncomeBrutoCents > 0 ? (grossSavingsBrutoCents / grossIncomeBrutoCents) * 100 : null;
  const currentExpenseCents = useMemo(() => expenseEntries.reduce((acc, e) => acc + weightedCents(e.baseCents, e.weight), 0), [expenseEntries]);
  const currentIncomeCents = useMemo(() => incomeEntries.reduce((acc, e) => acc + weightedCents(e.baseCents, e.weight), 0), [incomeEntries]);
  const hasDualMetrics = weightsEnabled && (grossIncomeBrutoCents !== currentIncomeCents || grossExpenseBrutoCents !== currentExpenseCents);

  const refetchFinance = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([
      monthlyExpenses.refetch(),
      monthlyIncomes.refetch(),
      prevExpenses.refetch(),
      prevIncomes.refetch(),
      yearExpenses.refetch(),
      yearIncomes.refetch(),
      debtsQuery.refetch(),
      categoriesQuery.refetch(),
      realCashQuery.refetch(),
    ]);
  }, [enabled, monthlyExpenses, monthlyIncomes, prevExpenses, prevIncomes, yearExpenses, yearIncomes, debtsQuery, categoriesQuery, realCashQuery]);

  return {
    loading,
    error,
    expenses,
    incomes,
    monthlyExpensesData: enabled ? monthlyExpenses.data : undefined,
    categories,
    debts,
    realCashBalanceCents: realCashQuery.cashBalance.currentBalanceCents,
    openInvoicesCents: realCashQuery.cycleBreakdown.openInvoicesCents,
    expenseEntries,
    incomeEntries,
    byCategory,
    byMethod,
    byWeekday,
    limitsByCategory,
    householdSummary,
    grossExpenseBrutoCents,
    grossIncomeBrutoCents,
    grossSavingsBrutoCents,
    grossSavingsRatePercent,
    currentExpenseCents,
    currentIncomeCents,
    hasDualMetrics,
    refetchFinance,
  };
}
