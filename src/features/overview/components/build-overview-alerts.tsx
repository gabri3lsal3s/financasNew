import {
  CashGapAlert,
  type DashboardAlertItem,
  OnboardingCarouselBanner,
  PaceAlertBanner,
  PermissionsAlertBanner,
  SubscriptionPastDueBanner,
  SurplusAporteBanner,
  TrialEndingBanner,
} from "@/components/modules";
import type { PermissionAlertBannerType } from "@/components/modules/permissions-alert-banner";
import { buildCashGapBreakdown, buildPaceProjectionBreakdown } from "@/domain/calculation-memory";
import { applyHomeCarouselAttentionBudget } from "@/domain/insights";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { ActiveTripBanner } from "@/features/trips/components";
import type { OnboardingGoalId, PublicShare } from "@/types";
import type { useOverviewData } from "../hooks/use-overview-data";
import { CorporateDividendsBanner } from "./corporate-dividends-banner";
import { DeviceAlertsInviteBanner } from "./device-alerts-invite-banner";
import { GoalProgressAlertBanner } from "./goal-progress-alert-banner";
import { HouseholdAlertBanner } from "./household-alert-banner";
import { PortfolioGovernanceBanner } from "./portfolio-governance-banner";
import { SmartAdvisorCard } from "./smart-advisor";
import { SplitPendingBanner } from "./split-pending-banner";

export interface BuildOverviewAlertItemsParams {
  month?: string;
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
  showOnboardingCarousel?: boolean;
  initialGoal?: OnboardingGoalId | null;
  onOpenOnboardingChecklist?: () => void;
  onDismissOnboarding?: () => void;
  showJitDeviceAlertsInvite?: boolean;
  onOpenInitialPreferences?: () => void;
  onDismissCard?: (cardKey: string, days: 7 | 30) => void;
  advisorInsights?: SmartAdvisorInsight[];
  onDismissAdvisor?: (themeKey?: string, days?: number) => void;
  onConfirmRecurrence?: (occurrenceKey: string) => void | Promise<void>;
  onIgnoreRecurrence?: (occurrenceKey: string, reason?: CalibrationDecision) => void | Promise<void>;
  onMarkEssential?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  onConfirmIncome?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => void | Promise<void>;
  onConfirmExpense?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
  }) => void | Promise<void>;
}

/**
 * Monta e prioriza os alertas exibidos no carrossel único inteligente da Visão Geral.
 */
