import { useCallback, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  AutoRegisteredBanner,
  type DonutSlice,
  MonthPicker,
  type OnboardingQuickTourTrack,
  PendingSplitSignalsCard,
  PendingSuggestionsCard,
} from "@/components/modules";
import { getTourTrackMeta } from "@/domain/demo-simulation";
import { selectOperationalHomeBanner } from "@/domain/insights";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth } from "@/lib/date";
import { openDividendReviewModal } from "@/services/dividend-review-modal";
import { useAutoRegisteredBanner, usePendingSuggestions } from "@/services/native";
import { startDemo, useAssetGovernanceInsights, useMarketQuotesSwr, useUserAccess } from "@/state";
import {
  buildOverviewAlertItems,
  OverviewDashboardContent,
  OverviewModalsHost,
} from "../components";
import {
  useDashboardAlertDismissals,
  useOverviewData,
  useOverviewPermissionsBanner,
  usePixClipboardDetector,
  useSmartAdvisorInsights,
} from "../hooks";
import { useOverviewModals } from "../hooks/use-overview-modals";

/**
 * Tela principal de Visão Geral (Home) com saúde do caixa, KPIs, fluxos, alertas e orçamentos.
 */
export function OverviewPage() {
  const { hasFeature, isLoading: accessLoading } = useUserAccess();
  const [month, setMonth] = useState(currentMonth);
  const { detectedPix, dismissDetectedPix, clearDetectedPix } = usePixClipboardDetector();
  const navigate = useNavigate();
  const { guardAction, upgradeModal } = useMutationGuard();

  const { alertDismissals, updateAlertDismissals } = useDashboardAlertDismissals();
  const permissions = useOverviewPermissionsBanner(navigate);
  useMarketQuotesSwr({ enabled: !accessLoading && hasFeature("investments"), enableInterval: false });
  const data = useOverviewData({ month, alertDismissals });
  const govInsights = useAssetGovernanceInsights();

  const suppressedAdvisorThemeKeys = useMemo(() => {
    const keys: string[] = [];
    const hasHouseholdExceeded = Boolean(
      data.householdData &&
        data.householdData.monthly_ceiling_cents > 0 &&
        data.householdData.spent_percentage >= 100,
    );
    const hasHouseholdSettlement = Boolean(
      data.householdData &&
        !data.householdData.is_settled &&
        data.householdData.settlement &&
        data.householdData.settlement.amount_cents > 0,
    );
    // Evita efeito whack-a-mole: mesmo quando SurplusAporteBanner foi dispensado por 7d/30d,
    // a oportunidade de aporte na Home continua controlada pela dispensa explícita sem
    // ressuscitar "aporte:rebalance" / "aporte:habit" no SmartAdvisor imediatamente.
    const hasSurplusBannerOrDismissed = Boolean(
      data.surplusCapacity.hasSurplus &&
        data.isCurrentMonth &&
        (data.isSurplusEligible || Boolean(alertDismissals.surplus)),
    );

    if (hasHouseholdExceeded) {
      keys.push("household:ceiling_exceeded");
    }
    if (hasHouseholdSettlement) {
      keys.push("household:settlement_pending");
    }
    if (hasSurplusBannerOrDismissed) {
      keys.push("aporte:rebalance", "aporte:habit");
    }
    return keys;
  }, [
    data.householdData,
    data.surplusCapacity.hasSurplus,
    data.isCurrentMonth,
    data.isSurplusEligible,
    alertDismissals.surplus,
  ]);

  const advisor = useSmartAdvisorInsights({
    month,
    enabled: data.isCurrentMonth && !data.showVirginGuide,
    savingsSurplusCents: data.surplusCapacity.suggestedAporteCents,
    safeToSpendCents: data.realCashData.safeToSpend.safeToSpendCents,
    committedObligationsCents: data.realCashData.safeToSpend.committedObligationsCents,
    suppressedThemeKeys: suppressedAdvisorThemeKeys,
  });

  const modals = useOverviewModals({
    month,
    navigate,
    clearDetectedPix,
    updateAlertDismissals,
    paceSpentPercent: data.pace.spentPercent,
    projectionSurplusCents: data.projection.surplusCents,
    surplusSuggestedAporteCents: data.surplusCapacity.suggestedAporteCents,
    hasSurplus: data.surplusCapacity.hasSurplus,
    liveGoalProgress: data.liveGoalProgress,
    advisorDecayMeta: data.advisorDecayMeta,
    onPersistDecayMeta: (nextMeta) => {
      data.updateCustomSettingsMutation.mutate({ advisorDecayMeta: nextMeta });
    },
  });

  const autoRegisteredItem = useAutoRegisteredBanner();
  const pendingSuggestions = usePendingSuggestions();
  const operationalBannerPlan = selectOperationalHomeBanner([
    { kind: "auto_registered", active: Boolean(autoRegisteredItem) },
    { kind: "pending_split_signals", active: data.hasPendingSplitSignals },
    { kind: "pending_suggestions", active: pendingSuggestions.length > 0 },
    { kind: "pix_clipboard", active: Boolean(detectedPix && !data.showVirginGuide) },
  ]);

  const handleStartQuickTour = useCallback(
    (track: OnboardingQuickTourTrack) => {
      startDemo(track);
      const meta = getTourTrackMeta(track);
      if (meta?.startRoute && meta.startRoute !== "/") {
        navigate(meta.startRoute);
      }
    },
    [navigate],
  );

  const { budgetAndDonut } = data;
  const donutSlices = useMemo<DonutSlice[]>(
    () =>
      budgetAndDonut.donutSliceDescriptors.map((slice) => ({
        key: slice.key,
        label: slice.label,
        valueCents: slice.valueCents,
        icon: slice.icon,
        color: slice.color,
        onClick: slice.isOthers
          ? () => modals.setIsOtherCategoriesOpen(true)
          : () => modals.setSelectedCategoryId(slice.key),
      })),
    [budgetAndDonut.donutSliceDescriptors, modals],
  );

  const hasTrackableObligation =
    (data.cardsQuery.data?.length ?? 0) > 0 ||
    (data.debtsQuery.data?.length ?? 0) > 0 ||
    data.splitPendingData.count > 0;
  const showJitDeviceAlertsInvite = Boolean(
    !data.showVirginGuide &&
      hasTrackableObligation &&
      data.onboardingQuery?.data &&
      !data.onboardingQuery.data.notificationsEnabled &&
      !permissions.isChecking &&
      !permissions.hasDeviceAlertsConfigured &&
      !data.isCardDismissed("jit-device-alerts-invite"),
  );

  const alertItems = buildOverviewAlertItems({
    month,
    data,
    shouldShowPermissionsBanner: permissions.shouldShowPermissionsBanner,
    permissionBannerType: permissions.permissionBannerType,
    onPermissionsAction: permissions.handlePermissionsBannerAction,
    onPermissionsDismiss: permissions.handlePermissionsBannerDismiss,
    onNavigateInsights: () => navigate("/insights?aba=projection"),
    onDismissPace: modals.handleDismissPace,
    onOpenGoalDeposit: (share) => modals.setDepositGoalShare(share),
    onNavigateGoal: (shareId) => navigate(`/orcamentos?tab=goals&q=${shareId}`),
    onDismissGoal: modals.handleDismissGoal,
    onDismissSurplus: modals.handleDismissSurplus,
    onInspectDividends: () => openDividendReviewModal({ initialTab: "review" }),
    canViewInvestments: hasFeature("investments"),
    overdueReviewsCount: govInsights.overdueReviewsCount,
    onReviewGovernance: () => navigate("/investments?tab=metas"),
    onDismissGovernance: modals.handleDismissGovernance,
    isGovernanceDismissed: data.isGovernanceDismissed,
    showOnboardingCarousel: data.showOnboarding,
    initialGoal: data.initialGoal,
    onOpenOnboardingChecklist: () => modals.setOnboardingChecklistOpen(true),
    onDismissOnboarding: data.dismissOnboarding,
    showJitDeviceAlertsInvite,
    onOpenInitialPreferences: () => modals.setInitialPreferencesOpen(true),
    onDismissCard: modals.handleDismissCard,
    advisorInsights: advisor.insights,
    onDismissAdvisor: advisor.dismiss,
    onConfirmRecurrence: advisor.confirmRecurrence,
    onIgnoreRecurrence: (occurrenceKey, reason) =>
      reason === "essential"
        ? advisor.markAsEssential(occurrenceKey)
        : advisor.ignoreRecurrence(occurrenceKey, reason),
    onMarkEssential: advisor.markAsEssential,
    onConfirmIncome: advisor.confirmIncome,
    onConfirmExpense: advisor.confirmExpense,
  });

  const hasFinance =
    hasFeature("transactions") || hasFeature("cards") || hasFeature("debts") || hasFeature("budgets");

  if (!accessLoading && !hasFinance && hasFeature("investments")) {
    return <Navigate to="/investments" replace />;
  }

  return (
    <>
      <OverviewModalsHost
        month={month}
        data={data}
        modals={modals}
        onStartQuickTour={handleStartQuickTour}
        upgradeModal={upgradeModal}
      />

      <div className="flex flex-col gap-6 w-full min-w-0">
        <MonthPicker value={month} onValueChange={setMonth} />
        {operationalBannerPlan.visibleKinds.includes("auto_registered") ? <AutoRegisteredBanner /> : null}
        {operationalBannerPlan.visibleKinds.includes("pending_suggestions") ? (
          <PendingSuggestionsCard />
        ) : null}
        {operationalBannerPlan.visibleKinds.includes("pending_split_signals") ? (
          <PendingSplitSignalsCard />
        ) : null}

        <OverviewDashboardContent
          month={month}
          data={data}
          modals={modals}
          donutSlices={donutSlices}
          alertItems={alertItems}
          detectedPix={detectedPix}
          showPixClipboardBanner={operationalBannerPlan.visibleKinds.includes("pix_clipboard")}
          onDismissDetectedPix={dismissDetectedPix}
          guardAction={guardAction}
          onStartQuickTour={handleStartQuickTour}
          navigate={navigate}
        />
      </div>
    </>
  );
}
