import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  AutoRegisteredBanner,
  type DonutSlice,
  MonthPicker,
  PendingSplitSignalsCard,
  PendingSuggestionsCard,
} from "@/components/modules";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth } from "@/lib/date";
import { hasSeenWelcomeModal, useAssetGovernanceInsights, useUserAccess } from "@/state";
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
  const data = useOverviewData({ month, alertDismissals });
  const govInsights = useAssetGovernanceInsights();

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
  });

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

  const alertItems = buildOverviewAlertItems({
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
    onInspectDividends: () => modals.setPendingDividendsModalOpen(true),
    canViewInvestments: hasFeature("investments"),
    overdueReviewsCount: govInsights.overdueReviewsCount,
    onReviewGovernance: () => navigate("/investments?tab=metas"),
  });

  const hasFinance =
    hasFeature("transactions") || hasFeature("cards") || hasFeature("debts") || hasFeature("budgets");

  if (!accessLoading && !hasFinance && hasFeature("investments")) {
    return <Navigate to="/investments" replace />;
  }

  const welcomeModalOpen = data.isVirginAccount && !hasSeenWelcomeModal() && !modals.welcomeDismissed;

  return (
    <>
      <OverviewModalsHost
        month={month}
        welcomeModalOpen={welcomeModalOpen}
        data={data}
        modals={modals}
        upgradeModal={upgradeModal}
      />

      <div className="flex flex-col gap-6 w-full min-w-0">
        <MonthPicker value={month} onValueChange={setMonth} />
        <AutoRegisteredBanner />
        <PendingSuggestionsCard />
        <PendingSplitSignalsCard />

        <OverviewDashboardContent
          month={month}
          data={data}
          modals={modals}
          donutSlices={donutSlices}
          alertItems={alertItems}
          detectedPix={detectedPix}
          onDismissDetectedPix={dismissDetectedPix}
          guardAction={guardAction}
          navigate={navigate}
        />
      </div>
    </>
  );
}
