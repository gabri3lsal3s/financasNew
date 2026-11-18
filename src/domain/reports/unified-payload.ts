/**
 * Contrato Canônico Único de Snapshot de Relatório (§Fase 6 — Etapa 6.1).
 * UnifiedPortfolioReportPayload — Fonte Única da Verdade para Dossiê Executivo e Extrato Analítico.
 *
 * Módulo 100% puro e desacoplado de UI e Supabase.
 */

export interface AllocationRowDTO {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: "deficit" | "balanced" | "surplus";
}

export interface CustodyAssetDTO {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValueBRL: number;
  totalCostBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  activeDividendsBRL: number;
  totalReturnBRL: number;
  totalReturnPct: number;
}

export interface CustodyClassGroupDTO {
  className: string;
  subtotalMarketValueBRL: number;
  subtotalCostBRL: number;
  sharePct: number;
  assets: CustodyAssetDTO[];
}

export interface XRaySegmentDTO {
  key: string;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
}

export interface XRayGroupDTO {
  title: string;
  totalValueBRL: number;
  segments: XRaySegmentDTO[];
  displayedRowsCount: number;
}

export interface MonthlyEvolutionRowDTO {
  competence: string; // "YYYY-MM"
  competenceLabel: string; // "Out/2024"
  startEquityBRL: number;
  netFlowBRL: number;
  endEquityBRL: number;
  monthTwrPct: number;
  cumulativeTwrPct: number;
  quotaValueBRL: number;
  monthDividendsBRL: number;
  accumulatedDividendsBRL: number;
  openCostBRL: number;
}

export interface BenchmarkComparisonDTO {
  key: "cdi" | "poupanca" | "ipca" | "ibov";
  name: string;
  accumulatedRatePct: number;
  portfolioRatePct: number;
  alphaPp: number;
  pctOfBenchmark: number | null;
}

export interface BenchmarksAndRiskDTO {
  benchmarks: BenchmarkComparisonDTO[];
  realGainFisherPct: number;
  riskMetrics: {
    closedMonthsCount: number;
    annualizedVolatilityPct: number;
    maxDrawdownPct: number;
    consistencyPositiveFraction: string; // Ex: "8/12"
    consistencyPct: number;
    sharpeRatio: number | null;
    sharpeLabel: string;
  };
}

export interface UnifiedPortfolioReportPayload {
  reportId: string; // Ex: "BR-20261118-6445"
  referenceDate: string; // Ex: "2026-11-18"
  ptaxReference: {
    rate: number; // Ex: 5.2500
    bulletinDate: string;
  };
  summary: {
    assetsMarketValueBrl: number; // R$ 17.502,72
    cashReserveBrl: number; // R$ 0,96
    totalEquityBrl: number; // R$ 17.503,68 (Invariante: assets + cash)
    assetsAcquisitionCostBrl: number; // R$ 17.319,94
    totalAppliedCostBrl: number; // R$ 17.320,90 (Invariante: assetsCost + cash)
    openCapitalGainBrl: number; // R$ 182,78 (Invariante: totalEquity - totalAppliedCost)
    openCapitalGainPct: number; // +1,06%
    activePositionsDividendsBrl: number; // R$ 1.757,57
    closedPositionsDividendsBrl: number; // R$ 36,90
    totalHistoricalDividendsBrl: number; // R$ 1.794,47 (Invariante: active + closed)
    realizedCapitalGainClosedBrl: number; // R$ 0,00
    openAccountingReturnBrl: number; // R$ 1.940,35 (openCapitalGain + activeDividends)
    openAccountingReturnPct: number; // +11,20%
    totalEconomicPnlBrl: number; // R$ 1.977,25 (openCapitalGain + realizedClosed + totalHistoricalDividends)
    twrCumulativePct: number; // Ex: +11,499% (+11,5%)
    twrAnnualizedPct: number | null;
    currentQuotaValueBrl: number; // Base 100.00 -> 100 * (1 + twrCumulative)
    xirrAnnualizedPct: number | null;
    durationDays: number;
  };
  allocationMatrix: {
    equilibriumIndexPct: number; // Ex: 84.9 (85%)
    totalTargetPct: number; // Invariante estrito: 100.0
    totalGapBrl: number; // Invariante estrito: 0.00
    items: AllocationRowDTO[];
  };
  custodyByClass: CustodyClassGroupDTO[];
  xRays: {
    equitiesProfile: XRayGroupDTO;
    equitiesMarketCap: XRayGroupDTO;
    fiisStrategy: XRayGroupDTO;
    fixedIncomeIndexers: XRayGroupDTO;
    fixedIncomeIssuers: XRayGroupDTO;
    internationalRegions: XRayGroupDTO;
    internationalVehicles: XRayGroupDTO;
    consolidatedSegments: XRayGroupDTO;
  };
  monthlyEvolutionSeries: MonthlyEvolutionRowDTO[];
  benchmarksAndRisk: BenchmarksAndRiskDTO;
}

