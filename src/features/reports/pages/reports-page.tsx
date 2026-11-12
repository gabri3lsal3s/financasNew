import { useState, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import { FileSpreadsheet, Landmark, Scale, TrendingUp } from "lucide-react";
import { useDebounce } from "@/hooks";
import { ErrorState, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { resolveEffectiveLimit } from "@/domain/budgets";
import { isCashAssetClass } from "@/domain/portfolio";
import { currentMonth, currentYear } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useUserAccess, useUserPreferences } from "@/state";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import { PortfolioDarfMonitor } from "@/features/investments/components";
import {
  ConsolidatedWealthModal,
  DividendFreedomModal,
  ReportDetailDialog,
  TaxFacilitatorModal,
  FinancialTab,
  InvestmentsTab,
  BalanceTab,
  TaxTab,
  type AggregationTab,
  type PeriodMode,
} from "../components";
import { useReportsData } from "../hooks";
import type { Expense } from "@/types";

const FinancialCloseReportModal = lazy(() =>
  import("../components/financial-close-report-modal").then((m) => ({
    default: m.FinancialCloseReportModal,
  }))
);

const WealthTearSheetModal = lazy(() =>
  import("../components/wealth-tear-sheet-modal").then((m) => ({
    default: m.WealthTearSheetModal,
  }))
);

type MainTab = "financas" | "investimentos" | "balanco" | "fiscal";

/**
 * Central Unificada de Relatórios & Consultoria Patrimonial (§F42).
 * Hub orquestrador com 4 pilares contábeis: Finanças & DRE, Investimentos, Balanço 360° e Fiscal.
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get("aba") as MainTab) || (searchParams.get("tab") as MainTab) || "financas";
  const { hasFeature } = useUserAccess();
  const prefsQuery = useUserPreferences();
  /** Quando false, os pesos de relatório são neutralizados (weight = 1 para todos). */
  const weightsEnabled = prefsQuery.data?.report_weights_enabled ?? true;

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("overview") ||
    hasFeature("budgets") ||
    hasFeature("debts");
  const hasInvestmentsFeature = hasFeature("investments");

  const availableTabs = useMemo(() => {
    const list: MainTab[] = [];
    if (hasFinanceFeatures) list.push("financas");
    if (hasInvestmentsFeature) list.push("investimentos");
    if (hasFinanceFeatures) list.push("balanco");
    if (hasInvestmentsFeature) list.push("fiscal");
    if (list.length === 0) return ["financas", "investimentos", "balanco", "fiscal"] as MainTab[];
    return list;
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  const defaultTab = availableTabs[0] ?? (hasInvestmentsFeature ? "investimentos" : "financas");

  const [selectedTab, setSelectedTab] = useState<MainTab>(() => {
    const validValues = new Set(availableTabs);
    if (validValues.has(activeTabParam)) return activeTabParam;
    return defaultTab;
  });

  const validTabValues = useMemo(() => new Set(availableTabs), [availableTabs]);
  const mainTab: MainTab = validTabValues.has(selectedTab)
    ? selectedTab
    : defaultTab;

  const handleTabChange = (val: string) => {
    const nextTab = val as MainTab;
    setSelectedTab(nextTab);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("aba", nextTab);
      return updated;
    });
  };

  // Filtros de Período da Aba Finanças
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [aggregationTab, setAggregationTab] = useState<AggregationTab>("category");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const debouncedCustomStart = useDebounce(customStart, 350);
  const debouncedCustomEnd = useDebounce(customEnd, 350);
  const [detailModal, setDetailModal] = useState<{
    title: string;
    expenses: Expense[];
  } | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Modais de Dossiê de Consultoria
  const [financialReportOpen, setFinancialReportOpen] = useState(false);
  const [tearSheetOpen, setTearSheetOpen] = useState(false);
  const [dividendFreedomOpen, setDividendFreedomOpen] = useState(false);
  const [consolidatedWealthOpen, setConsolidatedWealthOpen] = useState(false);
  const [taxReportOpen, setTaxReportOpen] = useState(false);
  const [darfMonitorOpen, setDarfMonitorOpen] = useState(false);

  const [expandedTreeClasses, setExpandedTreeClasses] = useState<Set<string>>(() => new Set());
  const [expandedTreeSectors, setExpandedTreeSectors] = useState<Set<string>>(() => new Set());

  const {
    periodLabel,
    loading,
    error,
    expenses,
    expenseEntries,
    incomeEntries,
    byCategory,
    byMethod,
    byWeekday,
    limitsByCategory,
    householdSummary,
    grossExpenseBrutoCents,
    grossIncomeBrutoCents,
    grossSavingsBrutoCents,
    grossSavingsRatePercent,
    currentExpenseCents,
    currentIncomeCents,
    hasDualMetrics,
    consolidatedBalance,
    financialDRE,
    positionRows,
    cashBalanceBRL,
    allocationAnalysis,
    concentrationRisk,
    investmentDonutData,
    freedomAnalysis,
    workbookData,
    excelDescription,
    isExcelDisabled,
    positionQuery,
    refetchAll,
    periodFlowSummary,
    periodRedemptions,
    yearDividendsBRL,
    macroIndicatorsQuery,
    assetsQuery,
    dividends,
    assets,
    usdRate,
    transactions,
    categories,
  } = useReportsData({
    hasFinanceFeatures,
    hasInvestmentsFeature,
    weightsEnabled,
    month,
    year,
    mode,
    debouncedCustomStart,
    debouncedCustomEnd,
    customStart,
    customEnd,
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full min-w-0">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full min-w-0">
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void refetchAll();
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
                mode={mode}
                setMode={setMode}
                month={month}
                setMonth={setMonth}
                year={year}
                setYear={setYear}
                customStart={customStart}
                setCustomStart={setCustomStart}
                customEnd={customEnd}
                setCustomEnd={setCustomEnd}
                grossIncomeBrutoCents={grossIncomeBrutoCents}
                grossExpenseBrutoCents={grossExpenseBrutoCents}
                grossSavingsBrutoCents={grossSavingsBrutoCents}
                grossSavingsRatePercent={grossSavingsRatePercent}
                currentIncomeCents={currentIncomeCents}
                currentExpenseCents={currentExpenseCents}
                hasDualMetrics={hasDualMetrics}
                aggregationTab={aggregationTab}
                setAggregationTab={setAggregationTab}
                byCategory={byCategory}
                byMethod={byMethod}
                byWeekday={byWeekday}
                expenses={expenses}
                onOpenFinancialReport={() => setFinancialReportOpen(true)}
                onShowDetail={(title, expenseList) => setDetailModal({ title, expenses: expenseList })}
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
                totalPatrimonyBRL={positionQuery.totalBRL ?? 0}
                hasDataForPeriod={positionRows.length > 0 || (cashBalanceBRL > 0)}
                rows={positionRows}
                allocationAnalysis={allocationAnalysis}
                concentrationRisk={concentrationRisk}
                classSegments={investmentDonutData.classSegments}
                sectorSegments={investmentDonutData.sectorSegments}
                totalUniqueSectors={investmentDonutData.totalUniqueSectors}
                expandedTreeClasses={expandedTreeClasses}
                setExpandedTreeClasses={setExpandedTreeClasses}
                expandedTreeSectors={expandedTreeSectors}
                setExpandedTreeSectors={setExpandedTreeSectors}
                onOpenTearSheet={() => setTearSheetOpen(true)}
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
                consolidatedBalance={consolidatedBalance}
                freedomAnalysis={freedomAnalysis}
                onOpenConsolidatedWealth={() => setConsolidatedWealthOpen(true)}
                onOpenDividendFreedom={() => setDividendFreedomOpen(true)}
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
                workbookData={workbookData}
                excelDescription={excelDescription}
                onOpenTaxReport={() => setTaxReportOpen(true)}
                onOpenDarfMonitor={() => setDarfMonitorOpen(true)}
                isExcelDisabled={isExcelDisabled}
                excelDisabledReason="Nenhum dado ou lançamento encontrado para o período selecionado."
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0" data-tour="reports-content">
      {/* Header */}
      <PageHeader
        title={!hasFinanceFeatures ? "Relatórios de Investimentos" : "Relatórios"}
        description={
          !hasFinanceFeatures
            ? "Dossiês executivos da carteira, proventos, evolução patrimonial e inteligência fiscal"
            : "Dossiês executivos, DRE pessoal, consolidação patrimonial e inteligência fiscal"
        }
      />

      {/* Navegação Principal em Tabs com suporte a gestos swipe e acessibilidade */}
      <Tabs
        value={mainTab}
        onValueChange={handleTabChange}
        swipeable
        items={tabItems}
      />

      {/* Modais de Dossiês de Consultoria */}
      {financialReportOpen && (
        <Suspense fallback={null}>
          <FinancialCloseReportModal
            open={financialReportOpen}
            onOpenChange={setFinancialReportOpen}
            periodLabel={periodLabel}
            dre={financialDRE}
            categories={byCategory.map((c) => {
              const targetMonth = mode === "month" ? month : null;
              const limitCents = targetMonth
                ? resolveEffectiveLimit(limitsByCategory.get(c.categoryId) ?? [], targetMonth)
                : 0;
              const variancePct =
                limitCents > 0
                  ? Math.round(((c.brutoCents - limitCents) / limitCents) * 100)
                  : null;

              return {
                name: c.name,
                brutoCents: c.brutoCents,
                ponderadoCents: c.ponderadoCents,
                totalCents: c.brutoCents,
                pct: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
                budgetLimitCents: limitCents > 0 ? limitCents : null,
                variancePct,
              };
            })}
            paymentMethods={byMethod.map((m) => ({
              method: m.method,
              label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
              brutoCents: m.brutoCents,
              ponderadoCents: m.ponderadoCents,
              totalCents: m.brutoCents,
              pct: grossExpenseBrutoCents > 0 ? (m.brutoCents / grossExpenseBrutoCents) * 100 : 0,
            }))}
            expenseCount={expenseEntries.length}
            incomeCount={incomeEntries.length}
            showWeightedNote={weightsEnabled}
            householdSummary={householdSummary}
          />
        </Suspense>
      )}

      {tearSheetOpen && (
        <Suspense fallback={null}>
          <WealthTearSheetModal
            open={tearSheetOpen}
            onOpenChange={setTearSheetOpen}
            periodLabel="Posição Atual Consolidada"
            rows={positionRows.map((r) => {
              const effectiveDivs = r.currency === "USD" ? (r.dividendsNative ?? (r.usdRate && r.usdRate > 0 ? (r.dividends ?? 0) / r.usdRate : (r.dividends ?? 0))) : (r.dividends ?? 0);
              const effectiveCostNative = (r.currency === "USD" ? (r.totalCost ?? (r.usdRate && r.usdRate > 0 && r.totalCostBRL ? r.totalCostBRL / r.usdRate : r.totalCostBRL)) : r.totalCostBRL) ?? 0;
              const effectiveCostBRL = (r.currency === "USD" ? (r.totalCostBRL ?? (r.usdRate && r.usdRate > 0 && r.totalCost ? r.totalCost * r.usdRate : r.totalCost)) : r.totalCostBRL) ?? (r.valueBRL - (r.unrealizedPnl ?? 0));
              const yoc = effectiveCostNative > 0 && effectiveDivs > 0 ? (effectiveDivs / effectiveCostNative) * 100 : 0;
              return {
                ticker: r.ticker,
                name: r.ticker,
                assetClass: r.assetClass ?? "outros",
                sector: r.sector,
                currency: r.currency ?? "BRL",
                quantity: r.quantity,
                averagePrice: r.averageCost,
                currentPrice: r.priceQuote ?? r.priceBRL,
                valueBRL: r.valueBRL,
                totalCostBRL: effectiveCostBRL,
                unrealizedPnlBRL: r.unrealizedPnl,
                unrealizedPnlPct: r.unrealizedPct ?? 0,
                totalReturnPnlBRL: r.totalReturnPnl,
                totalReturnPct: r.totalReturnPct ?? (r.unrealizedPct ?? 0),
                dividendsBRL: r.dividends ?? 0,
                yearDividendsBRL: r.dividends ?? 0,
                yocPct: yoc,
                isCash: isCashAssetClass(r.assetClass),
              };
            })}
            totalBRL={positionQuery.totalBRL ?? 0}
            totalCostBRL={positionQuery.totalCostBRL ?? 0}
            totalDividendsBRL={positionQuery.totalDividendsBRL ?? 0}
            totalReturnPnlBRL={positionQuery.totalReturnPnlBRL}
            totalReturnPct={positionQuery.totalReturnPct}
            unrealizedPnlBRL={positionQuery.unrealizedPnlBRL}
            unrealizedPnlPct={positionQuery.unrealizedPct}
            periodRedemptions={periodRedemptions}
            cashBRL={cashBalanceBRL}
            yearDividendsBRL={yearDividendsBRL}
            monthSummary={periodFlowSummary}
            allocationAnalysis={allocationAnalysis}
            concentrationRisk={concentrationRisk}
            portfolioIrr={positionQuery.portfolioIrr}
            portfolioTwr={positionQuery.portfolioTwr}
            monthlySeries={positionQuery.monthlySeries}
            allTimeEconomicPnlBRL={positionQuery.allTimeEconomicPnlBRL}
            realizedPnlBRL={positionQuery.realizedPnlBRL}
            annualCdiRate={macroIndicatorsQuery.data?.annualCdiRate}
            annualSelicRate={macroIndicatorsQuery.data?.annualSelicRate}
            annualIpcaRate={macroIndicatorsQuery.data?.annualIpcaRate}
            ibovPeriodReturnPct={macroIndicatorsQuery.data?.ibovPeriodReturnPct}
            assetsMetadata={assetsQuery.data ?? []}
          />
        </Suspense>
      )}

      <DividendFreedomModal
        open={dividendFreedomOpen}
        onOpenChange={setDividendFreedomOpen}
        periodLabel={periodLabel}
        freedomAnalysis={freedomAnalysis}
        dividends={dividends}
        yearDividendsBRL={yearDividendsBRL}
        assets={assets}
        usdRate={usdRate}
      />

      <ConsolidatedWealthModal
        open={consolidatedWealthOpen}
        onOpenChange={setConsolidatedWealthOpen}
        periodLabel={periodLabel}
        balanceSheet={consolidatedBalance}
      />

      <TaxFacilitatorModal
        open={taxReportOpen}
        onOpenChange={setTaxReportOpen}
        assets={assets}
        dividends={dividends}
        usdRate={usdRate}
      />

      <PortfolioDarfMonitor
        open={darfMonitorOpen}
        onOpenChange={setDarfMonitorOpen}
        assets={assets}
        transactions={transactions}
      />

      {/* Detalhe de Lançamento ao clicar nas tabelas de finanças */}
      {selectedExpense ? (
        <ExpenseDetailDialog
          expense={selectedExpense}
          open={Boolean(selectedExpense)}
          onOpenChange={(op) => !op && setSelectedExpense(null)}
        />
      ) : null}

      {detailModal ? (
        <ReportDetailDialog
          open={Boolean(detailModal)}
          onOpenChange={(op) => !op && setDetailModal(null)}
          title={detailModal.title}
          expenses={detailModal.expenses}
          categories={categories}
          onSelectExpense={setSelectedExpense}
        />
      ) : null}
    </div>
  );
}
