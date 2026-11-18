import { useMemo } from "react";
import {
  calculateSurplusCapacity,
  computeCurrentMonthProjectionMetrics,
  computeMonthlyCashflowMetrics,
  computeOverviewBudgetAndDonutData,
} from "@/domain/overview";
import type { Budget, Category, Expense, Income, PortfolioContribution } from "@/types";

interface UseOverviewCashflowParams {
  month: string;
  prevMonth: string;
  isCurrentMonth: boolean;
  incomes?: readonly Income[];
  expenses?: readonly Expense[];
  prevIncomes?: readonly Income[];
  prevExpenses?: readonly Expense[];
  contributions?: readonly PortfolioContribution[];
  budgets?: readonly Budget[];
  expenseCategories?: readonly Category[];
  committedObligationsCents: number;
  safeToSpendCents: number;
}

const EMPTY_INCOMES: readonly Income[] = [];
const EMPTY_EXPENSES: readonly Expense[] = [];
const EMPTY_CONTRIBUTIONS: readonly PortfolioContribution[] = [];
const EMPTY_BUDGETS: readonly Budget[] = [];
const EMPTY_CATEGORIES: readonly Category[] = [];

/**
 * Deriva métricas de fluxo de caixa, projeção de ritmo, capacidade de aporte,
 * orçamentos e distribuição por categoria a partir das queries da Home.
 */
export function useOverviewCashflow({
  month,
  prevMonth,
  isCurrentMonth,
  incomes = EMPTY_INCOMES,
  expenses = EMPTY_EXPENSES,
  prevIncomes = EMPTY_INCOMES,
  prevExpenses = EMPTY_EXPENSES,
  contributions = EMPTY_CONTRIBUTIONS,
  budgets = EMPTY_BUDGETS,
  expenseCategories = EMPTY_CATEGORIES,
  committedObligationsCents,
  safeToSpendCents,
}: UseOverviewCashflowParams) {
  const cashflow = useMemo(
    () =>
      computeMonthlyCashflowMetrics({
        month,
        prevMonth,
        incomes,
        expenses,
        prevIncomes,
        prevExpenses,
        contributions,
      }),
    [month, prevMonth, incomes, expenses, prevIncomes, prevExpenses, contributions],
  );

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const projectionMetrics = useMemo(
    () =>
      computeCurrentMonthProjectionMetrics({
        isCurrentMonth,
        grossIncomeCents: cashflow.grossIncomeCents,
        grossExpenseCents: cashflow.grossExpenseCents,
        investmentCents: cashflow.investmentCents,
        dayOfMonth,
        daysInMonth,
      }),
    [
      isCurrentMonth,
      cashflow.grossIncomeCents,
      cashflow.grossExpenseCents,
      cashflow.investmentCents,
      dayOfMonth,
      daysInMonth,
    ],
  );

  const surplusCapacity = useMemo(
    () =>
      calculateSurplusCapacity({
        incomeCents: cashflow.totals.incomeCents,
        expenseCents: cashflow.totals.expenseCents,
        openInvoicesCents: committedObligationsCents,
        contributionsAlreadyMadeCents: cashflow.totals.investmentCents,
        safeToSpendCents,
      }),
    [cashflow.totals, committedObligationsCents, safeToSpendCents],
  );

  const budgetAndDonut = useMemo(
    () =>
      computeOverviewBudgetAndDonutData({
        budgets,
        expenses,
        expenseCategories,
        month,
        grossExpenseCents: cashflow.grossExpenseCents,
      }),
    [budgets, expenses, expenseCategories, month, cashflow.grossExpenseCents],
  );

  return {
    ...cashflow,
    ...projectionMetrics,
    surplusCapacity,
    budgetAndDonut,
  };
}
