import { useCallback, useMemo, useState } from "react";
import {
  filterCardsByViewScope,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { todayISO } from "@/domain/debts";
import { isFamilyUnderDecay } from "@/domain/insights";
import { extractPendingSplitSignals } from "@/domain/notifications/hub";
import { isFirstUse, shouldShowOnboardingBanner } from "@/domain/onboarding";
import {
  isGovernanceAlertDismissed,
  isTimedAlertDismissed,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
  shouldShowTrialBanner,
} from "@/domain/overview";
import { useOnboardingDismissed } from "@/hooks";
import { useSafeViewScope } from "@/hooks/use-safe-business-scope";
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
  useUpdateCustomSettings,
  useUserAccess,
  useUserPreferences,
  useUserSubscription,
} from "@/state";
import { getStoredInitialGoal, setStoredInitialGoal } from "@/state/demo-mode";
import { useUserTrips } from "@/state/queries/use-trips";
import { useUserFinancialContext } from "@/state/selectors";
import type { DashboardAlertDismissals, OnboardingGoalId } from "@/types";
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

  const { effectiveViewScope } = useSafeViewScope();
  const realCashData = useRealCashBalance(today);
  const scopedIncomes = useMemo(
    () => (incomesQuery.data ? filterIncomesByViewScope(incomesQuery.data, effectiveViewScope, { mode: "dre" }) : undefined),
    [incomesQuery.data, effectiveViewScope],
  );
  const scopedExpenses = useMemo(
    () => (expensesQuery.data ? filterExpensesByViewScope(expensesQuery.data, effectiveViewScope, { mode: "dre" }) : undefined),
    [expensesQuery.data, effectiveViewScope],
  );
  const scopedPrevIncomes = useMemo(
    () => (prevIncomesQuery.data ? filterIncomesByViewScope(prevIncomesQuery.data, effectiveViewScope, { mode: "dre" }) : undefined),
    [prevIncomesQuery.data, effectiveViewScope],
  );
  const scopedPrevExpenses = useMemo(
    () => (prevExpensesQuery.data ? filterExpensesByViewScope(prevExpensesQuery.data, effectiveViewScope, { mode: "dre" }) : undefined),
    [prevExpensesQuery.data, effectiveViewScope],
  );
  const scopedCards = useMemo(
    () => (cardsQuery.data ? filterCardsByViewScope(cardsQuery.data, effectiveViewScope) : undefined),
    [cardsQuery.data, effectiveViewScope],
  );
  const scopedDebts = useMemo(
    () => (debtsQuery.data ? filterDebtsByViewScope(debtsQuery.data, effectiveViewScope) : undefined),
    [debtsQuery.data, effectiveViewScope],
  );
  const portfolioPositionQuery = usePortfolioPosition();
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);
  const { hasFeature, profile } = useUserAccess();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const onboardingQuery = useOnboardingCounts();
  const corporateDividends = useCorporateDividends();
  const subscription = useUserSubscription();
  const { isDismissed: isOnboardingDismissed, dismiss: dismissOnboarding } = useOnboardingDismissed();
  const [virginGuideDismissed, setVirginGuideDismissed] = useState(false);
  const [localInitialGoal, setLocalInitialGoal] = useState<OnboardingGoalId | null>(() =>
    getStoredInitialGoal(),
  );

  const initialGoal =
    localInitialGoal ??
    userPreferencesQuery.data?.custom_settings?.initialGoal ??
    getStoredInitialGoal();

  const setInitialFocus = useCallback(
    (goal: OnboardingGoalId) => {
      setLocalInitialGoal(goal);
      setStoredInitialGoal(goal);
      try {
        updateCustomSettingsMutation.mutate({
          initialGoal: goal,
          familyModeEnabled: true,
        });
      } catch {
        // Falha silenciosa caso offline
      }
    },
    [updateCustomSettingsMutation],
  );

  const dismissVirginGuide = useCallback(() => {
    setVirginGuideDismissed(true);
  }, []);

  const isVirginAccount = Boolean(onboardingQuery?.data && isFirstUse(onboardingQuery.data));
  const showVirginGuide = isVirginAccount && !virginGuideDismissed && !isOnboardingDismissed;
  const showOnboarding =
    !showVirginGuide && !isOnboardingDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data, hasFeature, initialGoal)
      : false;

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    (isCurrentMonth && realCashData.isLoading);

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    (isCurrentMonth ? realCashData.error : null);

  const hasCashHistory = Boolean(
    realCashData.cashBalance.inflowSinceCheckpointCents > 0 ||
      realCashData.cashBalance.outflowSinceCheckpointCents > 0 ||
      realCashData.cashBalance.eventsSinceCheckpoint.length > 0,
  );

  const { context: financialContext, predictedUpcomingInflows } = useUserFinancialContext({
    month,
    todayISO: today,
    isCurrentMonth,
    realCashBalanceCents: realCashData.cashBalance.currentBalanceCents,
    hasCashCheckpoint: realCashData.cashBalance.latestCheckpoint !== null,
    hasCashHistory,
    committedObligationsCents: realCashData.safeToSpend.committedObligationsCents,
    safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
    positionRows,
  });

  const cashflow = useOverviewCashflow({
    month,
    prevMonth,
    isCurrentMonth,
    incomes: scopedIncomes,
    expenses: scopedExpenses,
    prevIncomes: scopedPrevIncomes,
    prevExpenses: scopedPrevExpenses,
    contributions: contributionsQuery.data,
    budgets: budgetsQuery.data,
    expenseCategories: expenseCategories.data,
    committedObligationsCents: realCashData.safeToSpend.committedObligationsCents,
    safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
    financialContext,
  });

  const obligations = useOverviewObligations({
    today,
    month,
    rangeEnd,
    currentBalanceCents: realCashData.cashBalance.currentBalanceCents,
    hasLiquidityContext: financialContext.lens.liquidity.hasLiquidityContext,
    predictedInflows: predictedUpcomingInflows,
    cardsLoading: cardsQuery.isLoading,
    cardExpensesLoading: cardExpensesQuery.isLoading,
    cardPaymentsLoading: cardPaymentsQuery.isLoading,
    debtsLoading: debtsQuery.isLoading,
    splitSharesLoading: splitSharesQuery.isLoading,
    cards: scopedCards,
    cardExpenses: cardExpensesQuery.data,
    cardPayments: cardPaymentsQuery.data,
    debts: scopedDebts,
    incomes: scopedIncomes,
    splitShares: splitSharesQuery.data,
    goalShares: goalSharesQuery.data,
    positionRows,
    trips: tripsQuery.data,
    hasSurplus: cashflow.surplusCapacity.hasSurplus,
    goalDismissals: alertDismissals.goals,
  });

  const advisorDecayMeta = useMemo(
    () => userPreferencesQuery.data?.custom_settings?.advisorDecayMeta ?? {},
    [userPreferencesQuery.data?.custom_settings?.advisorDecayMeta],
  );

  const isPaceEligible =
    shouldShowPaceAlert(alertDismissals.pace, {
      month,
      spentPercent: cashflow.pace.spentPercent,
      surplusCents: cashflow.projection.surplusCents,
    }) && !isFamilyUnderDecay(advisorDecayMeta.pace);

  const isSurplusEligible =
    shouldShowSurplusAlert(alertDismissals.surplus, {
      month,
      surplusCents: cashflow.surplusCapacity.suggestedAporteCents,
    }) && !isFamilyUnderDecay(advisorDecayMeta.surplus);

  const isGovernanceDismissed = isGovernanceAlertDismissed(alertDismissals.governance);
  const hasPendingSplitSignals = useMemo(
    () => extractPendingSplitSignals(splitSharesQuery.data ?? []).length > 0,
    [splitSharesQuery.data],
  );
  const isCardDismissed = useCallback(
    (cardKey: string) => isTimedAlertDismissed(alertDismissals.cards?.[cardKey]),
    [alertDismissals.cards],
  );
  const isCashGapEligible =
    !isCardDismissed("cash-gap-alert") && !isFamilyUnderDecay(advisorDecayMeta.cash_gap);
  const isTrialBannerEligible = shouldShowTrialBanner(
    subscription.trialDaysRemaining,
    Boolean(subscription.hasAutoRenew),
    alertDismissals.cards?.["trial-ending"],
  );

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
    financialContext,
    predictedUpcomingInflows,
    advisorDecayMeta,
    updateCustomSettingsMutation,
    ...cashflow,
    isPaceEligible,
    isSurplusEligible,
    isCashGapEligible,
    isGovernanceDismissed,
    hasPendingSplitSignals,
    isCardDismissed,
    isTrialBannerEligible,
    ...obligations,
    hasFamily,
    householdData,
    currentUserId,
    userName: profile?.name ?? null,
    initialGoal,
    setInitialFocus,
    isVirginAccount,
    showVirginGuide,
    showOnboarding,
    dismissVirginGuide,
    dismissOnboarding,
    corporateDividends,
    dividendAutomationPrefs: userPreferencesQuery.data?.custom_settings?.dividendAutomation ?? null,
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
