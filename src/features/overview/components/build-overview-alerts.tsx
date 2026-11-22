import {
  CashGapAlert,
  type DashboardAlertItem,
  PaceAlertBanner,
  PermissionsAlertBanner,
  SurplusAporteBanner,
  TrialEndingBanner,
} from "@/components/modules";
import type { PermissionAlertBannerType } from "@/components/modules/permissions-alert-banner";
import { ActiveTripBanner } from "@/features/trips/components";
import type { PublicShare } from "@/types";
import type { useOverviewData } from "../hooks/use-overview-data";
import { CorporateDividendsBanner } from "./corporate-dividends-banner";
import { GoalProgressAlertBanner } from "./goal-progress-alert-banner";
import { HouseholdAlertBanner } from "./household-alert-banner";
import { PortfolioGovernanceBanner } from "./portfolio-governance-banner";
import { SplitPendingBanner } from "./split-pending-banner";

export interface BuildOverviewAlertItemsParams {
  data: ReturnType<typeof useOverviewData>;
  shouldShowPermissionsBanner: boolean;
  permissionBannerType: PermissionAlertBannerType | null;
  onPermissionsAction: () => void;
  onPermissionsDismiss: () => void;
  onNavigateInsights: () => void;
  onDismissPace: (days: 7 | 30) => void;
  onOpenGoalDeposit: (share: PublicShare) => void;
  onNavigateGoal: (shareId: string) => void;
  onDismissGoal: (share: PublicShare, days: 7 | 30) => void;
  onDismissSurplus: (days: 7 | 30) => void;
  onInspectDividends: () => void;
  canViewInvestments: boolean;
  overdueReviewsCount: number;
  onReviewGovernance: () => void;
  onDismissGovernance?: (days: 7 | 30) => void;
  isGovernanceDismissed?: boolean;
}

/**
 * Monta e prioriza os alertas exibidos no carrossel da Visão Geral.
 */
