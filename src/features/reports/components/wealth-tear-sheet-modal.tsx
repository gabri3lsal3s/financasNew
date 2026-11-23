import { useMemo } from "react";
import { Landmark } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportFooter,
  ReportHeader,
  ReportQuoteStatusBanner,
  ReportRiskGauge,
} from "@/components/modules";
import {
  buildTearSheetModel,
  sanitizeReportText,
  type AllocationAnalysisResult,
  type ConcentrationRiskResult,
  type MonthFlowSummary,
  type PeriodRedemptionItem,
  type WealthPositionRow,
  type DossiePosicaoSections,
  type ReportReadinessResult,
  computeTearSheetPagination,
} from "@/domain/reports";
import {
  buildMarketReferenceSummary,
  buildReportPrintWarning,
  calculateCustodyReconciliation,
  evaluateStaleQuoteGuard,
  type CanonicalFxMetadata,
  type PortfolioMonthlySeriesPoint,
  type ProvisionedDividendsSummary,
  type TwrConsolidatedResult,
  type XIRRResult,
} from "@/domain/portfolio";
import { OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import { useExecutiveReportRefresh } from "@/features/investments/hooks/use-executive-report-refresh";
import { TearSheetAllocationSection } from "./tear-sheet/TearSheetAllocationSection";
import { TearSheetCustodyAndBreakdowns } from "./tear-sheet/TearSheetCustodyAndBreakdowns";
import { TearSheetExecutiveNarrative } from "./tear-sheet/TearSheetExecutiveNarrative";
import { TearSheetMethodologyGrid } from "./tear-sheet/TearSheetMethodologyGrid";
import { TearSheetMovementStrip } from "./tear-sheet/TearSheetMovementStrip";

export type { WealthPositionRow, MonthFlowSummary };

export interface WealthTearSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly WealthPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  assetsCostBRL?: number;
  totalAppliedCostBRL?: number;
  totalDividendsBRL?: number;
  totalReturnPnlBRL?: number;
  totalReturnPct?: number | null;
  unrealizedPnlBRL?: number;
  unrealizedPnlPct?: number | null;
  periodRedemptions?: readonly PeriodRedemptionItem[];
  cashBRL?: number;
  yearDividendsBRL?: number;
  monthSummary?: MonthFlowSummary;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  portfolioIrr?: XIRRResult;
  portfolioTwr?: TwrConsolidatedResult;
  monthlySeries?: readonly PortfolioMonthlySeriesPoint[];
  allTimeEconomicPnlBRL?: number;
  realizedPnlBRL?: number;
  annualCdiRate?: number;
  annualSelicRate?: number;
  annualIpcaRate?: number;
  ibovPeriodReturnPct?: number;
  assetsMetadata?: readonly PortfolioAsset[];
  usdRate?: number;
  fxMetadata?: CanonicalFxMetadata | null;
  provisionedSummary?: ProvisionedDividendsSummary | null;
  transactions?: readonly PortfolioTransaction[];
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
  isCurrentPeriod?: boolean;
  readiness?: ReportReadinessResult<DossiePosicaoSections>;
}

/**
 * Dossiê Executivo da Posição Vigente Consolidada & Tear Sheet Patrimonial.
 */
