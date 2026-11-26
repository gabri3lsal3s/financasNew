import { ContentLoading } from "@/components/ui/content-loading";
import { lazy, Suspense, useMemo } from "react";
import { resolveEffectiveLimit } from "@/domain/budgets";
import { useCorporateDividends } from "@/state/queries/use-corporate-dividends";
import { useUserAccess } from "@/state/queries/use-user-access";
import {
  evaluateBalancoReadiness,
  evaluateDossiePosicaoReadiness,
  evaluateDreReadiness,
  evaluateFireReadiness,
  evaluateIrpfReadiness,
  mapCategoriesForCloseReport,
  mapPaymentMethodsForCloseReport,
  mapPositionRowsToWealthRows,
} from "@/domain/reports";
import { ReportInsufficientDataModal } from "@/components/modules/reports";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import { PortfolioDarfMonitor } from "@/features/investments/components";
import type { useReportModalsState, useReportsData } from "../hooks";
const ConsolidatedWealthModal = lazy(() => import("./consolidated-wealth-modal").then((module) => ({ default: module.ConsolidatedWealthModal })));
const DividendFreedomModal = lazy(() => import("./dividend-freedom-modal").then((module) => ({ default: module.DividendFreedomModal })));
import { ReportDetailDialog } from "./report-detail-dialog";
const TaxFacilitatorModal = lazy(() => import("./tax-facilitator-modal").then((module) => ({ default: module.TaxFacilitatorModal })));

const FinancialCloseReportModal = lazy(() =>
  import("./financial-close-report-modal").then((m) => ({
    default: m.FinancialCloseReportModal,
  })),
);

const WealthTearSheetModal = lazy(() =>
  import("./wealth-tear-sheet-modal").then((m) => ({
    default: m.WealthTearSheetModal,
  })),
);

export interface ReportsModalsHostProps {
  weightsEnabled: boolean;
  state: ReturnType<typeof useReportModalsState>;
  data: ReturnType<typeof useReportsData>;
}

/**
 * Orquestrador dos modais executivos A4, DARF e drilldown de lançamentos da Central de Relatórios.
 */
