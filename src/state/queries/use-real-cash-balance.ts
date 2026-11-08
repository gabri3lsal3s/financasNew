import { useMemo } from "react";
import { todayISO } from "@/domain/debts";
import { shiftMonth } from "@/lib/date";
import {
  calculateRealCashBalance,
  calculateSafeToSpend,
  breakdownCycleObligations,
  type CashCheckpointData,
  type RealCashBalanceResult,
  type SafeToSpendResult,
  type CycleObligationsBreakdown,
} from "@/domain/cash";
import { useLatestCashCheckpoint } from "./use-cash-checkpoints";
import { useIncomesByRange } from "./use-incomes";
import { useExpensesByRange } from "./use-expenses";
import { useAllCardPayments, useAllCardExpenses } from "./use-overview";
import { useCreditCards } from "./use-credit-cards";
import { useDebts } from "./use-debts";
import { usePortfolioContributions } from "./use-portfolio";

export interface UseRealCashBalanceResult {
  cashBalance: RealCashBalanceResult;
  safeToSpend: SafeToSpendResult;
  cycleBreakdown: CycleObligationsBreakdown;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

/**
 * Hook consolidado que computa o Saldo em Caixa Real e o Saldo Livre (Safe-to-Spend).
 * Utiliza o último checkpoint como âncora e processa os fluxos em regime de caixa estrito.
 */
export function useRealCashBalance(referenceDate: string = todayISO()): UseRealCashBalanceResult {
  const checkpointQuery = useLatestCashCheckpoint();

  const checkpoint = checkpointQuery.data;
  const startDate = checkpoint?.date ?? "1970-01-01";
  const currentMonthStr = referenceDate.slice(0, 7);
  const endDate = `${shiftMonth(currentMonthStr, 1)}-01`;

  const incomesQuery = useIncomesByRange(startDate, endDate);
  const expensesQuery = useExpensesByRange(startDate, endDate);
  const cardsQuery = useCreditCards();
  const cardPaymentsQuery = useAllCardPayments();
  const cardExpensesQuery = useAllCardExpenses();
  const debtsQuery = useDebts();
  const contributionsQuery = usePortfolioContributions();

  const isLoading =
    checkpointQuery.isLoading ||
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    cardsQuery.isLoading ||
    cardPaymentsQuery.isLoading ||
    cardExpensesQuery.isLoading ||
    debtsQuery.isLoading ||
    contributionsQuery.isLoading;

  const error =
    checkpointQuery.error ??
    incomesQuery.error ??
    expensesQuery.error ??
    cardsQuery.error ??
    cardPaymentsQuery.error ??
    cardExpensesQuery.error ??
    debtsQuery.error ??
    contributionsQuery.error;

  const checkpointData: CashCheckpointData | null = useMemo(() => {
    if (!checkpoint) return null;
    return {
      id: checkpoint.id,
      date: checkpoint.date,
      balanceCents: checkpoint.balance_cents,
      notes: checkpoint.notes,
      createdAt: checkpoint.created_at,
    };
  }, [checkpoint]);

  const cashBalance = useMemo(() => {
    return calculateRealCashBalance({
      checkpoint: checkpointData,
      incomes: incomesQuery.data ?? [],
      expenses: expensesQuery.data ?? [],
      cardPayments: cardPaymentsQuery.data ?? [],
      debts: debtsQuery.data ?? [],
      contributions: contributionsQuery.data ?? [],
      referenceDate,
    });
  }, [
    checkpointData,
    incomesQuery.data,
    expensesQuery.data,
    cardPaymentsQuery.data,
    debtsQuery.data,
    contributionsQuery.data,
    referenceDate,
  ]);

  const cycleBreakdown = useMemo(() => {
    return breakdownCycleObligations({
      cards: cardsQuery.data ?? [],
      cardExpenses: cardExpensesQuery.data ?? [],
      cardPayments: cardPaymentsQuery.data ?? [],
      debts: debtsQuery.data ?? [],
      referenceDate,
    });
  }, [
    cardsQuery.data,
    cardExpensesQuery.data,
    cardPaymentsQuery.data,
    debtsQuery.data,
    referenceDate,
  ]);

  const safeToSpend = useMemo(() => {
    return calculateSafeToSpend({
      realCashBalanceCents: cashBalance.currentBalanceCents,
      openInvoicesCents: cycleBreakdown.openInvoicesCents,
      payablePendingCents: cycleBreakdown.payableDebtsCents,
      receivablePendingCents: cycleBreakdown.receivablePendingCents,
    });
  }, [
    cashBalance.currentBalanceCents,
    cycleBreakdown.openInvoicesCents,
    cycleBreakdown.payableDebtsCents,
    cycleBreakdown.receivablePendingCents,
  ]);

  const refetch = async () => {
    await Promise.all([
      checkpointQuery.refetch(),
      incomesQuery.refetch(),
      expensesQuery.refetch(),
      cardsQuery.refetch(),
      cardPaymentsQuery.refetch(),
      cardExpensesQuery.refetch(),
      debtsQuery.refetch(),
      contributionsQuery.refetch(),
    ]);
  };

  return {
    cashBalance,
    safeToSpend,
    cycleBreakdown,
    isLoading,
    error,
    refetch,
  };
}