export function buildOverviewAlertItems(
  params: BuildOverviewAlertItemsParams,
): (DashboardAlertItem | null | undefined | false)[] {
  const { data } = params;
  const { householdData, currentUserId, isCurrentMonth, cashGapResult, activeTrips, splitPendingData } = data;
  const { showPaceAlert, isPaceEligible, pace, daily, projection, eligibleGoalShares, liveGoalProgress } = data;
  const { surplusCapacity, isSurplusEligible, corporateDividends, subscription } = data;

  const hasHouseholdExceeded = Boolean(
    householdData && householdData.monthly_ceiling_cents > 0 && householdData.spent_percentage >= 100,
  );
  const hasHouseholdSettlement = Boolean(
    householdData && !householdData.is_settled && householdData.settlement && householdData.settlement.amount_cents > 0,
  );

  return [
    params.shouldShowPermissionsBanner &&
      params.permissionBannerType && {
        id: "permissions-alert",
        priority: 1,
        content: (
          <PermissionsAlertBanner
            type={params.permissionBannerType}
            onAction={params.onPermissionsAction}
            onDismiss={params.onPermissionsDismiss}
          />
        ),
      },
    hasHouseholdExceeded && {
      id: "household-ceiling-exceeded",
      priority: 1,
      content: (
        <HouseholdAlertBanner
          variant="ceiling_exceeded"
          totalSpentCents={householdData!.total_spent_cents}
          ceilingCents={householdData!.monthly_ceiling_cents}
          spentPercentage={householdData!.spent_percentage}
          daysRemaining={daily.daysRemaining ?? undefined}
        />
      ),
    },
    isCurrentMonth && cashGapResult.isCashGapDetected && {
      id: "cash-gap-alert",
      priority: cashGapResult.severity === "critical" ? 1 : 3,
      content: <CashGapAlert result={cashGapResult} />,
    },
    activeTrips[0]
      ? {
          id: `active-trip-${activeTrips[0].id}`,
          priority: 2,
          content: (
            <ActiveTripBanner
              trip={activeTrips[0]}
              totalExpensesCents={data.activeTripExpensesTotalCents}
            />
          ),
        }
      : false,
    hasHouseholdSettlement && {
      id: "household-settlement-pending",
      priority: 2,
      content: (
        <HouseholdAlertBanner
          variant="settlement_pending"
          settlementAmountCents={householdData!.settlement!.amount_cents}
          settlementPayerName={householdData!.settlement!.payer_name}
          settlementReceiverName={householdData!.settlement!.receiver_name}
          isCurrentUserPayer={currentUserId ? householdData!.settlement!.payer_id === currentUserId : false}
          isCurrentUserReceiver={currentUserId ? householdData!.settlement!.receiver_id === currentUserId : false}
        />
      ),
    },
    splitPendingData.count > 0 && {
      id: "split-pending-banner",
      priority: 2,
      content: (
        <SplitPendingBanner
          pendingCents={splitPendingData.pendingCents}
          activeCount={splitPendingData.count}
          totalExpensesCents={splitPendingData.totalExpensesCents}
          items={splitPendingData.items}
        />
      ),
    },
    showPaceAlert && isPaceEligible && {
      id: "pace-alert-banner",
      priority: projection.surplusCents !== null && projection.surplusCents < 0 ? 2 : 3,
      content: (
        <PaceAlertBanner
          spentPercent={pace.spentPercent}
          elapsedPercent={pace.elapsedPercent}
          dailyCents={daily.dailyCents}
          daysRemaining={daily.daysRemaining}
          surplusCents={projection.surplusCents}
          onNavigateInsights={params.onNavigateInsights}
          onDismiss={params.onDismissPace}
        />
      ),
    },
    ...eligibleGoalShares.map((share) => ({
      id: `goal-progress-${share.id}`,
      priority: 3,
      content: (
        <GoalProgressAlertBanner
          key={share.id}
          goalShare={share}
          liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
          surplusCents={surplusCapacity.hasSurplus ? surplusCapacity.suggestedAporteCents : null}
          onOpenDeposit={params.onOpenGoalDeposit}
          onNavigateGoals={() => params.onNavigateGoal(share.id)}
          onDismiss={(days) => params.onDismissGoal(share, days)}
        />
      ),
    })),
    surplusCapacity.hasSurplus && isCurrentMonth && isSurplusEligible && {
      id: "surplus-aporte-banner",
      priority: 4,
      content: (
        <SurplusAporteBanner
          surplusCents={surplusCapacity.suggestedAporteCents}
          onDismiss={params.onDismissSurplus}
        />
      ),
    },
    (corporateDividends.available.length > 0 || corporateDividends.projected.length > 0) && {
      id: "corporate-dividends-alert",
      priority: corporateDividends.available.length > 0 ? 2 : 3,
      content: (
        <CorporateDividendsBanner
          availableCount={corporateDividends.available.length}
          projectedCount={corporateDividends.projected.length}
          totalAvailableAmount={corporateDividends.totalAvailableAmount}
          totalProjectedAmount={corporateDividends.totalProjectedAmount}
          onInspect={params.onInspectDividends}
        />
      ),
    },
    params.canViewInvestments &&
      params.overdueReviewsCount > 0 &&
      !params.isGovernanceDismissed && {
        id: "portfolio-governance-review-alert",
        priority: 3,
        content: (
          <PortfolioGovernanceBanner
            overdueReviewsCount={params.overdueReviewsCount}
            onReview={params.onReviewGovernance}
            onDismiss={params.onDismissGovernance}
          />
        ),
      },
    subscription.isTrial &&
      !subscription.hasAutoRenew &&
      subscription.trialDaysRemaining !== null && {
        id: "trial-ending-banner",
        priority: subscription.trialDaysRemaining <= 7 ? 2 : 4,
        content: <TrialEndingBanner daysRemaining={subscription.trialDaysRemaining} />,
      },
  ];
}
