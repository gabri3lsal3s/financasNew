import { useCallback, useMemo, useState } from "react";
import { todayISO } from "@/domain/debts";
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

  const realCashData = useRealCashBalance(today);
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
          ...(goal === "family" ? { familyModeEnabled: true } : {}),
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
  const hasPendingSplitSignals = useMemo(
    () => extractPendingSplitSignals(splitSharesQuery.data ?? []).length > 0,
    [splitSharesQuery.data],
  );
  const isCardDismissed = useCallback(
    (cardKey: string) => isTimedAlertDismissed(alertDismissals.cards?.[cardKey]),
    [alertDismissals.cards],
  );
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
    ...cashflow,
    isPaceEligible,
    isSurplusEligible,
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
