import { useMemo } from "react";
import type { UserFinancialContext } from "@/domain/insights";
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
  financialContext?: UserFinancialContext;
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
  financialContext,
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
  const daysInMonth =
    financialContext?.daysInMonth ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = financialContext?.dayOfMonth ?? now.getDate();

  const projectionMetrics = useMemo(
    () =>
      computeCurrentMonthProjectionMetrics({
        isCurrentMonth,
        grossIncomeCents: cashflow.grossIncomeCents,
        grossExpenseCents: cashflow.grossExpenseCents,
        investmentCents: cashflow.investmentCents,
        dayOfMonth,
        daysInMonth,
        financialContext,
      }),
    [
      isCurrentMonth,
      cashflow.grossIncomeCents,
      cashflow.grossExpenseCents,
      cashflow.investmentCents,
      dayOfMonth,
      daysInMonth,
      financialContext,
    ],
  );

  const surplusCapacity = useMemo(
    () =>
      calculateSurplusCapacity({
        incomeCents: financialContext
          ? financialContext.lens.consumption.operatingIncomeCents
          : cashflow.totals.incomeCents,
        expenseCents: financialContext
          ? financialContext.lens.consumption.netExpenseCents
          : cashflow.totals.expenseCents,
        openInvoicesCents: committedObligationsCents,
        pendingRecurringObligationsCents:
          financialContext?.lens.liquidity.pendingRecurringExpensesCents ?? 0,
        contributionsAlreadyMadeCents: cashflow.totals.investmentCents,
        safeToSpendCents,
        emergencyGapCents: financialContext?.lens.wealth.emergencyGapCents ?? 0,
        hasExternalEmergencyFund:
          financialContext?.lens.wealth.hasExternalEmergencyFund ?? false,
      }),
    [financialContext, cashflow.totals, committedObligationsCents, safeToSpendCents],
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
