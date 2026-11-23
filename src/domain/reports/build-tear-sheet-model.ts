import type { PositionLikeItem } from "@/domain/portfolio";
import { buildAllocationDonutSegments, type AllocationDonutsResult } from "./allocation-donuts";
import {
  buildClassTableGroups,
  buildPerformanceSeries,
  resolveAssetClassTokenColor,
  SECTOR_TOKEN_PALETTE,
} from "./tear-sheet-helpers";
import type {
  BuildTearSheetModelParams,
  TearSheetAllocationRow,
  TearSheetModel,
  TearSheetStackedSegment,
} from "./tear-sheet-types";

export { resolveAssetClassTokenColor } from "./tear-sheet-helpers";
export type {
  BuildTearSheetModelParams,
  MonthFlowSummary,
  TearSheetAllocationRow,
  TearSheetClassGroup,
  TearSheetClassGroupItem,
  TearSheetModel,
  TearSheetPerformancePoint,
  TearSheetStackedSegment,
  WealthPositionRow,
} from "./tear-sheet-types";

/** Constrói o modelo analítico puro do Dossiê Executivo Patrimonial (Tear Sheet). */
export function buildTearSheetModel(params: BuildTearSheetModelParams): TearSheetModel {
  const {
    rows,
    totalBRL,
    totalCostBRL,
    assetsCostBRL,
    totalDividendsBRL,
    totalReturnPnlBRL,
    totalReturnPct: propTotalReturnPct,
    unrealizedPnlBRL: propUnrealizedPnlBRL,
    unrealizedPnlPct: propUnrealizedPnlPct,
    cashBRL = 0,
    allocationAnalysis,
    concentrationRisk,
    portfolioTwr,
    monthlySeries,
    allTimeEconomicPnlBRL,
    realizedPnlBRL,
  } = params;

  const activeInvestmentRows = rows.filter((r) => !r.isCash && r.quantity > 0);
  const investmentRows = rows.filter((r) => !r.isCash);

  const totalInvestedValueBRL =
    Math.round(activeInvestmentRows.reduce((acc, r) => acc + r.valueBRL, 0) * 100) / 100;
  const effectiveCostBRL =
    assetsCostBRL && assetsCostBRL > 0
      ? assetsCostBRL
      : totalCostBRL > 0 && cashBRL > 0 && Math.abs(totalCostBRL - (totalInvestedValueBRL + cashBRL)) < 0.05
        ? Math.round((totalCostBRL - cashBRL) * 100) / 100
        : totalCostBRL > 0
          ? totalCostBRL
          : Math.round(activeInvestmentRows.reduce((acc, r) => acc + (r.totalCostBRL ?? 0), 0) * 100) / 100;

  const fallbackUnrealizedPnlBRL = Math.round((totalInvestedValueBRL - effectiveCostBRL) * 100) / 100;
  const fallbackUnrealizedPnlPct = effectiveCostBRL > 0 ? (fallbackUnrealizedPnlBRL / effectiveCostBRL) * 100 : 0;

  const unrealizedPnlBRL = propUnrealizedPnlBRL ?? fallbackUnrealizedPnlBRL;
  const unrealizedPnlPct = propUnrealizedPnlPct ?? fallbackUnrealizedPnlPct;

  const sumDividendsFromRows = rows.reduce(
    (acc, r) => acc + (r.dividendsBRL ?? r.yearDividendsBRL ?? 0),
    0,
  );
  const totalDividendsAllTime =
    totalDividendsBRL !== undefined && totalDividendsBRL > 0
      ? totalDividendsBRL
      : sumDividendsFromRows > 0
        ? sumDividendsFromRows
        : (totalDividendsBRL ?? 0);

  const fallbackTotalReturnBRL = Math.round((unrealizedPnlBRL + totalDividendsAllTime) * 100) / 100;
  const fallbackTotalReturnPct = effectiveCostBRL > 0 ? (fallbackTotalReturnBRL / effectiveCostBRL) * 100 : 0;

  const totalReturnBRL = totalReturnPnlBRL ?? fallbackTotalReturnBRL;
  const totalReturnPct = propTotalReturnPct ?? fallbackTotalReturnPct;

  const effectiveRealizedGainBRL =
    allTimeEconomicPnlBRL !== undefined
      ? Math.round((allTimeEconomicPnlBRL - totalReturnBRL) * 100) / 100
      : (realizedPnlBRL ?? 0);
  const allTimeEconomicValueBRL = allTimeEconomicPnlBRL ?? (totalReturnBRL + effectiveRealizedGainBRL);

  const rawDonuts = buildAllocationDonutSegments({
    positions: activeInvestmentRows.map((r) => ({
      assetClass: r.assetClass,
      sector: r.sector,
      valueBRL: r.valueBRL,
    })),
    cashBalanceBRL: cashBRL,
    includeCash: cashBRL > 0,
  });

  const donutData: AllocationDonutsResult = {
    ...rawDonuts,
    classSegments: rawDonuts.classSegments.map((seg) => ({
      ...seg,
      color: resolveAssetClassTokenColor(seg.label),
    })),
    sectorSegments: rawDonuts.sectorSegments.map((seg, idx) => ({
      ...seg,
      color: SECTOR_TOKEN_PALETTE[idx % SECTOR_TOKEN_PALETTE.length] ?? "hsl(var(--cat-10))",
    })),
  };

  const normKey = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const classSegmentMap = new Map<string, number>();
  for (const seg of donutData.classSegments) {
    classSegmentMap.set(normKey(seg.label), seg.pct);
    classSegmentMap.set(normKey(seg.key), seg.pct);
  }

  const rawClassGaps: Array<{
    assetClass: string;
    currentBRL: number;
    currentPct: number;
    targetPct: number;
  }> =
    allocationAnalysis?.classGaps && allocationAnalysis.classGaps.length > 0
      ? allocationAnalysis.classGaps
      : (allocationAnalysis as unknown as { classes?: Array<{ label?: string; assetClass?: string; classKey?: string; currentValueBRL?: number; currentBRL?: number; currentPct?: number; targetPct?: number }> })?.classes &&
        ((allocationAnalysis as unknown as { classes: Array<{ label?: string; assetClass?: string; classKey?: string; currentValueBRL?: number; currentBRL?: number; currentPct?: number; targetPct?: number }> }).classes.length > 0)
        ? (allocationAnalysis as unknown as { classes: Array<{ label?: string; assetClass?: string; classKey?: string; currentValueBRL?: number; currentBRL?: number; currentPct?: number; targetPct?: number }> }).classes.map((c) => ({
            assetClass: c.label || c.assetClass || c.classKey || "Geral",
            currentBRL: c.currentValueBRL ?? c.currentBRL ?? Math.round((((c.currentPct ?? 0) / 100) * totalBRL) * 100) / 100,
            currentPct: c.currentPct ?? 0,
            targetPct: c.targetPct ?? 0,
          }))
        : donutData.classSegments.map((seg) => ({
            assetClass: seg.label,
            currentBRL: Math.round(((seg.pct / 100) * totalBRL) * 100) / 100,
            currentPct: seg.pct,
            targetPct: 0,
          }));

  const sumRawGapsBRL = rawClassGaps.reduce((acc, cg) => acc + cg.currentBRL, 0);
  const analysisTotal =
    (allocationAnalysis as unknown as { totalPortfolioBRL?: number })?.totalPortfolioBRL ??
    allocationAnalysis?.totalBRL;
  const allocationBaseBRL =
    analysisTotal && analysisTotal > 0
      ? analysisTotal
      : sumRawGapsBRL > 0
        ? sumRawGapsBRL
        : totalBRL;

  const toleranceBRL = Math.max(50, allocationBaseBRL * 0.005);

  const allocationRows: TearSheetAllocationRow[] = rawClassGaps.map((cg) => {
    const currentBRL = cg.currentBRL;
    const currentPct =
      allocationBaseBRL > 0
        ? Math.round(((currentBRL / allocationBaseBRL) * 100) * 10) / 10
        : cg.currentPct;
    const targetIdealBRL = Math.round((allocationBaseBRL * (cg.targetPct / 100)) * 100) / 100;
    const deviationBRL = Math.round((currentBRL - targetIdealBRL) * 100) / 100;
    const isDeficit = cg.targetPct > 0 && deviationBRL < -toleranceBRL;
    const isSurplus = cg.targetPct > 0 && deviationBRL > toleranceBRL;

    return {
      assetClass: cg.assetClass,
      currentBRL,
      currentPct,
      targetPct: cg.targetPct,
      deviationBRL,
      isDeficit,
      isSurplus,
    };
  });

  const stackedSegments: TearSheetStackedSegment[] = allocationRows.map((row) => ({
    key: row.assetClass,
    label: row.assetClass.toUpperCase(),
    pct: row.currentPct,
    color: resolveAssetClassTokenColor(row.assetClass),
  }));

  const topDominance = concentrationRisk?.singleAssetDominance ?? {
    ticker: investmentRows[0]?.ticker ?? "N/A",
    pct: investmentRows[0] && totalBRL > 0 ? (investmentRows[0].valueBRL / totalBRL) * 100 : 0,
  };

  const breakdownRows: PositionLikeItem[] = rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    assetClass: r.assetClass,
    sector: r.sector,
    valueBRL: r.valueBRL,
    quantity: r.quantity,
    averageCost: r.averagePrice,
    currentPrice: r.currentPrice,
    totalCostBRL: r.totalCostBRL,
    unrealizedPnl: r.unrealizedPnlBRL,
    unrealizedPct: r.unrealizedPnlPct,
    totalReturnPnl: r.totalReturnPnlBRL,
    totalReturnPct: r.totalReturnPct ?? r.unrealizedPnlPct,
    currency: r.currency,
    isCash: r.isCash ?? false,
  }));

  const intlTotalBRL = investmentRows
    .filter(
      (r) =>
        r.currency === "USD" ||
        (r.assetClass &&
          (r.assetClass.toLowerCase().includes("internacional") ||
            r.assetClass.toLowerCase().includes("global"))),
    )
    .reduce((acc, r) => acc + r.valueBRL, 0);

  return {
    activeInvestmentRows,
    totalInvestedValueBRL,
    effectiveCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    totalDividendsAllTime,
    totalReturnBRL,
    totalReturnPct,
    effectiveRealizedGainBRL,
    allTimeEconomicValueBRL,
    performanceSeries: buildPerformanceSeries(portfolioTwr, monthlySeries),
    donutData,
    stackedSegments,
    allocationRows,
    topDominance,
    breakdownRows,
    classTableGroups: buildClassTableGroups(
      activeInvestmentRows,
      totalBRL,
      cashBRL,
      params.usdRate,
      params.fxMetadata,
      params.staleGuard,
    ),
    intlPct: totalBRL > 0 ? (intlTotalBRL / totalBRL) * 100 : 0,
    hasTargets: allocationRows.some((cg) => cg.targetPct > 0),
    surplusClasses: allocationRows
      .filter((cg) => cg.isSurplus)
      .map((cg) => cg.assetClass),
  };
}
