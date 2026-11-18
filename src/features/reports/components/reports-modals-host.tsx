import { lazy, Suspense } from "react";
import { resolveEffectiveLimit } from "@/domain/budgets";
import {
  mapCategoriesForCloseReport,
  mapPaymentMethodsForCloseReport,
  mapPositionRowsToWealthRows,
} from "@/domain/reports";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import { PortfolioDarfMonitor } from "@/features/investments/components";
import type { useReportModalsState, useReportsData } from "../hooks";
import { ConsolidatedWealthModal } from "./consolidated-wealth-modal";
import { DividendFreedomModal } from "./dividend-freedom-modal";
import { ReportDetailDialog } from "./report-detail-dialog";
import { TaxFacilitatorModal } from "./tax-facilitator-modal";

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
  return (
    <>
      {state.financialReportOpen && (
        <Suspense fallback={null}>
          <FinancialCloseReportModal
            open={state.financialReportOpen}
            onOpenChange={state.setFinancialReportOpen}
            periodLabel={data.periodLabel}
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
          />
        </Suspense>
      )}

      {state.tearSheetOpen && (
        <Suspense fallback={null}>
          <WealthTearSheetModal
            open={state.tearSheetOpen}
            onOpenChange={state.setTearSheetOpen}
            periodLabel="Posição Atual Consolidada"
            rows={mapPositionRowsToWealthRows(data.positionRows)}
            totalBRL={data.positionQuery.totalBRL ?? 0}
            totalCostBRL={data.positionQuery.totalCostBRL ?? 0}
            totalDividendsBRL={data.positionQuery.totalDividendsBRL ?? 0}
            totalReturnPnlBRL={data.positionQuery.totalReturnPnlBRL}
            totalReturnPct={data.positionQuery.totalReturnPct}
            unrealizedPnlBRL={data.positionQuery.unrealizedPnlBRL}
            unrealizedPnlPct={data.positionQuery.unrealizedPct}
            periodRedemptions={data.periodRedemptions}
            cashBRL={data.cashBalanceBRL}
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
          />
        </Suspense>
      )}

      <DividendFreedomModal
        open={state.dividendFreedomOpen}
        onOpenChange={state.setDividendFreedomOpen}
        periodLabel={data.periodLabel}
        freedomAnalysis={data.freedomAnalysis}
        dividends={data.dividends}
        yearDividendsBRL={data.yearDividendsBRL}
        assets={data.assets}
        usdRate={data.usdRate}
      />

      <ConsolidatedWealthModal
        open={state.consolidatedWealthOpen}
        onOpenChange={state.setConsolidatedWealthOpen}
        periodLabel={data.periodLabel}
        balanceSheet={data.consolidatedBalance}
      />

      <TaxFacilitatorModal
        open={state.taxReportOpen}
        onOpenChange={state.setTaxReportOpen}
        assets={data.assets}
        dividends={data.dividends}
        usdRate={data.usdRate}
      />

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
    </>
  );
}
