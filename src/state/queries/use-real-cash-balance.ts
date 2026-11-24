import { useMemo } from "react";
import { todayISO } from "@/domain/debts";
import {
  filterCardsByViewScope,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
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
import { useViewScope } from "@/state/hooks/use-view-scope";
import type { TransactionScope, ViewScope } from "@/types";
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
  activeScope?: ViewScope;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

/**
 * Hook consolidado que computa o Saldo em Caixa Real e o Saldo Livre (Safe-to-Spend).
 * Utiliza o último checkpoint do escopo correspondente como âncora e aplica regras PF x PJ.
 */
export function useRealCashBalance(
  referenceDate: string = todayISO(),
  options?: { scopeOverride?: ViewScope },
): UseRealCashBalanceResult {
  const { effectiveViewScope } = useViewScope();
  const activeScope: ViewScope = options?.scopeOverride ?? effectiveViewScope;
  const checkpointScope: TransactionScope = activeScope === "business" ? "business" : "personal";
  const checkpointQuery = useLatestCashCheckpoint(checkpointScope);

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

  const scopedIncomes = useMemo(
    () => filterIncomesByViewScope(incomesQuery.data ?? [], activeScope, { mode: "cashflow" }),
    [incomesQuery.data, activeScope],
  );
  const scopedExpenses = useMemo(
    () => filterExpensesByViewScope(expensesQuery.data ?? [], activeScope, { mode: "cashflow" }),
    [expensesQuery.data, activeScope],
  );
  const scopedCards = useMemo(
    () => filterCardsByViewScope(cardsQuery.data ?? [], activeScope),
    [cardsQuery.data, activeScope],
  );
  const scopedCardExpenses = useMemo(
    () => filterExpensesByViewScope(cardExpensesQuery.data ?? [], activeScope, { mode: "cashflow" }),
    [cardExpensesQuery.data, activeScope],
  );
  const scopedDebts = useMemo(
    () => filterDebtsByViewScope(debtsQuery.data ?? [], activeScope),
    [debtsQuery.data, activeScope],
  );
  const scopedCardIds = useMemo(() => new Set(scopedCards.map((c) => c.id)), [scopedCards]);
  const scopedCardPayments = useMemo(() => {
    if (activeScope === "all") return cardPaymentsQuery.data ?? [];
    return (cardPaymentsQuery.data ?? []).filter((p) => scopedCardIds.has(p.card_id));
  }, [cardPaymentsQuery.data, activeScope, scopedCardIds]);
  const scopedContributions = useMemo(
    () => (activeScope === "business" ? [] : (contributionsQuery.data ?? [])),
    [activeScope, contributionsQuery.data],
  );

  const cashBalance = useMemo(() => {
    return calculateRealCashBalance({
      checkpoint: checkpointData,
      incomes: scopedIncomes,
      expenses: scopedExpenses,
      cardPayments: scopedCardPayments,
      debts: scopedDebts,
      contributions: scopedContributions,
      referenceDate,
    });
  }, [
    checkpointData,
    scopedIncomes,
    scopedExpenses,
    scopedCardPayments,
    scopedDebts,
    scopedContributions,
    referenceDate,
  ]);

  const cycleBreakdown = useMemo(() => {
    return breakdownCycleObligations({
      cards: scopedCards,
      cardExpenses: scopedCardExpenses,
      cardPayments: scopedCardPayments,
      debts: scopedDebts,
      referenceDate,
    });
  }, [
    scopedCards,
    scopedCardExpenses,
    scopedCardPayments,
    scopedDebts,
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
    activeScope,
    isLoading,
    error,
    refetch,
  };
}
