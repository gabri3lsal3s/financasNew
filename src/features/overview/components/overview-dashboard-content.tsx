import { useMemo } from "react";
import { Inbox, Plus } from "lucide-react";
import type { NavigateFunction } from "react-router";
import {
  DashboardAlertsCarousel,
  type DashboardAlertItem,
  DashboardPixClipboardCard,
  type DonutSlice,
  type OnboardingQuickTourTrack,
  QuickAporteCard,
  ReadOnlyBanner,
  RealCashHeroCard,
  VirginAccountHero,
  WeeklyDueRadarCard,
} from "@/components/modules";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import { buildSurplusCapacityBreakdown } from "@/domain/calculation-memory";
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
  isAlertsReady?: boolean;
  detectedPix: DetectedPixTransaction | null;
  showPixClipboardBanner?: boolean;
  onDismissDetectedPix: () => void;
  guardAction: (action: () => void, label: string) => void;
  onStartQuickTour: (track: OnboardingQuickTourTrack) => void;
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
  isAlertsReady = true,
  detectedPix,
  showPixClipboardBanner = true,
  onDismissDetectedPix,
  guardAction,
  onStartQuickTour,
  navigate,
}: OverviewDashboardContentProps) {
  const quickAporteBreakdown = useMemo(() => {
    if (!data.surplusCapacity?.hasSurplus || !data.isCurrentMonth || !data.financialContext) {
      return undefined;
    }
    return buildSurplusCapacityBreakdown({
      incomeCents: data.financialContext.lens.consumption.operatingIncomeCents,
      expenseCents: data.financialContext.lens.consumption.netExpenseCents,
      committedObligationsCents: data.realCashData?.safeToSpend?.committedObligationsCents ?? 0,
      pendingRecurringObligationsCents: data.surplusCapacity.pendingRecurringObligationsCents ?? 0,
      contributionsAlreadyMadeCents: data.totals?.investmentCents ?? 0,
      safeToSpendCents: data.realCashData?.safeToSpend?.safeToSpendCents,
      suggestedAporteCents: data.surplusCapacity.suggestedAporteCents,
      allocationIntent: data.surplusCapacity.allocationIntent,
      emergencyMonthsCovered: data.financialContext.lens.wealth.emergencyMonthsCovered,
      emergencyTargetMonths: data.financialContext.lens.wealth.emergencyTargetMonths,
      nextCycleInvoicesCents: data.realCashData?.cycleBreakdown?.nextCycleInvoicesCents ?? 0,
      futureInvoicesCents: data.realCashData?.cycleBreakdown?.futureInvoicesCents ?? 0,
    });
  }, [
    data.surplusCapacity,
    data.isCurrentMonth,
    data.financialContext,
    data.realCashData?.safeToSpend?.committedObligationsCents,
    data.realCashData?.safeToSpend?.safeToSpendCents,
    data.realCashData?.cycleBreakdown?.nextCycleInvoicesCents,
    data.realCashData?.cycleBreakdown?.futureInvoicesCents,
    data.totals?.investmentCents,
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
      {data.showVirginGuide ? (
        <VirginAccountHero
          userName={data.userName}
          selectedFocus={data.initialGoal}
          onSelectFocus={data.setInitialFocus}
          onDismiss={data.dismissVirginGuide}
          onCalibrate={() =>
            guardAction(() => modals.setCheckpointOpen(true), "Calibrar Saldo com o Banco")
          }
          onOpenNewTransaction={() => navigate({ pathname: "/", search: "novo=transacao" })}
          onStartQuickTour={onStartQuickTour}
          onOpenDemo={() => modals.setDemoTrackModalOpen(true)}
          onOpenPreferences={() => modals.setInitialPreferencesOpen(true)}
        />
      ) : (
        <>
          {showPixClipboardBanner && detectedPix ? (
            <div className="w-full animate-fade-slide-in">
              <DashboardPixClipboardCard
                detected={detectedPix}
                onLaunch={modals.handleLaunchPixFromClipboard}
                onDismiss={onDismissDetectedPix}
              />
            </div>
          ) : null}

          <DashboardAlertsCarousel items={alertItems} maxItems={2} isLoading={!isAlertsReady} />

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
            allocationIntent={data.surplusCapacity.allocationIntent}
            suggestedEmergencyAllocationCents={data.surplusCapacity.suggestedEmergencyAllocationCents}
            calculationBreakdown={quickAporteBreakdown}
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
