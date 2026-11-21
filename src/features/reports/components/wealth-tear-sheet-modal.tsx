import { useMemo } from "react";
import { Landmark } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportFooter,
  ReportHeader,
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
} from "@/domain/reports";
import type {
  PortfolioMonthlySeriesPoint,
  TwrConsolidatedResult,
  XIRRResult,
} from "@/domain/portfolio";
import { OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset } from "@/types";
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
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
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
  periodLabel = "Posição Atual Consolidada",
  appName = "Axir",
  accountHolder,
}: WealthTearSheetModalProps) {
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
    ],
  );

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê Executivo da Posição Vigente Consolidada"
      documentTitle="AXIR_Dossie_Posicao_Vigente.pdf"
    >
      <ReportHeader
        title="Dossiê Executivo da Posição Vigente Consolidada"
        subtitle="Posição Patrimonial Consolidada & Diagnóstico de Metas"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
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
        disclaimer={OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER}
        reportType="dossier"
        currentPage={1}
        totalPages={7}
        showQrCode
        className="hidden print:flex"
      />

      <TearSheetCustodyAndBreakdowns
        model={model}
        totalBRL={totalBRL}
        periodLabel={periodLabel}
        periodRedemptions={periodRedemptions}
        assetsMetadata={assetsMetadata}
        annualCdiRate={annualCdiRate}
        annualSelicRate={annualSelicRate}
        annualIpcaRate={annualIpcaRate}
        ibovPeriodReturnPct={ibovPeriodReturnPct}
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
        currentPage={7}
        totalPages={7}
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
