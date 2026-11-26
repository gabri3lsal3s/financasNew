import { useCallback, useMemo } from "react";
import { budgetLimitsByCategory } from "@/domain/budgets";
import {
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { addDaysISO, todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateExpensesByChargeKind,
  aggregateByWeekday,
  weightedCents,
  type ReportPeriodMode,
} from "@/domain/reports";
import { useSafeViewScope } from "@/hooks/use-safe-business-scope";
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
  const isMonth = mode === "month";
  const monthlyExpenses = useExpenses(month, { enabled });
  const monthlyIncomes = useIncomes(month, { enabled: enabled && isMonth });
  const prevExpenses = useExpenses(shiftMonth(month, -1), { enabled: enabled && isMonth });
  const prevIncomes = useIncomes(shiftMonth(month, -1), { enabled: enabled && isMonth });

  const yearExpenses = useExpensesByRange(range.start, range.end, { enabled: isYear && enabled });
  const yearIncomes = useIncomesByRange(range.start, range.end, { enabled: isYear && enabled });
  const prevYearRange = isYear ? yearRange(year - 1) : { start: "", end: "" };
  const prevYearExpenses = useExpensesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && enabled });
  const prevYearIncomes = useIncomesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && enabled });

  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid && enabled });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid && enabled });
  const debtsQuery = useDebts({ enabled });
  const today = todayISO();
  const lastDayOfPeriod = range.end && customValid ? addDaysISO(range.end, -1) : today;
  const cashReferenceDate = lastDayOfPeriod < today ? lastDayOfPeriod : today;
  const realCashQuery = useRealCashBalance(cashReferenceDate, { enabled: enabled && customValid });
  const categoriesQuery = useCategories(undefined, { enabled });
  const budgetsQuery = useBudgets({ enabled });
  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily({ enabled: enabled && isFamilyModeEnabled });
  const hasFamily = Boolean(myFamilyQuery.data?.family?.id);
  const familyConsolidationQuery = useFamilyConsolidation(mode === "month" ? month : currentMonth(), {
    enabled: enabled && hasFamily && isFamilyModeEnabled && mode === "month",
  });

  const { effectiveViewScope } = useSafeViewScope();
  const rawExpenses = useMemo(
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

  const rawIncomes = useMemo(
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

  const expenses = useMemo(
    () => filterExpensesByViewScope(rawExpenses, effectiveViewScope, { mode: "dre" }),
    [rawExpenses, effectiveViewScope],
  );

  const incomes = useMemo(
    () => filterIncomesByViewScope(rawIncomes, effectiveViewScope, { mode: "dre" }),
    [rawIncomes, effectiveViewScope],
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
  const rawDebts = useMemo(() => (enabled ? debtsQuery.data ?? [] : []), [enabled, debtsQuery.data]);
  const debts = useMemo(() => filterDebtsByViewScope(rawDebts, effectiveViewScope), [rawDebts, effectiveViewScope]);

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
          chargeKind: item.charge_kind,
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
  const byChargeKind = useMemo(() => aggregateExpensesByChargeKind(expenseEntries), [expenseEntries]);
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
    const tasks: Promise<unknown>[] = [];
    if (enabled) {
      if (mode === "month") {
        tasks.push(
          monthlyExpenses.refetch(),
          monthlyIncomes.refetch(),
          prevExpenses.refetch(),
          prevIncomes.refetch(),
        );
      } else if (mode === "year") {
        tasks.push(
          yearExpenses.refetch(),
          yearIncomes.refetch(),
          prevYearExpenses.refetch(),
          prevYearIncomes.refetch(),
        );
      } else if (customValid) {
        tasks.push(rangeExpenses.refetch(), rangeIncomes.refetch());
      }
      tasks.push(debtsQuery.refetch(), categoriesQuery.refetch(), realCashQuery.refetch());
    }
    await Promise.all(tasks);
  }, [
    enabled,
    mode,
    customValid,
    monthlyExpenses,
    monthlyIncomes,
    prevExpenses,
    prevIncomes,
    yearExpenses,
    yearIncomes,
    prevYearExpenses,
    prevYearIncomes,
    rangeExpenses,
    rangeIncomes,
    debtsQuery,
    categoriesQuery,
    realCashQuery,
  ]);

  return {
    loading,
    error,
    rawExpenses,
    rawIncomes,
    rawDebts,
    expenses,
    incomes,
    monthlyExpensesData: enabled
      ? monthlyExpenses.data
        ? filterExpensesByViewScope(monthlyExpenses.data, effectiveViewScope, { mode: "dre" })
        : undefined
      : undefined,
    categories,
    debts,
    realCashBalanceCents: realCashQuery.cashBalance.currentBalanceCents,
    openInvoicesCents: realCashQuery.cycleBreakdown.openInvoicesCents,
    expenseEntries,
    incomeEntries,
    byCategory,
    byMethod,
    byWeekday,
    byChargeKind,
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
