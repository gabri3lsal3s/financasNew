import { FileSpreadsheet, Landmark, Scale, TrendingUp } from "lucide-react";
import { ErrorState, ReportsSkeleton, Tabs, type TabItem } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { getErrorMessage } from "@/services/errors";
import { useUserAccess, useUserPreferences } from "@/state";
import {
  BalanceTab,
  FinancialTab,
  InvestmentsTab,
  ReportsModalsHost,
  TaxTab,
} from "../components";
import { useReportModalsState, useReportsData } from "../hooks";

/**
 * Central Unificada de Relatórios & Consultoria Patrimonial (§F42).
 * Hub orquestrador com 4 pilares contábeis: Finanças & DRE, Investimentos, Balanço 360° e Fiscal.
 */
export function ReportsPage() {
  const { hasFeature } = useUserAccess();
  const prefsQuery = useUserPreferences();
  const weightsEnabled = prefsQuery.data?.report_weights_enabled ?? true;

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("overview") ||
    hasFeature("budgets") ||
    hasFeature("debts");
  const hasInvestmentsFeature = hasFeature("investments");

  const state = useReportModalsState({
    hasFinanceFeatures,
    hasInvestmentsFeature,
  });

  const data = useReportsData({
    hasFinanceFeatures,
    hasInvestmentsFeature,
    weightsEnabled,
    month: state.month,
    year: state.year,
    mode: state.mode,
    debouncedCustomStart: state.debouncedCustomStart,
    debouncedCustomEnd: state.debouncedCustomEnd,
    customStart: state.customStart,
    customEnd: state.customEnd,
    activeTab: state.mainTab,
  });

  if (data.loading) {
    return <ReportsSkeleton />;
  }

  if (data.error) {
    return (
      <div className="flex flex-col gap-6 w-full min-w-0">
        <ErrorState
          message={getErrorMessage(data.error)}
          onRetry={() => {
            void data.refetchAll();
          }}
        />
      </div>
    );
  }

  const tabItems: TabItem[] = [
    ...(hasFinanceFeatures
      ? [
          {
            value: "financas",
            label: "Finanças & DRE",
            shortLabel: "Finanças",
            icon: <Landmark className="size-4" aria-hidden="true" />,
            content: (
              <FinancialTab
                mode={state.mode}
                setMode={state.setMode}
                month={state.month}
                setMonth={state.setMonth}
                year={state.year}
                setYear={state.setYear}
                customStart={state.customStart}
                setCustomStart={state.setCustomStart}
                customEnd={state.customEnd}
                setCustomEnd={state.setCustomEnd}
                grossIncomeBrutoCents={data.grossIncomeBrutoCents}
                grossExpenseBrutoCents={data.grossExpenseBrutoCents}
                grossSavingsBrutoCents={data.grossSavingsBrutoCents}
                grossSavingsRatePercent={data.grossSavingsRatePercent}
                currentIncomeCents={data.currentIncomeCents}
                currentExpenseCents={data.currentExpenseCents}
                hasDualMetrics={data.hasDualMetrics}
                aggregationTab={state.aggregationTab}
                setAggregationTab={state.setAggregationTab}
                byCategory={data.byCategory}
                byMethod={data.byMethod}
                byWeekday={data.byWeekday}
                byChargeKind={data.byChargeKind}
                expenses={data.expenses}
                onOpenFinancialReport={() => state.setFinancialReportOpen(true)}
                onShowDetail={(title, expenseList) => state.setDetailModal({ title, expenses: expenseList })}
              />
            ),
          },
        ]
      : []),
    ...(hasInvestmentsFeature
      ? [
          {
            value: "investimentos",
            label: "Investimentos & Carteira",
            shortLabel: "Investimentos",
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            content: (
              <InvestmentsTab
                totalPatrimonyBRL={data.positionQuery.totalBRL ?? 0}
                hasDataForPeriod={data.positionRows.length > 0 || data.cashBalanceBRL > 0}
                rows={data.positionRows}
                allocationAnalysis={data.allocationAnalysis}
                concentrationRisk={data.concentrationRisk}
                classSegments={data.investmentDonutData.classSegments}
                sectorSegments={data.investmentDonutData.sectorSegments}
                totalUniqueSectors={data.investmentDonutData.totalUniqueSectors}
                expandedTreeClasses={state.expandedTreeClasses}
                setExpandedTreeClasses={state.setExpandedTreeClasses}
                expandedTreeSectors={state.expandedTreeSectors}
                setExpandedTreeSectors={state.setExpandedTreeSectors}
                onOpenTearSheet={() => state.setTearSheetOpen(true)}
              />
            ),
          },
        ]
      : []),
    ...(hasFinanceFeatures
      ? [
          {
            value: "balanco",
            label: "Balanço & Liberdade",
            shortLabel: "Balanço",
            icon: <Scale className="size-4" aria-hidden="true" />,
            content: (
              <BalanceTab
                consolidatedBalance={data.consolidatedBalance}
                freedomAnalysis={data.freedomAnalysis}
                onOpenConsolidatedWealth={() => state.setConsolidatedWealthOpen(true)}
                onOpenDividendFreedom={() => state.setDividendFreedomOpen(true)}
              />
            ),
          },
        ]
      : []),
    ...(hasInvestmentsFeature
      ? [
          {
            value: "fiscal",
            label: "Fiscal & Declaração",
            shortLabel: "Fiscal",
            icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
            content: (
              <TaxTab
                buildWorkbookData={data.buildWorkbookData}
                excelDescription={data.excelDescription}
                onOpenTaxReport={() => state.setTaxReportOpen(true)}
                onOpenDarfMonitor={() => state.setDarfMonitorOpen(true)}
                isExcelDisabled={data.isExcelDisabled}
                excelDisabledReason="Nenhum dado ou lançamento encontrado para o período selecionado."
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0" data-tour="reports-content">
      <PageHeader
        title={!hasFinanceFeatures ? "Relatórios de Investimentos" : "Relatórios"}
        description={
          !hasFinanceFeatures
            ? "Resumo da carteira, proventos e imposto de renda"
            : "Resumo mensal, patrimônio e imposto de renda"
        }
      />

      <Tabs
        value={state.mainTab}
        onValueChange={state.handleTabChange}
        swipeable
        items={tabItems}
      />

      <ReportsModalsHost
        weightsEnabled={weightsEnabled}
        state={state}
        data={data}
      />
    </div>
  );
}