export function ReportsModalsHost({ weightsEnabled, state, data }: ReportsModalsHostProps) {
  const corporateDividendsState = useCorporateDividends({ enabled: state.tearSheetOpen });
  const userAccess = useUserAccess();
  const accountHolder = userAccess?.profile?.name ?? undefined;
  // 1. DRE Pessoal
  const dreReadiness = useMemo(
    () =>
      evaluateDreReadiness({
        grossIncomeCents: data.financialDRE?.grossIncomeCents ?? 0,
        totalExpensesCents: data.financialDRE?.totalExpensesCents ?? 0,
        operationalSavingsCents: data.financialDRE?.operationalSavingsCents ?? 0,
        incomeCount: data.incomeEntries.length,
        expenseCount: data.expenseEntries.length,
        hasWeightedDiscrepancy: weightsEnabled,
        hasHousehold: Boolean(data.householdSummary),
      }),
    [
      data.financialDRE?.grossIncomeCents,
      data.financialDRE?.totalExpensesCents,
      data.financialDRE?.operationalSavingsCents,
      data.incomeEntries.length,
      data.expenseEntries.length,
      weightsEnabled,
      data.householdSummary,
    ],
  );

  // 2. Balanço Patrimonial 360°
  const balancoReadiness = useMemo(() => {
    const totalAssets = data.consolidatedBalance?.totalAssetsBRL ?? 0;
    const totalLiabilities = data.consolidatedBalance?.totalLiabilitiesBRL ?? 0;
    const dre = data.consolidatedBalance?.dre;
    const hasDre = Boolean(
      dre && (dre.grossIncomeBRL > 0 || dre.totalExpensesBRL > 0 || dre.investedAporteBRL > 0),
    );
    const assetComponents = [
      data.consolidatedBalance?.totalInvestmentsBRL,
      data.consolidatedBalance?.cashBalanceBRL,
      data.consolidatedBalance?.receivablesBRL,
    ].filter((v) => (v ?? 0) > 0).length;

    return evaluateBalancoReadiness({
      totalAssetsBRL: totalAssets,
      totalLiabilitiesBRL: totalLiabilities,
      hasDreActivity: hasDre,
      assetComponentCount: assetComponents,
    });
  }, [data.consolidatedBalance]);

  // 3. Facilitador IRPF
  const irpfReadiness = useMemo(
    () =>
      evaluateIrpfReadiness({
        yearEndAssetCount: data.assets?.length ?? 0,
        taxIncomeCount: data.dividends?.length ?? 0,
        taxIncomeTotalBRL: data.yearDividendsBRL ?? 0,
      }),
    [data.assets?.length, data.dividends?.length, data.yearDividendsBRL],
  );

  // 4. Dossiê FIRE
  const fireReadiness = useMemo(
    () =>
      evaluateFireReadiness({
        dividends12mCount: data.dividends?.length ?? 0,
        totalDividends12mBRL: data.yearDividendsBRL ?? 0,
        passiveIncomeAssetCount: data.assets?.length ?? 0,
        hasCostOfLiving: (data.freedomAnalysis?.monthlyExpensesBRL ?? 0) > 0,
        eligibleSnowballAssetCount: data.freedomAnalysis?.totalSnowballAssetsCount ?? 0,
      }),
    [
      data.dividends?.length,
      data.yearDividendsBRL,
      data.assets?.length,
      data.freedomAnalysis?.monthlyExpensesBRL,
      data.freedomAnalysis?.totalSnowballAssetsCount,
    ],
  );

  // 6. Dossiê Posição Vigente (sempre reflete a custódia viva consolidada)
  const livePositionRows = data.positionQuery.rows ?? data.positionRows;
  const tearSheetRows = useMemo(
    () => mapPositionRowsToWealthRows(livePositionRows),
    [livePositionRows],
  );

  const tearSheetReadiness = useMemo(() => {
    const hasTargets =
      data.allocationAnalysis.totalTargetPct > 0 ||
      data.allocationAnalysis.classGaps.some((c) => c.targetPct > 0);
    const activeClassCount = data.allocationAnalysis.classGaps.filter((c) => c.currentBRL > 0).length;
    const validSectorCount = (data.allocationAnalysis.sectorGaps ?? []).filter((s) => s.currentBRL > 0).length;
    const acoes = livePositionRows.some(
      (r) => r.assetClass?.toLowerCase().includes("ações") || r.assetClass?.toLowerCase().includes("stock"),
    );
    const fiis = livePositionRows.some(
      (r) => r.assetClass?.toLowerCase().includes("imobiliário") || r.assetClass?.toLowerCase().includes("fii"),
    );
    const rendaFixa = livePositionRows.some(
      (r) => r.assetClass?.toLowerCase().includes("renda fixa") || r.assetClass?.toLowerCase().includes("fixed"),
    );
    const internacional = livePositionRows.some(
      (r) => r.assetClass?.toLowerCase().includes("internacional") || r.currency === "USD",
    );

    return evaluateDossiePosicaoReadiness({
      activeAssetCount: livePositionRows.length,
      totalBRL: data.positionQuery.totalBRL ?? 0,
      cashBRL: data.positionQuery.cashBRL ?? data.cashBalanceBRL ?? 0,
      hasAllocationTargets: hasTargets,
      activeClassCount,
      validSectorCount,
      eligibleClasses: { acoes, fiis, rendaFixa, internacional },
      monthlyHistoryCount: data.positionQuery.monthlySeries?.length ?? 0,
      hasSharpeAndRisk: Boolean(data.positionQuery.portfolioIrr != null || data.positionQuery.portfolioTwr != null),
    });
  }, [
    data.allocationAnalysis.totalTargetPct,
    data.allocationAnalysis.classGaps,
    data.allocationAnalysis.sectorGaps,
    livePositionRows,
    data.positionQuery.totalBRL,
    data.positionQuery.cashBRL,
    data.cashBalanceBRL,
    data.positionQuery.monthlySeries?.length,
    data.positionQuery.portfolioIrr,
    data.positionQuery.portfolioTwr,
  ]);

  return (
    <Suspense fallback={<ContentLoading />}>
      {state.financialReportOpen && dreReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={state.financialReportOpen}
          onOpenChange={state.setFinancialReportOpen}
          reportTitle="DRE Pessoal & Fechamento Financeiro"
          periodLabel={data.periodLabel}
          blockingReasons={dreReadiness.blockingReasons}
        />
      )}
      {state.financialReportOpen && dreReadiness.canGenerate && (
        <Suspense fallback={<ContentLoading />}>
          <FinancialCloseReportModal
            open={state.financialReportOpen}
            onOpenChange={state.setFinancialReportOpen}
            periodLabel={data.periodLabel}
            accountHolder={accountHolder}
            dre={data.financialDRE}
            categories={mapCategoriesForCloseReport({
              byCategory: data.byCategory,
              grossExpenseBrutoCents: data.grossExpenseBrutoCents,
              targetMonth: state.mode === "month" ? state.month : null,
              resolveCategoryLimit: (catId, targetMonth) =>
                resolveEffectiveLimit(data.limitsByCategory.get(catId) ?? [], targetMonth),
            })}
            paymentMethods={mapPaymentMethodsForCloseReport({
              byMethod: data.byMethod,
              grossExpenseBrutoCents: data.grossExpenseBrutoCents,
              resolveMethodLabel: (method) =>
                PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method,
            })}
            expenseCount={data.expenseEntries.length}
            incomeCount={data.incomeEntries.length}
            showWeightedNote={weightsEnabled}
            householdSummary={data.householdSummary}
            readiness={dreReadiness}
            businessDre={data.businessDreForExcel}
          />
        </Suspense>
      )}

      {state.tearSheetOpen && tearSheetReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={state.tearSheetOpen}
          onOpenChange={state.setTearSheetOpen}
          reportTitle="Dossiê Executivo da Posição Vigente"
          periodLabel="Posição Atual Consolidada"
          blockingReasons={tearSheetReadiness.blockingReasons}
        />
      )}
      {state.tearSheetOpen && tearSheetReadiness.canGenerate && (
        <Suspense fallback={<ContentLoading />}>
          <WealthTearSheetModal
            open={state.tearSheetOpen}
            onOpenChange={state.setTearSheetOpen}
            periodLabel="Posição Atual Consolidada"
            accountHolder={accountHolder}
            isCurrentPeriod={true}
            rows={tearSheetRows}
            totalBRL={data.positionQuery.totalBRL ?? 0}
            totalCostBRL={data.positionQuery.totalCostBRL ?? 0}
            assetsCostBRL={data.positionQuery.assetsTotalCostBRL}
            totalAppliedCostBRL={data.positionQuery.totalAppliedCostBRL}
            totalDividendsBRL={data.positionQuery.totalDividendsBRL ?? 0}
            totalReturnPnlBRL={data.positionQuery.totalReturnPnlBRL}
            totalReturnPct={data.positionQuery.totalReturnPct}
            unrealizedPnlBRL={data.positionQuery.unrealizedPnlBRL}
            unrealizedPnlPct={data.positionQuery.unrealizedPct}
            periodRedemptions={data.periodRedemptions}
            cashBRL={data.positionQuery.cashBRL ?? data.cashBalanceBRL}
            yearDividendsBRL={data.yearDividendsBRL}
            monthSummary={data.periodFlowSummary}
            allocationAnalysis={data.allocationAnalysis}
            concentrationRisk={data.concentrationRisk}
            portfolioIrr={data.positionQuery.portfolioIrr}
            portfolioTwr={data.positionQuery.portfolioTwr}
            monthlySeries={data.positionQuery.monthlySeries}
            allTimeEconomicPnlBRL={data.positionQuery.allTimeEconomicPnlBRL}
            realizedPnlBRL={data.positionQuery.realizedPnlBRL}
            annualCdiRate={data.macroIndicatorsQuery.data?.annualCdiRate}
            annualSelicRate={data.macroIndicatorsQuery.data?.annualSelicRate}
            annualIpcaRate={data.macroIndicatorsQuery.data?.annualIpcaRate}
            ibovPeriodReturnPct={data.macroIndicatorsQuery.data?.ibovPeriodReturnPct}
            assetsMetadata={data.assetsQuery.data ?? []}
            usdRate={data.positionQuery.usdRate ?? data.usdRate}
            fxMetadata={data.positionQuery.fxMetadata ?? data.fxMetadata}
            provisionedSummary={corporateDividendsState?.provisionedSummary ?? null}
            transactions={data.transactions}
            readiness={tearSheetReadiness}
          />
        </Suspense>
      )}

      {state.dividendFreedomOpen && fireReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={state.dividendFreedomOpen}
          onOpenChange={state.setDividendFreedomOpen}
          reportTitle="Dossiê de Proventos & Liberdade Financeira"
          periodLabel={data.periodLabel}
          blockingReasons={fireReadiness.blockingReasons}
        />
      )}
      {state.dividendFreedomOpen && fireReadiness.canGenerate && (
        <DividendFreedomModal
          open={state.dividendFreedomOpen}
          onOpenChange={state.setDividendFreedomOpen}
          periodLabel={data.periodLabel}
          accountHolder={accountHolder}
          freedomAnalysis={data.freedomAnalysis}
          dividends={data.dividends}
          yearDividendsBRL={data.yearDividendsBRL}
          assets={data.assets}
          usdRate={data.usdRate}
          readiness={fireReadiness}
        />
      )}

      {state.consolidatedWealthOpen && balancoReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={state.consolidatedWealthOpen}
          onOpenChange={state.setConsolidatedWealthOpen}
          reportTitle="Balanço Patrimonial 360°"
          periodLabel={data.periodLabel}
          blockingReasons={balancoReadiness.blockingReasons}
        />
      )}
      {state.consolidatedWealthOpen && balancoReadiness.canGenerate && (
        <ConsolidatedWealthModal
          open={state.consolidatedWealthOpen}
          onOpenChange={state.setConsolidatedWealthOpen}
          periodLabel={data.periodLabel}
          accountHolder={accountHolder}
          balanceSheet={data.consolidatedBalance}
          readiness={balancoReadiness}
        />
      )}

      {state.taxReportOpen && irpfReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={state.taxReportOpen}
          onOpenChange={state.setTaxReportOpen}
          reportTitle="Facilitador IRPF"
          periodLabel="Exercício Anual"
          blockingReasons={irpfReadiness.blockingReasons}
        />
      )}
      {state.taxReportOpen && irpfReadiness.canGenerate && (
        <TaxFacilitatorModal
          open={state.taxReportOpen}
          onOpenChange={state.setTaxReportOpen}
          accountHolder={accountHolder}
          assets={data.assets}
          dividends={data.dividends}
          usdRate={data.usdRate}
          readiness={irpfReadiness}
        />
      )}

      <PortfolioDarfMonitor
        open={state.darfMonitorOpen}
        onOpenChange={state.setDarfMonitorOpen}
        assets={data.assets}
        transactions={data.transactions}
      />

      {state.selectedExpense ? (
        <ExpenseDetailDialog
          expense={state.selectedExpense}
          open={Boolean(state.selectedExpense)}
          onOpenChange={(op) => !op && state.setSelectedExpense(null)}
        />
      ) : null}

      {state.detailModal ? (
        <ReportDetailDialog
          open={Boolean(state.detailModal)}
          onOpenChange={(op) => !op && state.setDetailModal(null)}
          title={state.detailModal.title}
          expenses={state.detailModal.expenses}
          categories={data.categories}
          onSelectExpense={state.setSelectedExpense}
        />
      ) : null}
    </Suspense>
  );
}
