import type { ReactNode } from "react";
import {
  BridgeAlertCard,
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
import {
  buildCashGapBreakdown,
  buildDividendCarouselBreakdown,
  buildFamilyCeilingBreakdown,
  buildFamilySettlementBreakdown,
  buildGoalProgressBreakdown,
  buildPaceProjectionBreakdown,
  buildSplitPendingBreakdown,
  buildSurplusCapacityBreakdown,
} from "@/domain/calculation-memory";
import {
  type InsightThemeFamily,
  type SmartDecayRecord,
} from "@/domain/insights";
import { resolveInsightThemeFamily } from "@/domain/insights/attention-budget";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import {
  detectClosedCardBills,
  detectConsolidatedBudgetOverrun,
  evaluateBillImpactBridge,
  evaluateBudgetCategoryPaceBridge,
  evaluateCombinedContributionBridge,
  evaluateDataHygieneReviewBridge,
  evaluateDebtVsInvestBridge,
  evaluateMonthlyContributionConsistencyBridge,
  evaluatePortfolioCriticalRiskForHome,
  evaluatePortfolioDiscountForHome,
  evaluatePortfolioIdleCashForHome,
  evaluateTripSettlementPendingBridge,
  selectCarouselSlots,
  type BridgeAlertEvaluation,
  type CarouselDismissPreset,
  type CarouselSlotCandidate,
} from "@/domain/notifications/hub";
import type { GovernanceInsight } from "@/domain/portfolio/asset-governance-insights";
import { computePortfolioCarouselDrift } from "@/domain/portfolio/insights-carousel-drift";
import { evaluatePortfolioStructuralRisk } from "@/domain/portfolio/portfolio-risk-policy";
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
  onPermissionsDismiss: (preset?: CarouselDismissPreset) => void;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  onNavigate?: (to: string) => void;
  onNavigateInsights: () => void;
  onDismissPace: (days: 7 | 30) => void;
  onOpenGoalDeposit: (share: PublicShare) => void;
  onNavigateGoal: (shareId: string) => void;
  onDismissGoal: (share: PublicShare, days: 7 | 30) => void;
  onDismissSurplus: (days: 7 | 30) => void;
  onInspectDividends: () => void;
  canViewInvestments: boolean;
  overdueReviewsCount: number;
  govInsights?: readonly GovernanceInsight[];
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
  onDismissAdvisor?: (themeKey?: string, days?: number, options?: { isResolution?: boolean }) => void;
  onConfirmRecurrence?: (occurrenceKey: string) => void | Promise<void>;
  onIgnoreRecurrence?: (occurrenceKey: string, reason?: CalibrationDecision) => void | Promise<void>;
  onMarkEssential?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  onMarkTxOneOff?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  onPauseFamily?: (themeKey: string) => void;
  decayByFamily?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
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
    !subscription.isLoading &&
    (subscription.status === "past_due" ||
      subscription.status === "unpaid" ||
      subscription.billingPhase === "past_due");

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
          predictedInflows: data.predictedUpcomingInflows,
        })
      : undefined;

  const nextCycleInvoicesCents = data.realCashData?.cycleBreakdown?.nextCycleInvoicesCents ?? 0;
  const futureInvoicesCents = data.realCashData?.cycleBreakdown?.futureInvoicesCents ?? 0;

  const surplusBreakdown =
    surplusCapacity.hasSurplus && isCurrentMonth && isSurplusEligible
      ? buildSurplusCapacityBreakdown({
          incomeCents: data.financialContext.lens.consumption.operatingIncomeCents,
          expenseCents: data.financialContext.lens.consumption.netExpenseCents,
          committedObligationsCents: data.realCashData?.safeToSpend?.committedObligationsCents ?? 0,
          pendingRecurringObligationsCents: surplusCapacity.pendingRecurringObligationsCents,
          contributionsAlreadyMadeCents: data.totals.investmentCents,
          safeToSpendCents: data.realCashData?.safeToSpend?.safeToSpendCents,
          suggestedAporteCents: surplusCapacity.suggestedAporteCents,
          allocationIntent: surplusCapacity.allocationIntent,
          emergencyMonthsCovered: data.financialContext.lens.wealth.emergencyMonthsCovered,
          emergencyTargetMonths: data.financialContext.lens.wealth.emergencyTargetMonths,
          nextCycleInvoicesCents,
          futureInvoicesCents,
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
        id:
          params.permissionBannerType === "bank_listener"
            ? "device.permissions.bank_listener"
            : "device.permissions.push_due",
        priority: 1,
        content: (
          <PermissionsAlertBanner
            type={params.permissionBannerType}
            onAction={params.onPermissionsAction}
            onDismiss={() => params.onPermissionsDismiss("7d")}
            onSelectPreset={(preset) => params.onPermissionsDismiss(preset)}
          />
        ),
      },
    hasHouseholdExceeded &&
      !data.isCardDismissed("household.ceiling_exceeded") && {
        id: "household.ceiling_exceeded",
        priority: 1,
        content: (
          <HouseholdAlertBanner
            variant="ceiling_exceeded"
            month={params.month ?? data.month}
            totalSpentCents={householdData!.total_spent_cents}
            ceilingCents={householdData!.monthly_ceiling_cents}
            spentPercentage={householdData!.spent_percentage}
            daysRemaining={daily.daysRemaining ?? undefined}
            calculationBreakdown={buildFamilyCeilingBreakdown({
              monthlyCeilingCents: householdData!.monthly_ceiling_cents,
              totalSpentCents: householdData!.total_spent_cents,
              spentPercentage: householdData!.spent_percentage,
              periodLabel: params.month ?? data.month,
            })}
            onDismiss={(days) => params.onDismissCard?.("household-ceiling-exceeded", days)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("household.ceiling_exceeded", preset)
                : undefined
            }
          />
        ),
      },
    isCurrentMonth &&
      cashGapResult.isCashGapDetected &&
      data.isCashGapEligible && {
        id: "cashflow.cash_gap",
        priority: cashGapResult.severity === "critical" ? 1 : 2,
        content: (
          <CashGapAlert
            result={cashGapResult}
            calculationBreakdown={cashGapBreakdown}
            onDismiss={(days) => params.onDismissCard?.("cash-gap-alert", days)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("cashflow.cash_gap", preset)
                : undefined
            }
          />
        ),
      },
    params.showOnboardingCarousel &&
      data.onboardingQuery?.data && {
        id: "onboarding.progress",
        priority: 2,
        content: (
          <OnboardingCarouselBanner
            counts={data.onboardingQuery.data}
            hasFeature={data.hasFeature}
            initialGoal={params.initialGoal}
            onContinue={() => params.onOpenOnboardingChecklist?.()}
            onDismiss={() => params.onDismissOnboarding?.()}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("onboarding.progress", preset)
                : undefined
            }
          />
        ),
      },
    trip && !data.isCardDismissed(`trip.active.${trip.id}`)
      ? {
          id: `trip.active.${trip.id}`,
          priority: 2,
          content: (
            <ActiveTripBanner
              trip={trip}
              totalExpensesCents={data.activeTripExpensesTotalCents}
              onDismiss={(days) => params.onDismissCard?.(`active-trip-${trip.id}`, days)}
              onSelectPreset={
                params.onSelectPreset
                  ? (preset) => params.onSelectPreset?.(`trip.active.${trip.id}`, preset)
                  : undefined
              }
            />
          ),
        }
      : false,
    hasHouseholdSettlement &&
      !data.isCardDismissed("household.settlement_pending") && {
        id: "household.settlement_pending",
        priority: 2,
        content: (
          <HouseholdAlertBanner
            variant="settlement_pending"
            month={params.month ?? data.month}
            settlementAmountCents={householdData!.settlement!.amount_cents}
            settlementPayerName={householdData!.settlement!.payer_name}
            settlementReceiverName={householdData!.settlement!.receiver_name}
            isCurrentUserPayer={currentUserId ? householdData!.settlement!.payer_id === currentUserId : false}
            isCurrentUserReceiver={currentUserId ? householdData!.settlement!.receiver_id === currentUserId : false}
            calculationBreakdown={buildFamilySettlementBreakdown({
              userId: currentUserId ?? "user",
              displayName:
                currentUserId && householdData!.settlement!.payer_id === currentUserId
                  ? "Você"
                  : (householdData!.settlement!.payer_name ?? "Parceiro"),
              spentCents: householdData!.total_spent_cents,
              fairShareCents: Math.max(
                0,
                householdData!.total_spent_cents - householdData!.settlement!.amount_cents,
              ),
              netBalanceCents:
                currentUserId && householdData!.settlement!.payer_id === currentUserId
                  ? -householdData!.settlement!.amount_cents
                  : householdData!.settlement!.amount_cents,
            })}
            onDismiss={(days) => params.onDismissCard?.("household-settlement-pending", days)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("household.settlement_pending", preset)
                : undefined
            }
          />
        ),
      },
    splitPendingData.count > 0 &&
      !data.hasPendingSplitSignals &&
      !data.isCardDismissed("split.pending") && {
        id: "split.pending",
        priority: 2,
        content: (
          <SplitPendingBanner
            pendingCents={splitPendingData.pendingCents}
            activeCount={splitPendingData.count}
            totalExpensesCents={splitPendingData.totalExpensesCents}
            items={splitPendingData.items}
            calculationBreakdown={buildSplitPendingBreakdown({
              items: splitPendingData.items.map((item) => ({
                id: item.id,
                title: item.title,
                source: "share",
                expenseCents: item.pendingCents,
                pendingCents: item.pendingCents,
                parts: [],
              })),
              pendingCents: splitPendingData.pendingCents,
              count: splitPendingData.count,
            })}
            onDismiss={(days) => params.onDismissCard?.("split-pending-banner", days)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("split.pending", preset)
                : undefined
            }
          />
        ),
      },
    showPaceAlert && isPaceEligible && {
      id: "cashflow.pace",
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
          onSelectPreset={
            params.onSelectPreset
              ? (preset) => params.onSelectPreset?.("cashflow.pace", preset)
              : undefined
          }
        />
      ),
    },
    ...eligibleGoalShares
      .filter((share) => !data.isCardDismissed(`goal.progress.${share.id}`))
      .map((share) => {
        const pld = (share.payload as Record<string, unknown> | null) ?? {};
        const targetCents = Number(pld.target_cents ?? 0);
        const live = liveGoalProgress.get(share.id)?.currentCents;
        const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
        const remainingCents = Math.max(0, targetCents - currentCents);
        const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
        const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
        const isFinalStretch = percentage >= 80 && !isCompleted;
        const stage: "completed" | "final_stretch" | "has_surplus" | "regular" = isCompleted
          ? "completed"
          : isFinalStretch
            ? "final_stretch"
            : surplusCapacity.hasSurplus
              ? "has_surplus"
              : "regular";
        return {
          id: `goal.progress.${share.id}`,
          priority: 3,
          content: (
            <GoalProgressAlertBanner
              key={share.id}
              goalShare={share}
              liveCurrentCents={live}
              surplusCents={surplusCapacity.hasSurplus ? surplusCapacity.suggestedAporteCents : null}
              calculationBreakdown={buildGoalProgressBreakdown({
                shareId: share.id,
                goalTitle: typeof pld.title === "string" ? pld.title : undefined,
                asOf: data.month,
                deadline: typeof pld.deadline === "string" ? pld.deadline : null,
                targetCents,
                currentCents,
                source: live !== undefined ? "Saldo apurado" : "Meta compartilhada",
                remainingCents,
                remainingDays: daily.daysRemaining,
                requiredDailyCents:
                  daily.daysRemaining && daily.daysRemaining > 0
                    ? Math.ceil(remainingCents / daily.daysRemaining)
                    : null,
                stage,
              })}
              onOpenDeposit={params.onOpenGoalDeposit}
              onNavigateGoals={() => params.onNavigateGoal(share.id)}
              onDismiss={(days) => params.onDismissGoal(share, days)}
              onSelectPreset={
                params.onSelectPreset
                  ? (preset) => params.onSelectPreset?.(`goal.progress.${share.id}`, preset)
                  : undefined
              }
            />
          ),
        };
      }),
    surplusCapacity.hasSurplus && isCurrentMonth && isSurplusEligible && {
      id: "cashflow.surplus",
      priority: 4,
      content: (
        <SurplusAporteBanner
          surplusCents={surplusCapacity.suggestedAporteCents}
          allocationIntent={surplusCapacity.allocationIntent}
          emergencyMonthsCovered={data.financialContext.lens.wealth.emergencyMonthsCovered}
          emergencyTargetMonths={data.financialContext.lens.wealth.emergencyTargetMonths}
          calculationBreakdown={surplusBreakdown}
          nextCycleInvoicesCents={nextCycleInvoicesCents}
          futureInvoicesCents={futureInvoicesCents}
          onDismiss={params.onDismissSurplus}
          onSelectPreset={
            params.onSelectPreset
              ? (preset) => params.onSelectPreset?.("cashflow.surplus", preset)
              : undefined
          }
        />
      ),
    },
    params.canViewInvestments &&
      isCurrentMonth &&
      (effectiveAvailableDividends.length > 0 || effectiveProjectedDividends.length > 0) &&
      !data.isCardDismissed(
        effectiveAvailableDividends.length > 0
          ? "portfolio.dividends_available"
          : "portfolio.dividends_projected",
      ) && {
        id:
          effectiveAvailableDividends.length > 0
            ? "portfolio.dividends_available"
            : "portfolio.dividends_projected",
        priority: effectiveAvailableDividends.length > 0 ? 2 : 3,
        content: (
          <CorporateDividendsBanner
            availableCount={effectiveAvailableDividends.length}
            projectedCount={effectiveProjectedDividends.length}
            totalAvailableAmount={effectiveAvailableAmount}
            totalProjectedAmount={effectiveProjectedAmount}
            hasUncertainTax={effectiveAvailableDividends.some((d) => Boolean(d.isTypeUncertain))}
            calculationBreakdown={buildDividendCarouselBreakdown({
              kind: effectiveAvailableDividends.length > 0 ? "available" : "monthly",
              asOf: params.month ?? data.month,
              month: params.month ?? data.month,
              fxRate: 5,
              items: (effectiveAvailableDividends.length > 0
                ? effectiveAvailableDividends
                : effectiveProjectedDividends
              ).map((d, idx) => ({
                key: d.eventId ?? `${d.ticker}:${idx}`,
                ticker: d.ticker,
                currency: d.currency,
                quantityOnComDate: d.quantityOnComDate,
                grossRate: d.rate,
                netRate: d.netRate,
                taxPct: d.taxRatePct ?? (d.currency === "USD" ? 30 : d.type === "JCP" ? 15 : 0),
                taxSource: d.isTypeUncertain ? "Estimado" : "Oficial",
                paymentDate: d.paymentDate,
                nativeNetCents: Math.round(d.totalAmount * 100),
                netBRLCents: Math.round(
                  d.totalAmount * (d.currency === "USD" ? 5 : 1) * 100,
                ),
                included: d.totalAmount > 0,
              })),
              count:
                effectiveAvailableDividends.length > 0
                  ? effectiveAvailableDividends.length
                  : effectiveProjectedDividends.length,
              totalBRLCents: Math.round(
                (effectiveAvailableDividends.length > 0
                  ? effectiveAvailableAmount
                  : effectiveProjectedAmount) * 100,
              ),
            })}
            onInspect={params.onInspectDividends}
            onDismiss={(days) => params.onDismissCard?.("corporate-dividends-alert", days)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) =>
                    params.onSelectPreset?.(
                      effectiveAvailableDividends.length > 0
                        ? "portfolio.dividends_available"
                        : "portfolio.dividends_projected",
                      preset,
                    )
                : undefined
            }
          />
        ),
      },
    params.canViewInvestments &&
      params.overdueReviewsCount > 0 &&
      !params.isGovernanceDismissed && {
        id: "portfolio.governance_review",
        priority: 3,
        content: (
          <PortfolioGovernanceBanner
            overdueReviewsCount={params.overdueReviewsCount}
            onReview={params.onReviewGovernance}
            onDismiss={params.onDismissGovernance}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("portfolio.governance_review", preset)
                : undefined
            }
          />
        ),
      },
    params.showJitDeviceAlertsInvite &&
      !data.isCardDismissed("device.alerts_invite") && {
        id: "device.alerts_invite",
        priority: 5,
        content: (
          <DeviceAlertsInviteBanner
            onConfigure={() => params.onOpenInitialPreferences?.()}
            onDismiss={() => params.onDismissCard?.("jit-device-alerts-invite", 30)}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.("device.alerts_invite", preset)
                : undefined
            }
          />
        ),
      },
    subscription.isTrial &&
      data.isTrialBannerEligible &&
      subscription.trialDaysRemaining !== null && {
        id: "billing.trial_ending",
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
            onSelectPreset={
              params.onSelectPreset && subscription.trialDaysRemaining > 3
                ? (preset) => params.onSelectPreset?.("billing.trial_ending", preset)
                : undefined
            }
          />
        ),
      },
  ];

