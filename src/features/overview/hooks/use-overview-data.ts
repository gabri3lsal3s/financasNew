import { useMemo } from "react";
import { todayISO } from "@/domain/debts";
import { isFirstUse, shouldShowOnboardingBanner } from "@/domain/onboarding";
import { isGovernanceAlertDismissed, shouldShowPaceAlert, shouldShowSurplusAlert } from "@/domain/overview";
import { useOnboardingDismissed } from "@/hooks";
import { currentMonth, shiftMonth } from "@/lib/date";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useCorporateDividends,
  useCreditCards,
  useDebts,
  useExpenses,
  useFamilyConsolidation,
  useFamilyMode,
  useIncomes,
  useMyFamily,
  useMyPublicShares,
  useOnboardingCounts,
  usePortfolioContributions,
  usePortfolioPosition,
  useRealCashBalance,
  useUserAccess,
  useUserSubscription,
} from "@/state";
import { useUserTrips } from "@/state/queries/use-trips";
import type { DashboardAlertDismissals } from "@/types";
import { useOverviewCashflow } from "./use-overview-cashflow";
import { useOverviewObligations } from "./use-overview-obligations";

export interface UseOverviewDataOptions {
  month: string;
  alertDismissals: DashboardAlertDismissals;
}

/**
 * Orquestra dados, fluxos, obrigações, alertas e estado de onboarding da tela de Visão Geral.
 */
export function useOverviewData({ month, alertDismissals }: UseOverviewDataOptions) {
  const prevMonth = shiftMonth(month, -1);
  const rangeEnd = `${shiftMonth(month, 1)}-01`;
  const today = todayISO();
  const isCurrentMonth = month === currentMonth();

  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(prevMonth);
  const prevExpensesQuery = useExpenses(prevMonth);

  const cardsQuery = useCreditCards();
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();
  const contributionsQuery = usePortfolioContributions();
  const splitSharesQuery = useMyPublicShares("split");
  const goalSharesQuery = useMyPublicShares("goal_tracker");
  const tripsQuery = useUserTrips();

  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily();
  const hasFamily = Boolean(isFamilyModeEnabled && myFamilyQuery.data?.family);
  const familyConsolidationQuery = useFamilyConsolidation(month, { enabled: hasFamily });
  const householdData = hasFamily ? familyConsolidationQuery.data : null;
  const currentUserId = myFamilyQuery.data?.currentMember?.user_id;

  const realCashData = useRealCashBalance(today);
  const portfolioPositionQuery = usePortfolioPosition();
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);
  const { hasFeature } = useUserAccess();
  const onboardingQuery = useOnboardingCounts();
  const corporateDividends = useCorporateDividends();
  const subscription = useUserSubscription();
  const { isDismissed: isOnboardingDismissed, dismiss: dismissOnboarding } = useOnboardingDismissed();

  const isVirginAccount = Boolean(onboardingQuery?.data && isFirstUse(onboardingQuery.data));
  const showOnboarding =
    !isOnboardingDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data, hasFeature)
      : false;

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    (isCurrentMonth && realCashData.isLoading);

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    (isCurrentMonth ? realCashData.error : null);

  const cashflow = useOverviewCashflow({
    month,
    prevMonth,
    isCurrentMonth,
    incomes: incomesQuery.data,
    expenses: expensesQuery.data,
    prevIncomes: prevIncomesQuery.data,
    prevExpenses: prevExpensesQuery.data,
    contributions: contributionsQuery.data,
    budgets: budgetsQuery.data,
    expenseCategories: expenseCategories.data,
    committedObligationsCents: realCashData.safeToSpend.committedObligationsCents,
    safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
  });

  const obligations = useOverviewObligations({
    today,
    month,
    rangeEnd,
    currentBalanceCents: realCashData.cashBalance.currentBalanceCents,
    cardsLoading: cardsQuery.isLoading,
    cardExpensesLoading: cardExpensesQuery.isLoading,
    cardPaymentsLoading: cardPaymentsQuery.isLoading,
    debtsLoading: debtsQuery.isLoading,
    splitSharesLoading: splitSharesQuery.isLoading,
    cards: cardsQuery.data,
    cardExpenses: cardExpensesQuery.data,
    cardPayments: cardPaymentsQuery.data,
    debts: debtsQuery.data,
    incomes: incomesQuery.data,
    splitShares: splitSharesQuery.data,
    goalShares: goalSharesQuery.data,
    positionRows,
    trips: tripsQuery.data,
    hasSurplus: cashflow.surplusCapacity.hasSurplus,
    goalDismissals: alertDismissals.goals,
  });

  const isPaceEligible = shouldShowPaceAlert(alertDismissals.pace, {
    month,
    spentPercent: cashflow.pace.spentPercent,
    surplusCents: cashflow.projection.surplusCents,
  });

  const isSurplusEligible = shouldShowSurplusAlert(alertDismissals.surplus, {
    month,
    surplusCents: cashflow.surplusCapacity.suggestedAporteCents,
  });

  const isGovernanceDismissed = isGovernanceAlertDismissed(alertDismissals.governance);

  return {
    month,
    prevMonth,
    rangeEnd,
    today,
    isCurrentMonth,
    loading,
    error,
    hasFeature,
    onboardingQuery,
    ...cashflow,
    isPaceEligible,
    isSurplusEligible,
    isGovernanceDismissed,
    ...obligations,
    hasFamily,
    householdData,
    currentUserId,
    isVirginAccount,
    showOnboarding,
    dismissOnboarding,
    corporateDividends,
    subscription,
    realCashData,
    positionRows,
    budgetsQuery,
    expenseCategories,
    cardsQuery,
    debtsQuery,
    incomesQuery,
    expensesQuery,
    prevExpensesQuery,
  };
}