export function WealthTearSheetModal({
  open,
  onOpenChange,
  rows,
  totalBRL,
  totalCostBRL,
  assetsCostBRL,
  totalAppliedCostBRL,
  totalDividendsBRL,
  totalReturnPnlBRL,
  totalReturnPct: propTotalReturnPct,
  unrealizedPnlBRL: propUnrealizedPnlBRL,
  unrealizedPnlPct: propUnrealizedPnlPct,
  periodRedemptions,
  cashBRL,
  monthSummary,
  allocationAnalysis,
  concentrationRisk,
  portfolioIrr,
  portfolioTwr,
  monthlySeries,
  allTimeEconomicPnlBRL,
  realizedPnlBRL,
  annualCdiRate,
  annualSelicRate,
  annualIpcaRate,
  ibovPeriodReturnPct,
  assetsMetadata = [],
  usdRate,
  fxMetadata,
  provisionedSummary = null,
  transactions = [],
  periodLabel = "Posição Atual Consolidada",
  appName = "Axir",
  accountHolder,
  isCurrentPeriod = true,
}: WealthTearSheetModalProps) {
  const reportRefresh = useExecutiveReportRefresh({
    open,
    enabled: isCurrentPeriod,
    assets: assetsMetadata,
    tickers: rows.map((r) => r.ticker),
  });

  const staleGuard = useMemo(() => {
    if (!isCurrentPeriod) return null;
    return evaluateStaleQuoteGuard({
      rows,
      transactions,
      assets: assetsMetadata,
      fxMetadata,
    });
  }, [isCurrentPeriod, rows, transactions, assetsMetadata, fxMetadata]);

  const marketSummary = useMemo(
    () =>
      buildMarketReferenceSummary({
        rows,
        fxMetadata,
        usdRate,
      }),
    [rows, fxMetadata, usdRate],
  );

  const custodyReconciliation = useMemo(
    () =>
      calculateCustodyReconciliation({
        rows,
        totalBRL,
        cashBRL,
        fxMetadata,
        usdRate,
      }),
    [rows, totalBRL, cashBRL, fxMetadata, usdRate],
  );

  const printWarning = useMemo(() => buildReportPrintWarning(staleGuard), [staleGuard]);

  const model = useMemo(
    () =>
      buildTearSheetModel({
        rows,
        totalBRL,
        totalCostBRL,
        assetsCostBRL,
        totalAppliedCostBRL,
        totalDividendsBRL,
        totalReturnPnlBRL,
        totalReturnPct: propTotalReturnPct,
        unrealizedPnlBRL: propUnrealizedPnlBRL,
        unrealizedPnlPct: propUnrealizedPnlPct,
        cashBRL,
        allocationAnalysis,
        concentrationRisk,
        portfolioTwr,
        monthlySeries,
        allTimeEconomicPnlBRL,
        realizedPnlBRL,
        usdRate,
        fxMetadata,
        staleGuard,
      }),
    [
      rows,
      totalBRL,
      totalCostBRL,
      assetsCostBRL,
      totalAppliedCostBRL,
      totalDividendsBRL,
      totalReturnPnlBRL,
      propTotalReturnPct,
      propUnrealizedPnlBRL,
      propUnrealizedPnlPct,
      cashBRL,
      allocationAnalysis,
      concentrationRisk,
      portfolioTwr,
      monthlySeries,
      allTimeEconomicPnlBRL,
      realizedPnlBRL,
      usdRate,
      fxMetadata,
      staleGuard,
    ],
  );

  const pagination = useMemo(
    () => computeTearSheetPagination(model, assetsMetadata),
    [model, assetsMetadata],
  );

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê Executivo da Posição Vigente Consolidada"
      documentTitle="AXIR_Dossie_Posicao_Vigente.pdf"
      printWarning={printWarning}
    >
      <ReportHeader
        title="Dossiê Executivo da Posição Vigente Consolidada"
        subtitle="Posição Patrimonial Consolidada & Diagnóstico de Metas"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
        marketMetadata={marketSummary}
      />

      <ReportQuoteStatusBanner
        isRefreshing={reportRefresh.isRefreshing}
        staleGuard={staleGuard}
        onRetry={() => void reportRefresh.retry()}
      />

      <TearSheetExecutiveNarrative
        model={model}
        totalBRL={totalBRL}
        totalCostBRL={totalCostBRL}
        cashBRL={cashBRL}
        allocationAnalysis={allocationAnalysis}
        portfolioIrr={portfolioIrr}
        portfolioTwr={portfolioTwr}
        allTimeEconomicPnlBRL={allTimeEconomicPnlBRL}
      />

      {monthSummary && <TearSheetMovementStrip monthSummary={monthSummary} />}

      <TearSheetAllocationSection
        alignmentScore={allocationAnalysis.alignmentScore}
        stackedSegments={model.stackedSegments}
        allocationRows={model.allocationRows}
      />

      <ReportRiskGauge
        topItemName={sanitizeReportText(model.topDominance.ticker)}
        topItemPct={model.topDominance.pct}
        warningThresholdPct={15}
        criticalThresholdPct={25}
      />

      <ReportFooter
        accountHolder={accountHolder}
        reportType="dossier"
        currentPage={1}
        totalPages={pagination.totalPages}
        variant="running"
        className="hidden print:flex"
      />

      <TearSheetCustodyAndBreakdowns
        model={model}
        totalBRL={totalBRL}
        periodLabel={periodLabel}
        accountHolder={accountHolder}
        periodRedemptions={periodRedemptions}
        custodyReconciliation={custodyReconciliation}
        provisionedSummary={provisionedSummary}
        assetsMetadata={assetsMetadata}
        annualCdiRate={annualCdiRate}
        annualSelicRate={annualSelicRate}
        annualIpcaRate={annualIpcaRate}
        ibovPeriodReturnPct={ibovPeriodReturnPct}
        totalPages={pagination.totalPages}
        pageNumbers={pagination.pageNumbers}
      />

      <TearSheetMethodologyGrid
        portfolioTwr={portfolioTwr}
        portfolioIrr={portfolioIrr}
        totalReturnPct={model.totalReturnPct}
        historicalPnlBRL={allTimeEconomicPnlBRL ?? model.totalReturnBRL}
        periodLabel={periodLabel}
      />

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER}
        reportType="dossier"
        currentPage={pagination.totalPages}
        totalPages={pagination.totalPages}
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