interface HomeSlotCandidate extends CarouselSlotCandidate {
  content: ReactNode;
}

  const operationalItems = rawOperationalItems.filter(
    (item): item is DashboardAlertItem => Boolean(item && item.content),
  );

  const goalStageByCanonicalId = new Map<
    string,
    "completed" | "final_stretch" | "has_surplus" | "regular"
  >();
  for (const share of eligibleGoalShares) {
    const pld = (share.payload as Record<string, unknown> | null) ?? {};
    const targetCents = Number(pld.target_cents ?? 0);
    const live = liveGoalProgress.get(share.id)?.currentCents;
    const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
    const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
    const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
    const isFinalStretch = percentage >= 80 && !isCompleted;
    const stage: "completed" | "final_stretch" | "has_surplus" | "regular" = isCompleted
      ? "completed"
      : isFinalStretch
        ? "final_stretch"
        : surplusCapacity.hasSurplus
          ? "has_surplus"
          : "regular";
    goalStageByCanonicalId.set(`goal.progress.${share.id}`, stage);
  }

  const operationalCandidates: HomeSlotCandidate[] = operationalItems.map((item) => {
    const canonicalId = item.id === "subscription-past-due" ? "billing.past_due" : item.id;
    const currentGoalStage = goalStageByCanonicalId.get(canonicalId);
    const policyContext =
      canonicalId === "billing.trial_ending"
        ? { trialDaysRemaining: subscription.trialDaysRemaining ?? undefined }
        : currentGoalStage
          ? { goalStage: currentGoalStage }
          : undefined;
    return {
      id: item.id,
      canonicalId,
      priority: item.priority,
      channels: ["home_carousel"],
      ...(policyContext ? { policyContext } : {}),
      ...(currentGoalStage ? { currentGoalStage } : {}),
      isMandatoryBlocking: item.id === "subscription-past-due",
      content: item.content,
    };
  });

  const effectiveMonth = params.month ?? data.month;
  const brokerageCashBRL =
    typeof data.portfolioPositionQuery?.cashBRL === "number"
      ? data.portfolioPositionQuery.cashBRL
      : null;
  const brokerageCashCents =
    brokerageCashBRL !== null ? Math.round(brokerageCashBRL * 100) : null;

  const warmDrift =
    params.canViewInvestments && data.warmClassTargets !== undefined
      ? computePortfolioCarouselDrift({
          classTargets: data.warmClassTargets,
          rows: (data.portfolioPositionQuery?.rows ?? []).map((r) => ({
            assetClass: r.assetClass,
            valueBRL: r.valueBRL,
            isCash: Boolean(r.isCash),
          })),
          totalBRL: data.portfolioPositionQuery?.totalBRL ?? 0,
          cashBRL: brokerageCashBRL ?? 0,
        })
      : null;

  const hasEligibleDeficitTarget = warmDrift
    ? warmDrift.allocationDrift.hasTargets &&
      warmDrift.allocationDrift.underweightItems.length > 0
    : null;

  const eligibleClassName = warmDrift?.allocationDrift.underweightItems[0]?.name;

  const combinedContributionEval =
    params.canViewInvestments && !data.showVirginGuide
      ? evaluateCombinedContributionBridge({
          asOf: data.today,
          month: effectiveMonth,
          isCurrentMonth,
          allocationIntent: surplusCapacity.allocationIntent,
          suggestedAporteCents: surplusCapacity.suggestedAporteCents,
          brokerageCashCents,
          minTicketCents: Math.round((data.portfolioRiskPolicy?.minTicketBRL ?? 100) * 100),
          hasEligibleDeficitTarget,
          eligibleClass: eligibleClassName,
          pendingDividendsCount: effectiveAvailableDividends.length,
          pendingDividendsBRLCents: Math.round(effectiveAvailableAmount * 100),
        })
      : null;

  const closedBillsForImpact =
    data.notificationCategoryPrefs?.billClosing &&
    isCurrentMonth &&
    data.scopedCards &&
    data.cardExpensesQuery?.data &&
    data.cardPaymentsQuery?.data
      ? detectClosedCardBills({
          cards: data.scopedCards,
          cardExpenses: data.cardExpensesQuery.data,
          cardPayments: data.cardPaymentsQuery.data,
          today: data.today,
        })
      : [];

  const billImpactEval = !data.showVirginGuide
    ? evaluateBillImpactBridge({
        isCurrentMonth,
        billClosingEnabled: Boolean(data.notificationCategoryPrefs?.billClosing),
        hasLiquidityContext: Boolean(data.financialContext?.lens?.liquidity?.hasLiquidityContext),
        safeToSpendCents: data.realCashData?.safeToSpend?.safeToSpendCents ?? 0,
        closedBills: closedBillsForImpact,
        cycleInvoices: data.realCashData?.cycleBreakdown?.invoices ?? [],
      })
    : null;

  const overrunAlert =
    isCurrentMonth &&
    data.budgetsQuery?.data &&
    data.scopedExpenses &&
    data.expenseCategories?.data
      ? detectConsolidatedBudgetOverrun({
          month: effectiveMonth,
          budgets: data.budgetsQuery.data,
          expenses: data.scopedExpenses,
          categories: data.expenseCategories.data,
        })
      : null;
  const excludedExceededIds = overrunAlert
    ? new Set(overrunAlert.topCategories.map((c) => c.categoryId))
    : undefined;

  const budgetCategoryPaceEval = !data.showVirginGuide
    ? evaluateBudgetCategoryPaceBridge({
        month: effectiveMonth,
        isCurrentMonth,
        dayOfMonth: data.financialContext.dayOfMonth,
        daysInMonth: data.financialContext.daysInMonth,
        budgets: data.budgetsQuery?.data,
        expenses: data.scopedExpenses,
        categories: data.expenseCategories?.data,
        excludedExceededCategoryIds: excludedExceededIds,
      })
    : null;

  const debtVsInvestEval = !data.showVirginGuide
    ? evaluateDebtVsInvestBridge({
        asOf: data.today,
        debts: data.scopedDebts,
        loans: data.warmLoans,
        allocationIntent: surplusCapacity.allocationIntent,
        suggestedAporteCents: surplusCapacity.suggestedAporteCents,
        brokerageCashCents,
      })
    : null;

  const monthlyConsistencyEval =
    params.canViewInvestments && !data.showVirginGuide && data.contributionsQuery?.data
      ? evaluateMonthlyContributionConsistencyBridge({
          month: effectiveMonth,
          isCurrentMonth,
          dayOfMonth: data.financialContext.dayOfMonth,
          daysInMonth: data.financialContext.daysInMonth,
          allocationIntent: surplusCapacity.allocationIntent,
          suggestedAporteCents: surplusCapacity.suggestedAporteCents,
          contributions: data.contributionsQuery.data,
          hasCombinedContributionBridge: Boolean(combinedContributionEval),
        })
      : null;

  const tripSettlementEval = !data.showVirginGuide
    ? evaluateTripSettlementPendingBridge({
        trips: data.tripsQuery?.data,
        warmTripDetailsById: data.warmTripDetailsById,
        currentUserId,
        today: data.today,
      })
    : null;

  const dataHygieneEval = !data.showVirginGuide
    ? evaluateDataHygieneReviewBridge({
        month: effectiveMonth,
        isCurrentMonth,
        expenses: data.scopedExpenses,
        categories: data.expenseCategories?.data,
      })
    : null;

  const portfolioCriticalEval =
    params.canViewInvestments &&
    !data.showVirginGuide &&
    data.warmPortfolioAssets &&
    data.portfolioPositionQuery?.rows
      ? evaluatePortfolioCriticalRiskForHome({
          alerts: evaluatePortfolioStructuralRisk(
            data.warmPortfolioAssets,
            data.portfolioRiskPolicy,
            {
              positionRows: data.portfolioPositionQuery.rows,
              cashBRL: brokerageCashBRL ?? 0,
              asOf: data.today,
            },
          ),
        })
      : null;

  const portfolioIdleCashEval =
    params.canViewInvestments && !data.showVirginGuide
      ? evaluatePortfolioIdleCashForHome({
          brokerageCashBRL,
          hasEligibleDeficitTarget,
          hasCombinedContributionBridge: Boolean(combinedContributionEval),
        })
      : null;

  const portfolioDiscountEval =
    params.canViewInvestments && !data.showVirginGuide
      ? evaluatePortfolioDiscountForHome({
          discountInsights: params.govInsights,
          allocationIntent: surplusCapacity.allocationIntent,
          suggestedAporteCents: surplusCapacity.suggestedAporteCents,
        })
      : null;

  const rawBridgeEvaluations: (BridgeAlertEvaluation | null)[] = [
    billImpactEval,
    portfolioCriticalEval,
    combinedContributionEval,
    budgetCategoryPaceEval,
    tripSettlementEval,
    debtVsInvestEval,
    monthlyConsistencyEval,
    portfolioIdleCashEval,
    portfolioDiscountEval,
    dataHygieneEval,
  ];

  const handleBridgeNavigate = (to: string) => {
    if (params.onNavigate) {
      params.onNavigate(to);
    } else if (to.startsWith("/insights")) {
      params.onNavigateInsights();
    }
  };

  const bridgeCandidates: HomeSlotCandidate[] = rawBridgeEvaluations
    .filter((ev): ev is BridgeAlertEvaluation => Boolean(ev))
    .filter((ev) => !data.isCardDismissed(ev.canonicalId))
    .map((ev) => ({
      id: ev.canonicalId,
      canonicalId: ev.canonicalId,
      priority: ev.priority,
      severity: ev.severity,
      cycleRelevance: ev.cycleRelevance,
      channels: ev.channels,
      entityRefs: ev.entityRefs,
      suppressCanonicalIds: ev.suppressCanonicalIds,
      content: (
        <BridgeAlertCard
          evaluation={ev}
          onNavigate={handleBridgeNavigate}
          onSelectPreset={params.onSelectPreset}
        />
      ),
    }));

  const advisorCandidates: HomeSlotCandidate[] = (params.advisorInsights ?? [])
    .filter((insight) => !data.isCardDismissed(`advisor.${insight.themeKey}`))
    .map((insight) => {
      const canPauseFamily =
        (params.decayByFamily?.[resolveInsightThemeFamily(insight.themeKey)]?.dismissCount ?? 0) >=
        2;
      // Mantém precedência da Onda 1: sinais operacionais e pontes (0..5) ocupam slots antes do Assistente
      const priority = insight.priority === 1 ? 5.2 : insight.priority === 2 ? 5.6 : 6.2;
      const canonicalId = `advisor.${insight.themeKey}`;
      return {
        id: `smart-advisor-${insight.id}`,
        canonicalId,
        priority,
        channels: ["home_carousel"] as const,
        content: (
          <SmartAdvisorCard
            embeddedInCarousel
            month={params.month}
            insight={insight}
            onDismiss={params.onDismissAdvisor}
            onSelectPreset={
              params.onSelectPreset
                ? (preset) => params.onSelectPreset?.(canonicalId, preset)
                : undefined
            }
            onConfirmRecurrence={
              params.onConfirmRecurrence
                ? async (key) => {
                    await params.onConfirmRecurrence!(key);
                    params.onDismissAdvisor?.(insight.themeKey, undefined, { isResolution: true });
                  }
                : undefined
            }
            onIgnoreRecurrence={
              params.onIgnoreRecurrence
                ? async (key, reason) => {
                    await params.onIgnoreRecurrence!(key, reason);
                    params.onDismissAdvisor?.(insight.themeKey, undefined, { isResolution: true });
                  }
                : undefined
            }
            onMarkEssential={params.onMarkEssential}
            onMarkTxOneOff={params.onMarkTxOneOff}
            onPauseFamily={params.onPauseFamily}
            canPauseFamily={canPauseFamily}
            onConfirmIncome={
              params.onConfirmIncome
                ? async (payload) => {
                    await params.onConfirmIncome!(payload);
                    params.onDismissAdvisor?.(insight.themeKey, undefined, { isResolution: true });
                  }
                : undefined
            }
            onConfirmExpense={
              params.onConfirmExpense
                ? async (payload) => {
                    await params.onConfirmExpense!(payload);
                    params.onDismissAdvisor?.(insight.themeKey, undefined, { isResolution: true });
                  }
                : undefined
            }
          />
        ),
      };
    });

  return selectCarouselSlots({
    channel: "home_carousel",
    items: [...operationalCandidates, ...bridgeCandidates, ...advisorCandidates],
    carouselDismissals: data.carouselDismissalsMap,
    invalidIds: data.carouselDismissalsInvalidIds,
    maxSlots: 3,
  }).visibleItems.map(({ id, priority, content }) => ({
    id,
    priority,
    content,
  }));
}
