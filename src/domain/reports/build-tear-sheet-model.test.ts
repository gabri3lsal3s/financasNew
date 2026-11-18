import { describe, expect, it } from "vitest";
import { buildTearSheetModel, resolveAssetClassTokenColor } from "./build-tear-sheet-model";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/reports";

const mockAllocation: AllocationAnalysisResult = {
  totalBRL: 100000,
  alignmentScore: 95,
  equilibriumIndexPct: 95,
  totalTargetPct: 100,
  totalGapBRL: 0,
  classGaps: [
    {
      assetClass: "Ações",
      currentBRL: 60000,
      currentPct: 60,
      targetPct: 50,
      gapBRL: -10000,
      gapPct: 10,
      status: "surplus",
      recommendedOrder: 2,
    },
    {
      assetClass: "FIIs",
      currentBRL: 40000,
      currentPct: 40,
      targetPct: 50,
      gapBRL: 10000,
      gapPct: -10,
      status: "deficit",
      recommendedOrder: 1,
    },
  ],
  sectorGaps: [],
  assetGaps: [],
  topDeficitClass: null,
  topDeficitSector: null,
  topDeficitAsset: null,
  treeNodes: [],
};

const mockConcentration: ConcentrationRiskResult = {
  totalBRL: 100000,
  top5BRL: 100000,
  top5Pct: 100,
  top10BRL: 100000,
  top10Pct: 100,
  singleAssetDominance: { ticker: "WEGE3", valueBRL: 60000, pct: 60 },
  sectorExposure: [],
  topSectorDominance: null,
  top3SectorsPct: 100,
  currencyExposure: { brlBRL: 100000, brlPct: 100, usdBRL: 0, usdPct: 0 },
  riskScore: 70,
  riskAlerts: [],
};

describe("buildTearSheetModel", () => {
  it("mapeia cores semânticas CSS sem literais hex", () => {
    expect(resolveAssetClassTokenColor("Ações")).toBe("hsl(var(--primary-strong))");
    expect(resolveAssetClassTokenColor("FIIs")).toBe("hsl(var(--accent))");
    expect(resolveAssetClassTokenColor("Internacional")).toBe("hsl(var(--portfolio))");
    expect(resolveAssetClassTokenColor("Desconhecida")).toBe("hsl(var(--cat-10))");
  });

  it("calcula P&L econômico, grupos ordenados e usa twrMonthPct no fallback de monthlySeries", () => {
    const model = buildTearSheetModel({
      rows: [
        {
          ticker: "HGLG11",
          assetClass: "FIIs",
          currency: "BRL",
          quantity: 10,
          averagePrice: 150,
          currentPrice: 160,
          valueBRL: 1600,
          totalCostBRL: 1500,
          unrealizedPnlBRL: 100,
          unrealizedPnlPct: 6.67,
          dividendsBRL: 50,
          isCash: false,
        },
        {
          ticker: "WEGE3",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          averagePrice: 40,
          currentPrice: 50,
          valueBRL: 5000,
          totalCostBRL: 4000,
          unrealizedPnlBRL: 1000,
          unrealizedPnlPct: 25,
          dividendsBRL: 200,
          isCash: false,
        },
      ],
      totalBRL: 6600,
      totalCostBRL: 5500,
      totalDividendsBRL: 250,
      totalReturnPnlBRL: 1350,
      totalReturnPct: 24.5,
      allTimeEconomicPnlBRL: 1500,
      allocationAnalysis: mockAllocation,
      concentrationRisk: mockConcentration,
      monthlySeries: [
        {
          month: "2026-08",
          valueBRL: 6000,
          costBRL: 5500,
          monthDividendsBRL: 100,
          accumulatedDividendsBRL: 100,
          capitalGainPnl: 500,
          capitalGainPct: 9.1,
          totalReturnPnl: 600,
          totalReturnPct: 30,
          twrMonthPct: -1.5,
          twrAccumulatedPct: -1.5,
          sharePrice: 98.5,
        },
        {
          month: "2026-09",
          valueBRL: 6600,
          costBRL: 5500,
          monthDividendsBRL: 150,
          accumulatedDividendsBRL: 250,
          capitalGainPnl: 1100,
          capitalGainPct: 20,
          totalReturnPnl: 1350,
          totalReturnPct: 35,
          twrMonthPct: 2.3,
          twrAccumulatedPct: 0.8,
          sharePrice: 100.8,
        },
      ],
    });

    expect(model.effectiveRealizedGainBRL).toBe(150);
    expect(model.classTableGroups.map((g) => g.className)).toEqual(["Ações", "FIIs"]);
    expect(model.performanceSeries.map((p) => p.ratePct)).toEqual([-1.5, 2.3]);
    expect(model.donutData.classSegments.every((s) => s.color.startsWith("hsl(var("))).toBe(true);
    expect(model.stackedSegments.every((s) => s.color.startsWith("hsl(var("))).toBe(true);
  });
});
