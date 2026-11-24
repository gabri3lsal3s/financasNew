import { useState } from "react";
import { useSearchParams } from "react-router";
import { Activity, LineChart, Repeat } from "lucide-react";
import { Badge, ErrorState, Tabs, type TabItem } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { EmergencyFundConfigDialog } from "@/components/modules";
import { normalizeText } from "@/domain/insights";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { DiagnosticsTab, MonthlyClosingCard, ProjectionTab, RecurrencesTab } from "../components";
import { InsightsLoadingSkeleton } from "../components/InsightsLoadingSkeleton";
import { useInsightsDashboardData } from "../hooks/use-insights-dashboard-data";

export type InsightFilter = "diagnostics" | "recurrences" | "occurrences" | "projection" | "all";
type ActiveTab = "diagnostics" | "recurrences" | "projection";

function resolveTab(val: string | null | undefined): ActiveTab {
  if (val === "recurrences" || val === "occurrences") return "recurrences";
  if (val === "projection" || val === "planning") return "projection";
  return "diagnostics";
}

function useOptionalSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return [null, null] as const;
  }
}

/**
 * Insights (§3.7) — Central Modular de Inteligência Financeira.
 */
export function InsightsPage({
  showHeader = true,
  initialFilter = "diagnostics",
}: {
  showHeader?: boolean;
  initialFilter?: InsightFilter;
} = {}) {
  const [searchParams, setSearchParams] = useOptionalSearchParams();
  const rawTab = searchParams?.get("aba") ?? searchParams?.get("tab");

  const [filter, setFilter] = useState<ActiveTab>(() =>
    rawTab ? resolveTab(rawTab) : resolveTab(initialFilter),
  );
  const effectiveFilter = rawTab ? resolveTab(rawTab) : filter;
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState(false);
  const [isEmergencyConfigOpen, setIsEmergencyConfigOpen] = useState(false);

  const {
    month,
    loading,
    error,
    dashboard,
    feedbackMap,
    cards,
    emergencyFund,
    realCashCents,
    handleFeedback,
    monthlyClosing,
    dismissMonthlyClosing,
    applyMonthlyClosingLimit,
    unmuteFamily,
    forgetMerchant,
    merchantLearning,
  } = useInsightsDashboardData();

  const handleFilterChange = (nextValue: string) => {
    const nextFilter = resolveTab(nextValue);
    setFilter(nextFilter);
    if (searchParams && setSearchParams) {
      const nextParams = new URLSearchParams(searchParams);
      if (nextFilter === "diagnostics") {
        nextParams.delete("aba");
      } else {
        nextParams.set("aba", nextFilter);
      }
      setSearchParams(nextParams, { replace: true });
    }
  };

  const tabItems: TabItem[] = [
    {
      value: "diagnostics",
      label: "Diagnósticos",
      icon: <Activity className="size-3.5" aria-hidden="true" />,
      content: loading ? (
        <InsightsLoadingSkeleton />
      ) : (
        <DiagnosticsTab
          warnings={dashboard.warnings}
          expandedWarnings={expandedWarnings}
          setExpandedWarnings={setExpandedWarnings}
          health={dashboard.health}
          savingsRate={dashboard.effectiveSavingsRateForHealth}
          concentration={dashboard.concentration}
          weekendComparable={dashboard.weekendComparable}
          weekendRatio={dashboard.weekendRatio}
          trendHasPreviousBase={dashboard.trendHasPreviousBase}
          trendSignificant={dashboard.trendSignificant}
          trendPercent={dashboard.trendPercent}
          overspentBudgets={dashboard.overspentBudgets}
          essentialSpending={dashboard.essentialSpending}
          hasTransactions={dashboard.hasTransactions}
          hasIncome={dashboard.hasIncome}
        />
      ),
    },
    {
      value: "recurrences",
      label: "Recorrências",
      icon: <Repeat className="size-3.5" aria-hidden="true" />,
      content: loading ? (
        <InsightsLoadingSkeleton />
      ) : (
        <RecurrencesTab
          totalRecurringCents={dashboard.totalRecurringCents}
          totalAnnualRecurringCents={dashboard.totalAnnualRecurringCents}
          canCutRecurringCents={dashboard.canCutRecurringCents}
          canCutAnnualCents={dashboard.canCutAnnualCents}
          activeOccurrences={dashboard.activeOccurrences}
          ignoredOccurrences={dashboard.ignoredOccurrences}
          lapsedOccurrences={dashboard.lapsedOccurrences}
          feedbackMap={feedbackMap}
          showIgnored={showIgnored}
          setShowIgnored={setShowIgnored}
          onFeedback={handleFeedback}
          cards={cards}
          initialSelectedKey={searchParams?.get("item") || undefined}
          monthlyIncomeCents={dashboard.incomeCents}
          paydayProfile={dashboard.paydayProfile}
          decayByFamily={dashboard.decayByFamily}
          onUnmuteFamily={unmuteFamily}
          merchantLearning={merchantLearning}
          onForgetMerchant={forgetMerchant}
        />
      ),
    },
    {
      value: "projection",
      label: "Projeção",
      icon: <LineChart className="size-3.5" aria-hidden="true" />,
      content: loading ? (
        <InsightsLoadingSkeleton />
      ) : (
        <ProjectionTab
          dailyCents={dashboard.dailyCents}
          projectedExpensesCents={dashboard.projectedExpensesCents}
          surplusCents={dashboard.surplusCents}
          onTrack={dashboard.onTrack}
          spentPercent={dashboard.spentPercent}
          elapsedPercent={dashboard.elapsedPercent}
          paceActive={dashboard.paceActive}
          paceBreakdown={dashboard.paceBreakdown}
          pendingSummary={dashboard.pendingSummary}
          challenges={dashboard.challenges}
          showDiscretionary={dashboard.showDiscretionary}
          discretionary={dashboard.discretionary}
          balanceCents={dashboard.balanceCents}
          monthlyExpensesCents={dashboard.expenseCents}
          liquidReserveCents={dashboard.detectedReserveCents}
          baselineMonthlyExpensesCents={dashboard.baselineMonthlyExpensesCents}
          monthlySavingsVelocityCents={Math.max(0, dashboard.balanceCents)}
          referenceMonth={month}
          composition={emergencyFund.composition}
          onOpenEmergencyConfig={() => setIsEmergencyConfigOpen(true)}
          hasIncome={dashboard.hasIncome}
          onApplyChallenge={applyMonthlyClosingLimit}
          onMarkCategoryEssential={(_categoryId, categoryName) => {
            handleFeedback(`category:${normalizeText(categoryName)}`, "essential");
            pushToast({
              title: "Categoria marcada como essencial",
              description: `${categoryName} não receberá sugestões de corte e pode ser revertida na Memória do Copiloto.`,
              variant: "success",
            });
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {showHeader ? (
        <PageHeader
          title="Insights"
          description="Diagnósticos, recorrências e projeções"
          badge={
            <Badge variant="muted" size="sm">
              {monthLabel(month)}
            </Badge>
          }
        />
      ) : null}

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {!loading && monthlyClosing ? (
        <MonthlyClosingCard
          summary={monthlyClosing}
          onDismiss={dismissMonthlyClosing}
          onApplyLimit={applyMonthlyClosingLimit}
        />
      ) : null}

      <Tabs
        value={effectiveFilter}
        onValueChange={handleFilterChange}
        items={tabItems}
        variant="pills"
        fullWidth={false}
        ariaLabel="Filtro de seções de insights"
        className="w-full"
      />

      <EmergencyFundConfigDialog
        open={isEmergencyConfigOpen}
        onOpenChange={setIsEmergencyConfigOpen}
        config={emergencyFund.config}
        onSave={emergencyFund.updateConfig}
        realCashCents={realCashCents}
        portfolioRows={emergencyFund.portfolioRows}
        monthlyExpensesCents={dashboard.baselineMonthlyExpensesCents}
      />
    </div>
  );
}
