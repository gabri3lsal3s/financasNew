import { useMemo } from "react";
import { Inbox, Plus } from "lucide-react";
import type { NavigateFunction } from "react-router";
import {
  DashboardAlertsCarousel,
  type DashboardAlertItem,
  DashboardPixClipboardCard,
  type DonutSlice,
  OnboardingBanner,
  QuickAporteCard,
  ReadOnlyBanner,
  RealCashHeroCard,
  SmartAdvisorCard,
  VirginAccountHero,
  WeeklyDueRadarCard,
} from "@/components/modules";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import type { DetectedPixTransaction } from "@/hooks";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import type { useOverviewData } from "../hooks/use-overview-data";
import type { useOverviewModals } from "../hooks/use-overview-modals";
import { OverviewBudgetsSection } from "./overview-budgets-section";
import { OverviewChartsSection } from "./overview-charts-section";
import { OverviewKpiGrid, OverviewLoadingSkeleton } from "./overview-kpi-grid";

export interface OverviewDashboardContentProps {
  month: string;
  data: ReturnType<typeof useOverviewData>;
  modals: ReturnType<typeof useOverviewModals>;
  donutSlices: DonutSlice[];
  alertItems: (DashboardAlertItem | null | undefined | false)[];
  detectedPix: DetectedPixTransaction | null;
  onDismissDetectedPix: () => void;
  guardAction: (action: () => void, label: string) => void;
  navigate: NavigateFunction;
}

/**
 * Corpo principal da Visão Geral alternando entre erro, esqueleto, onboarding/virgem e dashboard ativo.
 */
export function OverviewDashboardContent({
  month,
  data,
  modals,
  donutSlices,
  alertItems,
  detectedPix,
  onDismissDetectedPix,
  guardAction,
  navigate,
}: OverviewDashboardContentProps) {
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
    const hasSurplusBanner = Boolean(
      data.surplusCapacity.hasSurplus &&
        data.isCurrentMonth &&
        data.isSurplusEligible,
    );

    if (hasHouseholdExceeded) {
      keys.push("household:ceiling_exceeded");
    }
    if (hasHouseholdSettlement) {
      keys.push("household:settlement_pending");
    }
    if (hasSurplusBanner) {
      keys.push("aporte:rebalance", "aporte:habit");
    }
    return keys;
  }, [
    data.householdData,
    data.surplusCapacity.hasSurplus,
    data.isCurrentMonth,
    data.isSurplusEligible,
  ]);

  if (data.error) {
    return (
      <ErrorState
        message={getErrorMessage(data.error)}
        onRetry={() => {
          void data.incomesQuery.refetch();
          void data.expensesQuery.refetch();
          if (data.isCurrentMonth) void data.realCashData.refetch();
        }}
      />
    );
  }

  if (data.loading) {
    return <OverviewLoadingSkeleton isCurrentMonth={data.isCurrentMonth} />;
  }

  const { budgetAndDonut } = data;
  const hasMonthIncomesOrExpenses =
    (data.incomesQuery.data ?? []).length > 0 || (data.expensesQuery.data ?? []).length > 0;
  const hasChartActivity = hasMonthIncomesOrExpenses || data.totals.investmentCents > 0;

  return (
    <>
      {data.showOnboarding && data.onboardingQuery?.data ? (
        <OnboardingBanner
          counts={data.onboardingQuery.data}
          hasFeature={data.hasFeature}
          onDismiss={data.dismissOnboarding}
        />
      ) : null}

      {data.isVirginAccount ? (
        <VirginAccountHero
          onCalibrate={() =>
            guardAction(() => modals.setCheckpointOpen(true), "Calibrar Saldo com o Banco")
          }
          onOpenNewTransaction={() => navigate({ pathname: "/", search: "novo=transacao" })}
          onOpenDemo={() => modals.setDemoTrackModalOpen(true)}
        />
      ) : (
        <>
          {detectedPix && detectedPix.candidate.valueCents > 0 ? (
            <div className="w-full animate-fade-slide-in">
              <DashboardPixClipboardCard
                detected={detectedPix}
                onLaunch={modals.handleLaunchPixFromClipboard}
                onDismiss={onDismissDetectedPix}
              />
            </div>
          ) : null}

          <DashboardAlertsCarousel items={alertItems} />

          {data.isCurrentMonth ? (
            <SmartAdvisorCard
              month={month}
              savingsSurplusCents={data.surplusCapacity.suggestedAporteCents}
              safeToSpendCents={data.realCashData.safeToSpend.safeToSpendCents}
              committedObligationsCents={data.realCashData.safeToSpend.committedObligationsCents}
              suppressedThemeKeys={suppressedAdvisorThemeKeys}
            />
          ) : null}

          {data.subscription.isReadOnly ? <ReadOnlyBanner /> : null}

          {data.isCurrentMonth ? (
            <RealCashHeroCard
              realCashData={data.realCashData}
              onCalibrate={() =>
                guardAction(() => modals.setCheckpointOpen(true), "Calibrar Saldo com o Banco")
              }
            />
          ) : null}

          {data.isCurrentMonth ? <WeeklyDueRadarCard summary={data.weeklyRadarSummary} /> : null}

          <OverviewKpiGrid
            month={month}
            totals={data.totals}
            prevTotals={data.prevTotals}
            incomeCents={data.incomeCents}
            expenseCents={data.expenseCents}
            grossIncomeCents={data.grossIncomeCents}
            grossExpenseCents={data.grossExpenseCents}
            dailySeries={data.dailySeries}
            onNavigate={navigate}
          />

          {hasChartActivity ? (
            <OverviewChartsSection
              dailyFlow={data.dailyFlow}
              investmentCents={data.totals.investmentCents}
              grossExpenseCents={data.grossExpenseCents}
              donutSlices={donutSlices}
              totalActiveCategoriesCount={budgetAndDonut.totalActiveCategoriesCount}
              onSliceSelect={(slice) => {
                if (slice.key === "__other_categories__") {
                  modals.setIsOtherCategoriesOpen(true);
                } else if (slice.key) {
                  modals.setSelectedCategoryId(slice.key);
                }
              }}
            />
          ) : null}

          <OverviewBudgetsSection
            hasBudgets={budgetAndDonut.budgetRows.length > 0}
            totalRemainingCents={budgetAndDonut.totalRemainingCents}
            totalLimitsCents={budgetAndDonut.totalLimitsCents}
            globalPercent={budgetAndDonut.globalPercent}
            budgetSegments={budgetAndDonut.budgetSegments}
            onNavigateBudgets={() => navigate("/orcamentos")}
            onSelectCategory={(catId) => modals.setSelectedCategoryId(catId)}
            onOpenOthersBudget={() => modals.setIsOthersBudgetOpen(true)}
          />

          <QuickAporteCard
            currentMonthAporteCents={data.totals.investmentCents}
            suggestedAporteCents={
              data.surplusCapacity.hasSurplus && data.isCurrentMonth
                ? data.surplusCapacity.suggestedAporteCents
                : 0
            }
          />

          {!hasMonthIncomesOrExpenses ? (
            <EmptyState
              icon={<Inbox className="size-6" aria-hidden="true" />}
              title="Sem lançamentos neste mês"
              description={`Registre receitas e despesas de ${monthLabel(month)} para ver os KPIs aqui.`}
              action={
                <Button
                  size="sm"
                  onClick={() => navigate("/transacoes?novo=transacao")}
                  className="gap-2 cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Novo lançamento
                </Button>
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}
