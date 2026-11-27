import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterCardsByViewScope,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { todayISO } from "@/domain/debts";
import {
  extractPendingSplitSignals,
  resolveNotificationCategoryPreferences,
} from "@/domain/notifications/hub";
import { isFirstUse, shouldShowOnboardingBanner } from "@/domain/onboarding";
import {
  createTimedDismissalCheckpoint,
  isGovernanceAlertDismissed,
  isTimedAlertDismissed,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
  shouldShowTrialBanner,
} from "@/domain/overview";
import { resolvePortfolioRiskPolicy } from "@/domain/portfolio/portfolio-risk-policy";
import { useOnboardingDismissed } from "@/hooks";
import { useCarouselDismissals } from "@/hooks/use-carousel-dismissals";
import { useSafeViewScope } from "@/hooks/use-safe-business-scope";
import { currentMonth, shiftMonth } from "@/lib/date";
import { getActiveUserId } from "@/services/user-storage";
import {
  useAllCardBillRollovers,
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useCorporateDividends,
  useCreditCards,
  useDebts,
  useDemoSession,
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
  useUserTrips,
} from "@/state";
import { getStoredInitialGoal, setStoredInitialGoal } from "@/state/demo-mode";
import { isQueryPending } from "@/state/query-readiness";
import {
  readWarmClassTargets,
  readWarmLoans,
  readWarmPortfolioAssets,
  readWarmTripDetailsMap,
  usePassiveCarouselCache,
  useUserFinancialContext,
} from "@/state/selectors";
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
  const cardRolloversQuery = useAllCardBillRollovers();
  const contributionsQuery = usePortfolioContributions();
  const splitSharesQuery = useMyPublicShares("split");
  const goalSharesQuery = useMyPublicShares("goal_tracker");
  const tripsQuery = useUserTrips();

  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily({ enabled: isFamilyModeEnabled });
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
  const { hasFeature, profile, isLoading: accessLoading } = useUserAccess();
  const canUseInvestments = !accessLoading && hasFeature("investments");
  const portfolioPositionQuery = usePortfolioPosition({ enabled: canUseInvestments });
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const onboardingQuery = useOnboardingCounts();
  const corporateDividends = useCorporateDividends({
    enabled: canUseInvestments,
  });
  const { isDemoActive } = useDemoSession();
  const subscription = useUserSubscription();
  const {
    dismissalsMap: carouselDismissalsMap,
    invalidIds: carouselDismissalsInvalidIds,
    isCardVisible,
  } = useCarouselDismissals();
  const { isDismissed: isOnboardingDismissed, dismiss: rawDismissOnboarding } = useOnboardingDismissed();
  const isEffectiveOnboardingDismissed =
    isOnboardingDismissed ||
    isTimedAlertDismissed(alertDismissals.cards?.["onboarding-progress-banner"]) ||
    !isCardVisible("onboarding.progress", {
      legacySources: { dashboardAlertDismissals: alertDismissals },
    });

  const dismissOnboarding = useCallback(() => {
    rawDismissOnboarding();
    try {
      updateCustomSettingsMutation.mutate({
        dashboardAlertDismissals: {
          ...(userPreferencesQuery.data?.custom_settings?.dashboardAlertDismissals ?? {}),
          cards: {
            ...(userPreferencesQuery.data?.custom_settings?.dashboardAlertDismissals?.cards ?? {}),
            "onboarding-progress-banner": createTimedDismissalCheckpoint(365),
          },
        },
      });
    } catch {
      // Falha silenciosa caso offline
    }
  }, [rawDismissOnboarding, updateCustomSettingsMutation, userPreferencesQuery.data]);

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
  const showVirginGuide = isVirginAccount && !virginGuideDismissed && !isEffectiveOnboardingDismissed;
  const showOnboarding =
    !showVirginGuide && !isEffectiveOnboardingDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data, hasFeature, initialGoal)
      : false;

  const hasMonthIncomesOrExpenses =
    (incomesQuery.data?.length ?? 0) > 0 || (expensesQuery.data?.length ?? 0) > 0;

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    userPreferencesQuery.isLoading ||
    (!hasMonthIncomesOrExpenses && onboardingQuery.isLoading && !onboardingQuery.data);

  const error = incomesQuery.error ?? expensesQuery.error ?? null;

  const hasCashHistory = Boolean(
    realCashData.cashBalance.inflowSinceCheckpointCents > 0 ||
      realCashData.cashBalance.outflowSinceCheckpointCents > 0 ||
      realCashData.cashBalance.eventsSinceCheckpoint.length > 0,
  );

  const {
    context: financialContext,
    predictedUpcomingInflows,
    isLoading: financialContextLoading,
  } = useUserFinancialContext({
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
    cardRolloversLoading: cardRolloversQuery.isLoading,
    debtsLoading: debtsQuery.isLoading,
    splitSharesLoading: splitSharesQuery.isLoading,
    cards: scopedCards,
    cardExpenses: cardExpensesQuery.data,
    cardPayments: cardPaymentsQuery.data,
    cardRollovers: cardRolloversQuery.data,
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
  const legacyDismissalSources = useMemo(
    () => ({ dashboardAlertDismissals: alertDismissals }),
    [alertDismissals],
  );

  const isPaceEligible =
    isCardVisible("cashflow.pace") &&
    shouldShowPaceAlert(alertDismissals.pace, {
      month,
      spentPercent: cashflow.pace.spentPercent,
      surplusCents: cashflow.projection.surplusCents,
    }) &&
    advisorDecayMeta.pace?.muted !== true;

  const isSurplusEligible =
    isCardVisible("cashflow.surplus") &&
    shouldShowSurplusAlert(alertDismissals.surplus, {
      month,
      surplusCents: cashflow.surplusCapacity.suggestedAporteCents,
    }) &&
    advisorDecayMeta.surplus?.muted !== true;

  const isGovernanceDismissed =
    !isCardVisible("portfolio.governance_review", {
      legacySources: legacyDismissalSources,
    }) || isGovernanceAlertDismissed(alertDismissals.governance);
  const hasPendingSplitSignals = useMemo(
    () => extractPendingSplitSignals(splitSharesQuery.data ?? []).length > 0,
    [splitSharesQuery.data],
  );
  const isCardDismissed = useCallback(
    (cardKey: string) =>
      !isCardVisible(cardKey, { legacySources: legacyDismissalSources }) ||
      isTimedAlertDismissed(alertDismissals.cards?.[cardKey]),
    [isCardVisible, legacyDismissalSources, alertDismissals.cards],
  );
  const isCashGapEligible =
    !isCardDismissed("cashflow.cash_gap") &&
    advisorDecayMeta.cash_gap?.muted !== true;
  const isTrialBannerEligible =
    !subscription.isLoading &&
    isCardVisible("billing.trial_ending", {
      legacySources: legacyDismissalSources,
      policyContext: {
        trialDaysRemaining: subscription.trialDaysRemaining ?? undefined,
      },
    }) &&
    shouldShowTrialBanner(
      subscription.trialDaysRemaining,
      Boolean(subscription.hasAutoRenew),
      alertDismissals.cards?.["trial-ending"],
    );

  const isAlertsDataLoading =
    loading ||
    financialContextLoading ||
    Boolean(accessLoading) ||
    Boolean(subscription.isLoading) ||
    isQueryPending(userPreferencesQuery) ||
    isQueryPending(budgetsQuery) ||
    isQueryPending(expenseCategories) ||
    isQueryPending(cardExpensesQuery) ||
    isQueryPending(cardPaymentsQuery) ||
    isQueryPending(cardRolloversQuery) ||
    isQueryPending(contributionsQuery) ||
    isQueryPending(splitSharesQuery) ||
    isQueryPending(goalSharesQuery) ||
    isQueryPending(tripsQuery) ||
    isQueryPending(myFamilyQuery, isFamilyModeEnabled) ||
    isQueryPending(familyConsolidationQuery, hasFamily) ||
    Boolean(
      !accessLoading &&
        hasFeature("investments") &&
        (corporateDividends.isLoading || portfolioPositionQuery?.isLoading),
    );

  const notificationCategoryPrefs = useMemo(
    () =>
      resolveNotificationCategoryPreferences(
        userPreferencesQuery.data?.custom_settings?.notificationCategories,
      ),
    [userPreferencesQuery.data?.custom_settings?.notificationCategories],
  );
  const portfolioRiskPolicy = useMemo(
    () =>
      resolvePortfolioRiskPolicy(
        userPreferencesQuery.data?.custom_settings?.portfolioRiskPolicy,
      ),
    [userPreferencesQuery.data?.custom_settings?.portfolioRiskPolicy],
  );

  const activeSessionUserId = currentUserId ?? getActiveUserId();
  const evidenceIdentity = useMemo(
    () => ({
      userId: activeSessionUserId,
      mode: isDemoActive ? ("demo" as const) : ("auth" as const),
      scope: effectiveViewScope,
      month,
      asOf: today,
    }),
    [activeSessionUserId, isDemoActive, effectiveViewScope, month, today],
  );
  const {
    queryClient: passiveQueryClient,
    cacheVersion: passiveCacheVersion,
    publish: publishCarouselCache,
  } = usePassiveCarouselCache(evidenceIdentity, { subscribeToEvidence: false });

  useEffect(() => {
    if (
      loading ||
      financialContextLoading ||
      isAlertsDataLoading ||
      !isCurrentMonth ||
      !evidenceIdentity.userId
    ) {
      return;
    }
    publishCarouselCache({
      surplusCapacity: cashflow.surplusCapacity,
      cashGapResult: obligations.cashGapResult,
      isCurrentMonth,
      dayOfMonth: financialContext.dayOfMonth,
      daysInMonth: financialContext.daysInMonth,
      safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
      hasLiquidityContext: financialContext.lens.liquidity.hasLiquidityContext,
      investmentCents: cashflow.totals.investmentCents,
      debtsCount: scopedDebts?.length ?? 0,
    });
  }, [
    loading,
    financialContextLoading,
    isAlertsDataLoading,
    isCurrentMonth,
    evidenceIdentity.userId,
    publishCarouselCache,
    cashflow.surplusCapacity,
    obligations.cashGapResult,
    financialContext.dayOfMonth,
    financialContext.daysInMonth,
    realCashData.safeToSpend.safeToSpendCents,
    financialContext.lens.liquidity.hasLiquidityContext,
    cashflow.totals.investmentCents,
    scopedDebts?.length,
  ]);

  const settlingOrEndedTripIds = useMemo(
    () =>
      (tripsQuery.data ?? [])
        .filter((t) => t.status === "settling" || (t.status === "active" && t.end_date < today))
        .map((t) => t.id),
    [tripsQuery.data, today],
  );
  const warmLoans = useMemo(() => {
    void passiveCacheVersion;
    return readWarmLoans(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);
  const warmClassTargets = useMemo(() => {
    void passiveCacheVersion;
    return readWarmClassTargets(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);
  const warmPortfolioAssets = useMemo(() => {
    void passiveCacheVersion;
    return readWarmPortfolioAssets(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);
  const warmTripDetailsById = useMemo(() => {
    void passiveCacheVersion;
    return readWarmTripDetailsMap(passiveQueryClient, settlingOrEndedTripIds);
  }, [passiveCacheVersion, passiveQueryClient, settlingOrEndedTripIds]);

  return {
    month,
    prevMonth,
    rangeEnd,
    today,
    isCurrentMonth,
    loading,
    financialContextLoading,
    isAlertsDataLoading,
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
    notificationCategoryPrefs,
    portfolioRiskPolicy,
    carouselDismissalsMap,
    carouselDismissalsInvalidIds,
    subscription,
    realCashData,
    positionRows,
    portfolioPositionQuery,
    canUseInvestments,
    effectiveViewScope,
    budgetsQuery,
    expenseCategories,
    cardsQuery,
    scopedCards,
    debtsQuery,
    scopedDebts,
    incomesQuery,
    expensesQuery,
    scopedExpenses,
    prevExpensesQuery,
    cardExpensesQuery,
    cardPaymentsQuery,
    cardRolloversQuery,
    contributionsQuery,
    tripsQuery,
    warmLoans,
    warmClassTargets,
    warmPortfolioAssets,
    warmTripDetailsById,
  };
}