export function buildOverviewAlertItems(
  params: BuildOverviewAlertItemsParams,
): (DashboardAlertItem | null | undefined | false)[] {
  const { data } = params;
  const { householdData, currentUserId, isCurrentMonth, cashGapResult, activeTrips, splitPendingData } = data;
  const { showPaceAlert, isPaceEligible, pace, daily, projection, eligibleGoalShares, liveGoalProgress } = data;
  const {
    surplusCapacity,
    isSurplusEligible,
    corporateDividends,
    dividendAutomationPrefs,
    subscription,
  } = data;

  const notifyAvailableDividends = dividendAutomationPrefs?.notifyOnPayment !== false;
  const notifyProvisionedDividends = dividendAutomationPrefs?.notifyOnProvisioned !== false;
  const effectiveAvailableDividends = notifyAvailableDividends ? corporateDividends.available : [];
  const effectiveProjectedDividends = notifyProvisionedDividends ? corporateDividends.projected : [];
  const effectiveAvailableAmount = notifyAvailableDividends ? corporateDividends.totalAvailableAmount : 0;
  const effectiveProjectedAmount = notifyProvisionedDividends ? corporateDividends.totalProjectedAmount : 0;

  const hasHouseholdExceeded = Boolean(
    householdData && householdData.monthly_ceiling_cents > 0 && householdData.spent_percentage >= 100,
  );
  const hasHouseholdSettlement = Boolean(
    householdData && !householdData.is_settled && householdData.settlement && householdData.settlement.amount_cents > 0,
  );
  const trip = activeTrips[0];
  const isPastDueBannerActive =
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.billingPhase === "past_due";

  const paceBreakdown =
    showPaceAlert && isPaceEligible
      ? buildPaceProjectionBreakdown({
          month: params.month ?? data.month,
          referenceBudgetCents: data.referenceBudgetCents,
          referenceBudgetSource: data.referenceBudgetSource,
          isProvisionalReference: data.isProvisionalReference,
          fixedPaidCents: data.financialContext.lens.consumption.fixedPaidCents,
          pendingFixedCents: data.financialContext.lens.liquidity.pendingRecurringExpensesCents,
          oneOffAndTripCents: data.financialContext.lens.consumption.oneOffAndTripCents,
          projectedVariableCents:
            data.projection.projectedVariableCents ??
            data.financialContext.lens.consumption.variableExpenseCents,
          historicalVariableMedianCents:
            data.financialContext.lens.consumption.historicalVariableMedianCents,
          blendedWeight: data.projection.blendedWeight ?? null,
          refundsNeutralizedCents: data.financialContext.lens.consumption.refundsNeutralizedCents,
          priorCycleRefundCreditCents:
            data.financialContext.lens.consumption.priorCycleRefundCreditCents,
          investmentCents: data.investmentCents,
          projectedSurplusCents: projection.surplusCents,
          dailyCents: daily.dailyCents,
          dayOfMonth: data.financialContext.dayOfMonth,
          daysInMonth: data.financialContext.daysInMonth,
        })
      : undefined;

  const predictedInflowsTotalCents = data.predictedUpcomingInflows.reduce(
    (acc, item) => acc + item.amountCents,
    0,
  );
  const cashGapBreakdown =
    isCurrentMonth && cashGapResult.isCashGapDetected && data.isCashGapEligible
      ? buildCashGapBreakdown({
          result: cashGapResult,
          currentBalanceCents: data.realCashData.cashBalance.currentBalanceCents,
          predictedInflowsTotalCents,
        })
      : undefined;

  const rawOperationalItems: (DashboardAlertItem | null | undefined | false)[] = [
    isPastDueBannerActive && {
      id: "subscription-past-due",
      priority: 0,
      content: <SubscriptionPastDueBanner />,
    },
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
    hasHouseholdExceeded &&
      !data.isCardDismissed("household-ceiling-exceeded") && {
        id: "household-ceiling-exceeded",
        priority: 1,
        content: (
          <HouseholdAlertBanner
            variant="ceiling_exceeded"
            totalSpentCents={householdData!.total_spent_cents}
            ceilingCents={householdData!.monthly_ceiling_cents}
            spentPercentage={householdData!.spent_percentage}
            daysRemaining={daily.daysRemaining ?? undefined}
            onDismiss={(days) => params.onDismissCard?.("household-ceiling-exceeded", days)}
          />
        ),
      },
    isCurrentMonth &&
      cashGapResult.isCashGapDetected &&
      data.isCashGapEligible && {
        id: "cash-gap-alert",
        priority: cashGapResult.severity === "critical" ? 1 : 2,
        content: (
          <CashGapAlert
            result={cashGapResult}
            calculationBreakdown={cashGapBreakdown}
            onDismiss={(days) => params.onDismissCard?.("cash-gap-alert", days)}
          />
        ),
      },
    params.showOnboardingCarousel &&
      data.onboardingQuery?.data && {
        id: "onboarding-progress-banner",
        priority: 2,
        content: (
          <OnboardingCarouselBanner
            counts={data.onboardingQuery.data}
            hasFeature={data.hasFeature}
            initialGoal={params.initialGoal}
            onContinue={() => params.onOpenOnboardingChecklist?.()}
            onDismiss={() => params.onDismissOnboarding?.()}
          />
        ),
      },
    trip && !data.isCardDismissed(`active-trip-${trip.id}`)
      ? {
          id: `active-trip-${trip.id}`,
          priority: 2,
          content: (
            <ActiveTripBanner
              trip={trip}
              totalExpensesCents={data.activeTripExpensesTotalCents}
              onDismiss={(days) => params.onDismissCard?.(`active-trip-${trip.id}`, days)}
            />
          ),
        }
      : false,
    hasHouseholdSettlement &&
      !data.isCardDismissed("household-settlement-pending") && {
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
            onDismiss={(days) => params.onDismissCard?.("household-settlement-pending", days)}
          />
        ),
      },
    splitPendingData.count > 0 &&
      !data.hasPendingSplitSignals &&
      !data.isCardDismissed("split-pending-banner") && {
        id: "split-pending-banner",
        priority: 2,
        content: (
          <SplitPendingBanner
            pendingCents={splitPendingData.pendingCents}
            activeCount={splitPendingData.count}
            totalExpensesCents={splitPendingData.totalExpensesCents}
            items={splitPendingData.items}
            onDismiss={(days) => params.onDismissCard?.("split-pending-banner", days)}
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
          isProvisionalReference={data.isProvisionalReference}
          referenceBudgetSource={data.referenceBudgetSource}
          calculationBreakdown={paceBreakdown}
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
          allocationIntent={surplusCapacity.allocationIntent}
          emergencyMonthsCovered={data.financialContext.lens.wealth.emergencyMonthsCovered}
          emergencyTargetMonths={data.financialContext.lens.wealth.emergencyTargetMonths}
          onDismiss={params.onDismissSurplus}
        />
      ),
    },
    params.canViewInvestments &&
      isCurrentMonth &&
      (effectiveAvailableDividends.length > 0 || effectiveProjectedDividends.length > 0) &&
      !data.isCardDismissed("corporate-dividends-alert") && {
        id: "corporate-dividends-alert",
        priority: effectiveAvailableDividends.length > 0 ? 2 : 3,
        content: (
          <CorporateDividendsBanner
            availableCount={effectiveAvailableDividends.length}
            projectedCount={effectiveProjectedDividends.length}
            totalAvailableAmount={effectiveAvailableAmount}
            totalProjectedAmount={effectiveProjectedAmount}
            hasUncertainTax={effectiveAvailableDividends.some((d) => Boolean(d.isTypeUncertain))}
            onInspect={params.onInspectDividends}
            onDismiss={(days) => params.onDismissCard?.("corporate-dividends-alert", days)}
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
    params.showJitDeviceAlertsInvite &&
      !data.isCardDismissed("jit-device-alerts-invite") && {
        id: "jit-device-alerts-invite",
        priority: 3.5,
        content: (
          <DeviceAlertsInviteBanner
            onConfigure={() => params.onOpenInitialPreferences?.()}
            onDismiss={() => params.onDismissCard?.("jit-device-alerts-invite", 30)}
          />
        ),
      },
    subscription.isTrial &&
      data.isTrialBannerEligible &&
      subscription.trialDaysRemaining !== null && {
        id: "trial-ending-banner",
        priority: subscription.trialDaysRemaining <= 7 ? 2 : 4,
        content: (
          <TrialEndingBanner
            daysRemaining={subscription.trialDaysRemaining}
            hasAutoRenew={subscription.hasAutoRenew}
            onDismiss={
              subscription.trialDaysRemaining > 3
                ? (days) => params.onDismissCard?.("trial-ending", days)
                : undefined
            }
          />
        ),
      },
  ];

  const operationalItems = rawOperationalItems.filter(
    (item): item is DashboardAlertItem => Boolean(item && item.content),
  );
  const maxAdvisorSlides = Math.max(0, 2 - operationalItems.length);
  const advisorSlides: DashboardAlertItem[] = (params.advisorInsights ?? [])
    .slice(0, maxAdvisorSlides)
    .map((insight) => ({
      id: `smart-advisor-${insight.id}`,
      priority: insight.priority === 1 ? 3.2 : insight.priority === 2 ? 3.6 : 4.2,
      content: (
        <SmartAdvisorCard
          embeddedInCarousel
          month={params.month}
          insight={insight}
          onDismiss={params.onDismissAdvisor}
          onConfirmRecurrence={
            params.onConfirmRecurrence
              ? async (key) => {
                  await params.onConfirmRecurrence!(key);
                  params.onDismissAdvisor?.(insight.themeKey);
                }
              : undefined
          }
          onIgnoreRecurrence={
            params.onIgnoreRecurrence
              ? async (key, reason) => {
                  await params.onIgnoreRecurrence!(key, reason);
                  params.onDismissAdvisor?.(insight.themeKey);
                }
              : undefined
          }
          onMarkEssential={params.onMarkEssential}
          onConfirmIncome={
            params.onConfirmIncome
              ? async (payload) => {
                  await params.onConfirmIncome!(payload);
                  params.onDismissAdvisor?.(insight.themeKey);
                }
              : undefined
          }
          onConfirmExpense={
            params.onConfirmExpense
              ? async (payload) => {
                  await params.onConfirmExpense!(payload);
                  params.onDismissAdvisor?.(insight.themeKey);
                }
              : undefined
          }
        />
      ),
    }));

  return applyHomeCarouselAttentionBudget([...operationalItems, ...advisorSlides]).visibleItems;
}