export interface BuildUnifiedPortfolioReportPayloadParams {
  reportId: string;
  referenceDate: string;
  ptaxRate?: number;
  assetsMarketValueBRL: number;
  cashReserveBRL: number;
  assetsCostBRL: number;
  activeDividendsBRL: number;
  closedDividendsBRL: number;
  realizedPnlClosedBRL: number;
  twrCumulativePct: number;
  twrAnnualizedPct: number | null;
  xirrAnnualizedPct: number | null;
  durationDays: number;
  allocationRows: readonly AllocationRowDTO[];
  equilibriumIndexPct: number;
  custodyByClass: readonly CustodyClassGroupDTO[];
  xRays: UnifiedPortfolioReportPayload["xRays"];
  monthlyEvolutionSeries: readonly MonthlyEvolutionRowDTO[];
  benchmarksAndRisk: BenchmarksAndRiskDTO;
}

/**
 * Construtor determinístico do Snapshot Unificado a partir dos motores de domínio.
 */
export function buildUnifiedPortfolioReportPayload(
  params: BuildUnifiedPortfolioReportPayloadParams,
): UnifiedPortfolioReportPayload {
  const ptaxRate = params.ptaxRate ?? 5.25;
  const assetsMarketValueBrl = Math.round(params.assetsMarketValueBRL * 100) / 100;
  const cashReserveBrl = Math.round(params.cashReserveBRL * 100) / 100;
  const totalEquityBrl = Math.round((assetsMarketValueBrl + cashReserveBrl) * 100) / 100;

  const assetsAcquisitionCostBrl = Math.round(params.assetsCostBRL * 100) / 100;
  const totalAppliedCostBrl = Math.round((assetsAcquisitionCostBrl + cashReserveBrl) * 100) / 100;

  const openCapitalGainBrl = Math.round((totalEquityBrl - totalAppliedCostBrl) * 100) / 100;
  const openCapitalGainPct =
    totalAppliedCostBrl > 0
      ? Math.round((openCapitalGainBrl / totalAppliedCostBrl) * 10000) / 100
      : 0;

  const activePositionsDividendsBrl = Math.round(params.activeDividendsBRL * 100) / 100;
  const closedPositionsDividendsBrl = Math.round(params.closedDividendsBRL * 100) / 100;
  const totalHistoricalDividendsBrl =
    Math.round((activePositionsDividendsBrl + closedPositionsDividendsBrl) * 100) / 100;

  const realizedCapitalGainClosedBrl = Math.round(params.realizedPnlClosedBRL * 100) / 100;
  const openAccountingReturnBrl =
    Math.round((openCapitalGainBrl + activePositionsDividendsBrl) * 100) / 100;
  const openAccountingReturnPct =
    assetsAcquisitionCostBrl > 0
      ? Math.round((openAccountingReturnBrl / assetsAcquisitionCostBrl) * 10000) / 100
      : 0;

  const totalEconomicPnlBrl =
    Math.round(
      (openCapitalGainBrl + realizedCapitalGainClosedBrl + totalHistoricalDividendsBrl) * 100,
    ) / 100;

  const twrCumulativePct = Math.round(params.twrCumulativePct * 10000) / 10000;
  const currentQuotaValueBrl =
    Math.round(100.0 * (1 + twrCumulativePct / 100) * 100) / 100;

  const totalTargetPct = Math.round(
    params.allocationRows.reduce((acc, r) => acc + r.targetPct, 0) * 100,
  ) / 100;
  const totalGapBrl = Math.round(
    params.allocationRows.reduce((acc, r) => acc + r.gapBRL, 0) * 100,
  ) / 100;

  return {
    reportId: params.reportId,
    referenceDate: params.referenceDate,
    ptaxReference: {
      rate: ptaxRate,
      bulletinDate: `${params.referenceDate}T13:00:00Z`,
    },
    summary: {
      assetsMarketValueBrl,
      cashReserveBrl,
      totalEquityBrl,
      assetsAcquisitionCostBrl,
      totalAppliedCostBrl,
      openCapitalGainBrl,
      openCapitalGainPct,
      activePositionsDividendsBrl,
      closedPositionsDividendsBrl,
      totalHistoricalDividendsBrl,
      realizedCapitalGainClosedBrl,
      openAccountingReturnBrl,
      openAccountingReturnPct,
      totalEconomicPnlBrl,
      twrCumulativePct,
      twrAnnualizedPct: params.twrAnnualizedPct,
      currentQuotaValueBrl,
      xirrAnnualizedPct: params.xirrAnnualizedPct,
      durationDays: params.durationDays,
    },
    allocationMatrix: {
      equilibriumIndexPct: params.equilibriumIndexPct,
      totalTargetPct,
      totalGapBrl,
      items: params.allocationRows.map((r) => ({ ...r })),
    },
    custodyByClass: params.custodyByClass.map((c) => ({
      ...c,
      assets: c.assets.map((a) => ({ ...a })),
    })),
    xRays: params.xRays,
    monthlyEvolutionSeries: params.monthlyEvolutionSeries.map((s) => ({ ...s })),
    benchmarksAndRisk: params.benchmarksAndRisk,
  };
}
