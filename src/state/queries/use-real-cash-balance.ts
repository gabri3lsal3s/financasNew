import { useMemo } from "react";
import { todayISO } from "@/domain/debts";
import {
  calculateDerivedBusinessCashFromTransactions,
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
import { useAllCardBillRollovers, useAllCardExpenses, useAllCardPayments } from "./use-overview";
import { useCreditCards } from "./use-credit-cards";
import { useDebts } from "./use-debts";
import { usePortfolioContributions } from "./use-portfolio";

export interface BusinessCashBreakdownResult {
  personalCashCents: number;
  businessCashCents: number;
  hasBusinessCash: boolean;
}

export interface UseRealCashBalanceResult {
  cashBalance: RealCashBalanceResult;
  safeToSpend: SafeToSpendResult;
  cycleBreakdown: CycleObligationsBreakdown;
  businessCashBreakdown?: BusinessCashBreakdownResult | null;
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
  const cardRolloversQuery = useAllCardBillRollovers();
  const debtsQuery = useDebts();
  const contributionsQuery = usePortfolioContributions();

  const isLoading =
    checkpointQuery.isLoading ||
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    cardsQuery.isLoading ||
    cardPaymentsQuery.isLoading ||
    cardExpensesQuery.isLoading ||
    cardRolloversQuery.isLoading ||
    debtsQuery.isLoading ||
    contributionsQuery.isLoading;

  const error =
    checkpointQuery.error ??
    incomesQuery.error ??
    expensesQuery.error ??
    cardsQuery.error ??
    cardPaymentsQuery.error ??
    cardExpensesQuery.error ??
    cardRolloversQuery.error ??
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
  // Blindagem #11: faturas de cartão (incluindo cartões mistos) sempre usam 100% das despesas/pagamentos/rollovers do cartão;
  // o escopo PF/PJ filtra apenas quais cartões entram no cálculo.
  const allCardExpenses = useMemo(() => cardExpensesQuery.data ?? [], [cardExpensesQuery.data]);
  const allCardRollovers = useMemo(() => cardRolloversQuery.data ?? [], [cardRolloversQuery.data]);
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
      cardExpenses: allCardExpenses,
      cardPayments: scopedCardPayments,
      cardRollovers: allCardRollovers,
      debts: scopedDebts,
      referenceDate,
    });
  }, [
    scopedCards,
    allCardExpenses,
    scopedCardPayments,
    allCardRollovers,
    scopedDebts,
    referenceDate,
  ]);

  const businessCashDerived = useMemo(() => {
    return calculateDerivedBusinessCashFromTransactions({
      incomes: incomesQuery.data ?? [],
      expenses: expensesQuery.data ?? [],
    });
  }, [incomesQuery.data, expensesQuery.data]);

  const hasBusinessActivity = useMemo(() => {
    return (
      businessCashDerived.capitalInjectionsCents > 0 ||
      businessCashDerived.grossRevenueCents > 0 ||
      businessCashDerived.cashExpensesCents > 0 ||
      businessCashDerived.proLaboreWithdrawnCents > 0 ||
      businessCashDerived.cardReimbursementsPaidCents > 0 ||
      activeScope === "business"
    );
  }, [businessCashDerived, activeScope]);

  const businessCashBreakdown: BusinessCashBreakdownResult | null = useMemo(() => {
    if (!hasBusinessActivity) return null;
    const businessCashCents = businessCashDerived.derivedCashBalanceCents;
    const personalCashCents =
      activeScope === "business"
        ? 0
        : cashBalance.currentBalanceCents - Math.max(0, businessCashCents);
    return {
      personalCashCents,
      businessCashCents,
      hasBusinessCash: true,
    };
  }, [hasBusinessActivity, businessCashDerived.derivedCashBalanceCents, activeScope, cashBalance.currentBalanceCents]);

  const safeToSpend = useMemo(() => {
    // Se o escopo for consolidado ("all") ou pessoal ("personal"), deduzimos estritamente o Caixa Reservado da PJ
    // para evitar que dinheiro da empresa apareça como disponível para gastos pessoais livres (Melhoria 4: Blindagem Dinâmica).
    const derivedBusinessCashCents =
      activeScope !== "business" && hasBusinessActivity
        ? Math.max(0, businessCashDerived.derivedCashBalanceCents)
        : 0;

    return calculateSafeToSpend({
      realCashBalanceCents: cashBalance.currentBalanceCents,
      openInvoicesCents: cycleBreakdown.openInvoicesCents,
      payablePendingCents: cycleBreakdown.payableDebtsCents,
      receivablePendingCents: cycleBreakdown.receivablePendingCents,
      derivedBusinessCashCents,
    });
  }, [
    cashBalance.currentBalanceCents,
    cycleBreakdown.openInvoicesCents,
    cycleBreakdown.payableDebtsCents,
    cycleBreakdown.receivablePendingCents,
    activeScope,
    hasBusinessActivity,
    businessCashDerived.derivedCashBalanceCents,
  ]);

  const refetch = async () => {
    await Promise.all([
      checkpointQuery.refetch(),
      incomesQuery.refetch(),
      expensesQuery.refetch(),
      cardsQuery.refetch(),
      cardPaymentsQuery.refetch(),
      cardExpensesQuery.refetch(),
      cardRolloversQuery.refetch(),
      debtsQuery.refetch(),
      contributionsQuery.refetch(),
    ]);
  };

  return {
    cashBalance,
    safeToSpend,
    cycleBreakdown,
    businessCashBreakdown,
    activeScope,
    isLoading,
    error,
    refetch,
  };
}
