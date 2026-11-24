import { useMemo } from "react";
import type { CashGapInflow } from "@/domain/projection";
import { useTripDetails } from "@/state/queries/use-trips";
import {
  buildOverviewCashGapResult,
  buildOverviewWeeklyRadarSummary,
  computeLiveGoalProgressMap,
  computePendingSplitReceivables,
  filterEligibleGoalShares,
  type OverviewPortfolioPositionLike,
} from "@/domain/overview";
import type {
  CardPayment,
  CreditCard,
  Debt,
  Expense,
  GoalAlertDismissalCheckpoint,
  Income,
  PublicShare,
  Trip,
} from "@/types";

interface UseOverviewObligationsParams {
  today: string;
  month: string;
  rangeEnd: string;
  currentBalanceCents: number;
  hasLiquidityContext?: boolean;
  predictedInflows?: readonly CashGapInflow[];
  cardsLoading: boolean;
  cardExpensesLoading: boolean;
  cardPaymentsLoading: boolean;
  debtsLoading: boolean;
  splitSharesLoading: boolean;
  cards?: readonly CreditCard[];
  cardExpenses?: readonly Expense[];
  cardPayments?: readonly CardPayment[];
  debts?: readonly Debt[];
  incomes?: readonly Income[];
  splitShares?: readonly PublicShare[];
  goalShares?: readonly PublicShare[];
  positionRows: readonly OverviewPortfolioPositionLike[];
  trips?: readonly Trip[];
  hasSurplus: boolean;
  goalDismissals?: Record<string, GoalAlertDismissalCheckpoint>;
}

const EMPTY_GOAL_SHARES: readonly PublicShare[] = [];
const EMPTY_PREDICTED_INFLOWS: readonly CashGapInflow[] = [];

/**
 * Deriva obrigações futuras, radar semanal de vencimentos, rachas pendentes,
 * progresso de metas patrimoniais e viagens ativas da Home.
 */
export function useOverviewObligations({
  today,
  month,
  rangeEnd,
  currentBalanceCents,
  hasLiquidityContext,
  predictedInflows = EMPTY_PREDICTED_INFLOWS,
  cardsLoading,
  cardExpensesLoading,
  cardPaymentsLoading,
  debtsLoading,
  splitSharesLoading,
  cards,
  cardExpenses,
  cardPayments,
  debts,
  incomes,
  splitShares,
  goalShares = EMPTY_GOAL_SHARES,
  positionRows,
  trips,
  hasSurplus,
  goalDismissals,
}: UseOverviewObligationsParams) {
  const cashGapResult = useMemo(
    () =>
      buildOverviewCashGapResult({
        currentBalanceCents,
        today,
        month,
        rangeEnd,
        cards: cards ?? [],
        cardExpenses: cardExpenses ?? [],
        cardPayments: cardPayments ?? [],
        debts: debts ?? [],
        incomes: incomes ?? [],
        hasLiquidityContext,
        predictedInflows,
      }),
    [
      currentBalanceCents,
      today,
      month,
      rangeEnd,
      cards,
      cardExpenses,
      cardPayments,
      debts,
      incomes,
      hasLiquidityContext,
      predictedInflows,
    ],
  );

  const weeklyRadarSummary = useMemo(
    () =>
      buildOverviewWeeklyRadarSummary({
        isLoading: cardsLoading || cardExpensesLoading || cardPaymentsLoading || debtsLoading,
        today,
        month,
        currentBalanceCents,
        cards,
        cardExpenses,
        cardPayments,
        debts,
      }),
    [
      cardsLoading,
      cardExpensesLoading,
      cardPaymentsLoading,
      debtsLoading,
      today,
      month,
      currentBalanceCents,
      cards,
      cardExpenses,
      cardPayments,
      debts,
    ],
  );

  const splitPendingData = useMemo(
    () =>
      computePendingSplitReceivables({
        isLoading: debtsLoading || splitSharesLoading,
        debts,
        splitShares,
      }),
    [debtsLoading, splitSharesLoading, debts, splitShares],
  );

  const liveGoalProgress = useMemo(
    () =>
      computeLiveGoalProgressMap({
        currentBalanceCents,
        positionRows,
        goalShares,
      }),
    [currentBalanceCents, positionRows, goalShares],
  );

  const eligibleGoalShares = useMemo(
    () =>
      filterEligibleGoalShares({
        goalShares,
        liveGoalProgress,
        hasSurplus,
        goalDismissals,
      }),
    [goalShares, liveGoalProgress, hasSurplus, goalDismissals],
  );

  const activeTrips = useMemo(
    () => (trips ?? []).filter((t) => t.status === "active"),
    [trips],
  );

  const firstActiveTripId = activeTrips[0]?.id;
  const activeTripDetailsQuery = useTripDetails(firstActiveTripId);
  const activeTripExpensesTotalCents = activeTripDetailsQuery.data?.totalExpensesCents;

  return {
    cashGapResult,
    weeklyRadarSummary,
    splitPendingData,
    liveGoalProgress,
    eligibleGoalShares,
    activeTrips,
    activeTripExpensesTotalCents,
  };
}
