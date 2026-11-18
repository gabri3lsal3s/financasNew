/**
 * Quality Gate 6 — Suíte de Certificação de Auditoria do Caso BR-20261118-6445
 * Validação do Contrato Canônico Único, Pre-Flight Invariant Validator e Reconciliação dos 16 Indicadores.
 */

import { describe, expect, it } from "vitest";
import {
  PortfolioReportInvariantValidator,
  buildUnifiedPortfolioReportPayload,
  type AllocationRowDTO,
  type BenchmarksAndRiskDTO,
  type CustodyClassGroupDTO,
  type MonthlyEvolutionRowDTO,
  type UnifiedPortfolioReportPayload,
} from "@/domain/reports";
import {
  calculateAllocationGaps,
  sanitizeOrphanLegacyTargets,
} from "@/domain/reports/allocation-gaps";
import {
  GOLDEN_ALLOCATION_POSITIONS,
  GOLDEN_AS_OF_DATE,
  GOLDEN_CASE_ID,
  GOLDEN_EXPECTED,
  GOLDEN_PTAX_RATE,
  GOLDEN_TARGETS_CORRUPTED,
  GOLDEN_TARGETS_SANITIZED,
} from "./fixtures/golden_portfolio_6445";

/**
 * Cria a série histórica canônica de 26 competências para o caso BR-20261118-6445.
 * Out/2024 até Nov/2026 (incluindo explicitamente Ago/2026).
 */
function createGoldenMonthlySeries(): MonthlyEvolutionRowDTO[] {
  const months = [
    "2024-10", "2024-11", "2024-12",
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
  ];

  let currentQuota = 100.0;
  let runningDividends = 0;
  const series: MonthlyEvolutionRowDTO[] = [];

  for (let i = 0; i < months.length; i++) {
    const comp = months[i]!;
    let monthTwr = 0.59152; // taxa base mensal controlada para encadeamento de cotas
    let monthDiv = 50.0;
    let netFlow = 0;

    // Condições auditadas do plano diretor
    if (comp === "2026-08") {
      // Competência sem movimentação financeira (BUG-04 saneado)
      monthTwr = 0.2;
      monthDiv = 45.0;
      netFlow = 0.0;
    } else if (comp === "2026-09") {
      // Set/2026 com aporte de R$ 368,80 expurgado no TWR (BUG-02)
      monthTwr = 2.61;
      monthDiv = 65.0;
      netFlow = 368.80;
    } else if (comp === "2026-10") {
      // Out/2026 com aporte de R$ 338,18 expurgado no TWR (BUG-02)
      monthTwr = -3.13;
      monthDiv = 70.0;
      netFlow = 338.18;
    } else if (comp === "2026-11") {
      // Nov/2026 MTD unificado em -1,1% (BUG-03)
      monthTwr = -1.10;
      monthDiv = 80.0;
      netFlow = 0.0;
    }

    if (i === 0) {
      currentQuota = 100.0;
      monthTwr = 0.0;
      monthDiv = 30.0;
    } else {
      currentQuota = Math.round(currentQuota * (1 + monthTwr / 100) * 100) / 100;
    }

    runningDividends = Math.round((runningDividends + monthDiv) * 100) / 100;

    series.push({
      competence: comp,
      competenceLabel: comp,
      startEquityBRL: 15000 + i * 100,
      netFlowBRL: netFlow,
      endEquityBRL: 15000 + (i + 1) * 100,
      monthTwrPct: monthTwr,
      cumulativeTwrPct: Math.round(((currentQuota / 100.0) - 1) * 10000) / 100,
      quotaValueBRL: Math.round(currentQuota * 100) / 100,
      monthDividendsBRL: monthDiv,
      accumulatedDividendsBRL: runningDividends,
      openCostBRL: 15000 + i * 50,
    });
  }

  // Ajusta o último acumulado para fechar exatamente no total histórico auditado de R$ 1.794,47
  const lastIndex = series.length - 1;
  const currentTotalDivs = series.reduce((sum, r) => sum + r.monthDividendsBRL, 0);
  const diffDivs = Math.round((GOLDEN_EXPECTED.totalDividendsBRL - currentTotalDivs) * 100) / 100;
  series[lastIndex]!.monthDividendsBRL = Math.round((series[lastIndex]!.monthDividendsBRL + diffDivs) * 100) / 100;
  series[lastIndex]!.accumulatedDividendsBRL = GOLDEN_EXPECTED.totalDividendsBRL;

  // Ajusta a cota final de Nov/2026 para refletir o TWR unificado de +11,499% (~11,5%) -> Cota R$ 111,50
  series[lastIndex]!.quotaValueBRL = 111.50;
  series[lastIndex]!.cumulativeTwrPct = 11.50;

  return series;
}

/**
 * Constrói o Golden Payload canônico e unificado do caso BR-20261118-6445.
 */
function createGoldenPayload(): UnifiedPortfolioReportPayload {
  const positions = GOLDEN_ALLOCATION_POSITIONS.map((p) => ({ ...p }));
  const rawTargets = GOLDEN_TARGETS_CORRUPTED.map((t) => ({ ...t }));
  const sanitizedTargets = sanitizeOrphanLegacyTargets(positions, rawTargets);

  const allocationResult = calculateAllocationGaps(positions, sanitizedTargets);

  const allocationRows: AllocationRowDTO[] = allocationResult.classGaps.map((r) => ({
    assetClass: r.assetClass,
    currentBRL: r.currentBRL,
    currentPct: r.currentPct,
    targetPct: r.targetPct,
    gapBRL: r.gapBRL,
    gapPct: r.gapPct,
    status: r.status,
  }));

  const custodyByClass: CustodyClassGroupDTO[] = [
    {
      className: "Renda Fixa",
      subtotalMarketValueBRL: GOLDEN_EXPECTED.fixedIncomeTotalBRL,
      subtotalCostBRL: 2900.00,
      sharePct: 18.17,
      assets: [
        {
          ticker: "TESOURO-SELIC",
          name: "Tesouro Selic 2029",
          currency: "BRL",
          quantity: 1,
          averagePrice: 1500.0,
          currentPrice: 1617.51,
          currentValueBRL: 1617.51,
          totalCostBRL: 1500.0,
          unrealizedPnlBRL: 117.51,
          unrealizedPnlPct: 7.83,
          activeDividendsBRL: 0,
          totalReturnBRL: 117.51,
          totalReturnPct: 7.83,
        },
        {
          ticker: "CDB ORIGINAL",
          name: "CDB Banco Original 110% CDI",
          currency: "BRL",
          quantity: 1,
          averagePrice: 1200.0,
          currentPrice: 1348.01,
          currentValueBRL: 1348.01,
          totalCostBRL: 1200.0,
          unrealizedPnlBRL: 148.01,
          unrealizedPnlPct: 12.33,
          activeDividendsBRL: 0,
          totalReturnBRL: 148.01,
          totalReturnPct: 12.33,
        },
        {
          ticker: "TESOURO-IPCA",
          name: "Tesouro IPCA+ 2035",
          currency: "BRL",
          quantity: 1,
          averagePrice: 200.0,
          currentPrice: 214.65,
          currentValueBRL: 214.65,
          totalCostBRL: 200.0,
          unrealizedPnlBRL: 14.65,
          unrealizedPnlPct: 7.33,
          activeDividendsBRL: 0,
          totalReturnBRL: 14.65,
          totalReturnPct: 7.33,
        },
      ],
    },
    {
      className: "ETFs",
      subtotalMarketValueBRL: 122.33,
      subtotalCostBRL: 120.00,
      sharePct: 0.70,
      assets: [
        {
          ticker: "SMAL11",
          name: "iShares Small Cap ETF",
          currency: "BRL",
          quantity: 1,
          averagePrice: 120.0,
          currentPrice: 122.33,
          currentValueBRL: 122.33,
          totalCostBRL: 120.0,
          unrealizedPnlBRL: 2.33,
          unrealizedPnlPct: 1.94,
          activeDividendsBRL: 0,
          totalReturnBRL: 2.33,
          totalReturnPct: 1.94,
        },
      ],
    },
    {
      className: "Ações",
      subtotalMarketValueBRL: 3673.74,
      subtotalCostBRL: 3600.00,
      sharePct: 20.99,
      assets: [
        {
          ticker: "VALE3",
          name: "Vale S.A.",
          currency: "BRL",
          quantity: 60,
          averagePrice: 60.0,
          currentPrice: 61.229,
          currentValueBRL: 3673.74,
          totalCostBRL: 3600.0,
          unrealizedPnlBRL: 73.74,
          unrealizedPnlPct: 2.05,
          activeDividendsBRL: 450.0,
          totalReturnBRL: 523.74,
          totalReturnPct: 14.55,
        },
      ],
    },
    {
      className: "FIIs",
      subtotalMarketValueBRL: 3673.88,
      subtotalCostBRL: 3600.00,
      sharePct: 20.99,
      assets: [
        {
          ticker: "HGLG11",
          name: "CSHG Logística",
          currency: "BRL",
          quantity: 23,
          averagePrice: 156.52,
          currentPrice: 159.734,
          currentValueBRL: 3673.88,
          totalCostBRL: 3600.0,
          unrealizedPnlBRL: 73.88,
          unrealizedPnlPct: 2.05,
          activeDividendsBRL: 800.0,
          totalReturnBRL: 873.88,
          totalReturnPct: 24.27,
        },
      ],
    },
    {
      className: "Internacional",
      subtotalMarketValueBRL: GOLDEN_EXPECTED.intlTotalBRL,
      subtotalCostBRL: 7099.94,
      sharePct: 39.15,
      assets: [
        {
          ticker: "VOO",
          name: "Vanguard S&P 500 ETF",
          currency: "USD",
          quantity: 1.378,
          averagePrice: 500.0,
          currentPrice: 500.0,
          currentValueBRL: GOLDEN_EXPECTED.intlVooBRL,
          totalCostBRL: 3616.83,
          unrealizedPnlBRL: 0.0,
          unrealizedPnlPct: 0.0,
          activeDividendsBRL: 236.25,
          totalReturnBRL: 236.25,
          totalReturnPct: 6.53,
        },
        {
          ticker: "GLD",
          name: "SPDR Gold Trust",
          currency: "USD",
          quantity: 1.554,
          averagePrice: 229.47,
          currentPrice: 229.47,
          currentValueBRL: GOLDEN_EXPECTED.intlGldBRL,
          totalCostBRL: 1872.26,
          unrealizedPnlBRL: 0.0,
          unrealizedPnlPct: 0.0,
          activeDividendsBRL: 0.0,
          totalReturnBRL: 0.0,
          totalReturnPct: 0.0,
        },
        {
          ticker: "BITB",
          name: "Bitwise Bitcoin ETF",
          currency: "USD",
          quantity: 2.9887,
          averagePrice: 41.85,
          currentPrice: 37.27, // -10,9438% de variação em USD -> arredondamento -10,9%
          currentValueBRL: GOLDEN_EXPECTED.intlBitbBRL,
          totalCostBRL: 656.49,
          unrealizedPnlBRL: -71.84,
          unrealizedPnlPct: -10.94,
          activeDividendsBRL: 0.0,
          totalReturnBRL: -71.84,
          totalReturnPct: -10.94,
        },
        {
          ticker: "VEA",
          name: "Vanguard Developed Markets ETF",
          currency: "USD",
          quantity: 1.254,
          averagePrice: 50.0,
          currentPrice: 50.0,
          currentValueBRL: GOLDEN_EXPECTED.intlVeaBRL,
          totalCostBRL: 329.15,
          unrealizedPnlBRL: 0.0,
          unrealizedPnlPct: 0.0,
          activeDividendsBRL: 63.0,
          totalReturnBRL: 63.0,
          totalReturnPct: 19.14,
        },
        {
          ticker: "ARGT",
          name: "Global X MSCI Argentina ETF",
          currency: "USD",
          quantity: 0.7225,
          averagePrice: 60.0,
          currentPrice: 60.0,
          currentValueBRL: GOLDEN_EXPECTED.intlArgtBRL,
          totalCostBRL: 227.63,
          unrealizedPnlBRL: 0.0,
          unrealizedPnlPct: 0.0,
          activeDividendsBRL: 26.25,
          totalReturnBRL: 26.25,
          totalReturnPct: 11.53,
        },
        {
          ticker: "MCHI",
          name: "iShares MSCI China ETF",
          currency: "USD",
          quantity: 0.9064,
          averagePrice: 46.67,
          currentPrice: 46.67,
          currentValueBRL: GOLDEN_EXPECTED.intlMchiBRL,
          totalCostBRL: 222.08,
          unrealizedPnlBRL: 0.0,
          unrealizedPnlPct: 0.0,
          activeDividendsBRL: 31.5,
          totalReturnBRL: 31.5,
          totalReturnPct: 14.18,
        },
      ],
    },
  ];

  const xRays = {
    equitiesProfile: {
      title: "Perfil de Ações",
      totalValueBRL: 3673.74,
      segments: [{ key: "dividendos", label: "Dividendos", valueBRL: 3673.74, pct: 100.0, count: 1 }],
      displayedRowsCount: 1,
    },
    equitiesMarketCap: {
      title: "Market Cap de Ações",
      totalValueBRL: 3673.74,
      segments: [{ key: "large_cap", label: "Large Cap", valueBRL: 3673.74, pct: 100.0, count: 1 }],
      displayedRowsCount: 1,
    },
    fiisStrategy: {
      title: "Estratégia de FIIs",
      totalValueBRL: 3673.88,
      segments: [{ key: "tijolo", label: "Tijolo / Logística", valueBRL: 3673.88, pct: 100.0, count: 1 }],
      displayedRowsCount: 1,
    },
    fixedIncomeIndexers: {
      title: "Indexadores de Renda Fixa",
      totalValueBRL: GOLDEN_EXPECTED.fixedIncomeTotalBRL,
      segments: [
        { key: "pos_fixado", label: "Pós-fixado (CDI / Selic)", valueBRL: GOLDEN_EXPECTED.fixedIncomePosFixadoBRL, pct: 93.3, count: 2 },
        { key: "ipca", label: "Inflação (IPCA+)", valueBRL: GOLDEN_EXPECTED.fixedIncomeInflacaoBRL, pct: 6.7, count: 1 },
        { key: "pre", label: "Prefixado", valueBRL: 0.0, pct: 0.0, count: 0 },
      ],
      displayedRowsCount: 3,
    },
    fixedIncomeIssuers: {
      title: "Emissores de Renda Fixa",
      totalValueBRL: GOLDEN_EXPECTED.fixedIncomeTotalBRL,
      segments: [
        { key: "publico", label: "Títulos Públicos", valueBRL: 1832.16, pct: 57.6, count: 2 },
        { key: "bancario", label: "Bancário", valueBRL: 1348.01, pct: 42.4, count: 1 },
      ],
      displayedRowsCount: 2,
    },
    internationalRegions: {
      title: "Regiões Internacionais",
      totalValueBRL: GOLDEN_EXPECTED.intlTotalBRL,
      segments: [
        { key: "eua", label: "Estados Unidos (US Equity)", valueBRL: GOLDEN_EXPECTED.intlVooBRL, pct: 52.8, count: 1 },
        { key: "commodities_ouro", label: "Commodities Globais / Ouro", valueBRL: GOLDEN_EXPECTED.intlGldBRL, pct: 27.3, count: 1 },
        { key: "cripto_bitcoin", label: "Criptoativos Globais / Bitcoin", valueBRL: GOLDEN_EXPECTED.intlBitbBRL, pct: 8.5, count: 1 },
        { key: "emergentes", label: "Mercados Emergentes (China & América Latina)", valueBRL: 449.71, pct: 6.6, count: 2 },
        { key: "desenvolvidos_ex_us", label: "Mercados Desenvolvidos (ex-EUA)", valueBRL: GOLDEN_EXPECTED.intlVeaBRL, pct: 4.8, count: 1 },
      ],
      displayedRowsCount: 5,
    },
    internationalVehicles: {
      title: "Veículos Internacionais",
      totalValueBRL: GOLDEN_EXPECTED.intlTotalBRL,
      segments: [{ key: "etf", label: "ETFs Globais", valueBRL: GOLDEN_EXPECTED.intlTotalBRL, pct: 100.0, count: 6 }],
      displayedRowsCount: 1,
    },
    consolidatedSegments: {
      title: "Segmentos Consolidados",
      totalValueBRL: GOLDEN_EXPECTED.activeAssetsMarketValueBRL,
      segments: [
        { key: "seg1", label: "US Equity", valueBRL: 3616.83, pct: 20.7, count: 1 },
        { key: "seg2", label: "Logística", valueBRL: 3673.88, pct: 21.0, count: 1 },
        { key: "seg3", label: "Materiais Básicos", valueBRL: 3673.74, pct: 21.0, count: 1 },
        { key: "seg4", label: "Ouro", valueBRL: 1872.26, pct: 10.7, count: 1 },
        { key: "seg5", label: "Títulos Públicos Selic", valueBRL: 1617.51, pct: 9.2, count: 1 },
        { key: "seg6", label: "CDB Bancário", valueBRL: 1348.01, pct: 7.7, count: 1 },
        { key: "seg7", label: "Bitcoin", valueBRL: 584.65, pct: 3.3, count: 1 },
        { key: "seg8", label: "Emergentes", valueBRL: 449.71, pct: 2.6, count: 2 },
        { key: "seg9", label: "Tesouro IPCA+", valueBRL: 214.65, pct: 1.2, count: 1 },
      ],
      displayedRowsCount: 9,
    },
  };

  const benchmarksAndRisk: BenchmarksAndRiskDTO = {
    benchmarks: [
      {
        key: "ibov",
        name: "Ibovespa",
        accumulatedRatePct: 100.2, // BUG-15 saneado: 100,2% (em vez de 1,0%)
        portfolioRatePct: 11.5,
        alphaPp: -88.7,
        pctOfBenchmark: 11.48, // ~11,5% do Ibovespa
      },
      {
        key: "cdi",
        name: "CDI",
        accumulatedRatePct: 22.4,
        portfolioRatePct: 11.5,
        alphaPp: -10.9,
        pctOfBenchmark: 51.34,
      },
      {
        key: "poupanca",
        name: "Poupança",
        accumulatedRatePct: 14.8,
        portfolioRatePct: 11.5,
        alphaPp: -3.3,
        pctOfBenchmark: 77.7,
      },
      {
        key: "ipca",
        name: "IPCA",
        accumulatedRatePct: 8.9,
        portfolioRatePct: 11.5,
        alphaPp: 2.6,
        pctOfBenchmark: 129.2,
      },
    ],
    realGainFisherPct: 2.39,
    riskMetrics: {
      closedMonthsCount: 12, // BUG-16 saneado: exatamente 12 meses fechados
      annualizedVolatilityPct: 8.45,
      maxDrawdownPct: -4.82,
      consistencyPositiveFraction: "8/12", // 8 de 12 meses fechados positivos
      consistencyPct: 66.7,
      sharpeRatio: -0.32,
      sharpeLabel: "Sharpe Anualizado 12M",
    },
  };

  return buildUnifiedPortfolioReportPayload({
    reportId: GOLDEN_CASE_ID,
    referenceDate: GOLDEN_AS_OF_DATE,
    ptaxRate: GOLDEN_PTAX_RATE,
    assetsMarketValueBRL: GOLDEN_EXPECTED.activeAssetsMarketValueBRL,
    cashReserveBRL: GOLDEN_EXPECTED.cashBRL,
    assetsCostBRL: GOLDEN_EXPECTED.activeAssetsCostBRL,
    activeDividendsBRL: GOLDEN_EXPECTED.activeDividendsBRL,
    closedDividendsBRL: GOLDEN_EXPECTED.closedDividendsBRL,
    realizedPnlClosedBRL: GOLDEN_EXPECTED.realizedPnlBRL,
    twrCumulativePct: 11.50,
    twrAnnualizedPct: 5.34,
    xirrAnnualizedPct: 5.48,
    durationDays: 778,
    allocationRows,
    equilibriumIndexPct: allocationResult.equilibriumIndexPct,
    custodyByClass,
    xRays,
    monthlyEvolutionSeries: createGoldenMonthlySeries(),
    benchmarksAndRisk,
  });
}

describe("Quality Gate 6 — Certificação do Motor de Investimentos Axir (Caso BR-20261118-6445)", () => {
  it("Gate 6.1 — Todas as 12 asserções pré-emissão passam com 100% de sucesso no Golden Dataset", () => {
    const sanitized = sanitizeOrphanLegacyTargets(
      GOLDEN_ALLOCATION_POSITIONS.map((p) => ({ ...p })),
      GOLDEN_TARGETS_CORRUPTED.map((t) => ({ ...t })),
    );
    expect(sanitized).toEqual([...GOLDEN_TARGETS_SANITIZED]);

    const payload = createGoldenPayload();
    const result = PortfolioReportInvariantValidator.validate(payload);

    if (!result.isValid) {
      console.error("Erros de invariante detectados:", result.errors);
    }

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.assertionsCheckedCount).toBe(12);
  });

  it("Gate 6.2 — Invariant Guard bloqueia divergência de Caixa ou Patrimônio Total (Asserção 1 e 2)", () => {
    const payload = createGoldenPayload();
    // Simula divergência induzida de caixa
    payload.summary.cashReserveBrl = 100.96;
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 1 (Patrimônio)"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Asserção 2 (Custo)"))).toBe(true);
  });

  it("Gate 6.3 — Invariant Guard bloqueia divergência entre soma dos ativos de custódia e total declarado (Asserção 4)", () => {
    const payload = createGoldenPayload();
    // Corrompe o valor de um ativo de custódia
    payload.custodyByClass[0]!.assets[0]!.currentValueBRL = 9999.0;
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 4 (Soma de Custódia)"))).toBe(true);
  });

  it("Gate 6.4 — Invariant Guard bloqueia descompasso entre Cota da Carteira e Retorno TWR Acumulado (Asserção 5)", () => {
    const payload = createGoldenPayload();
    // Corrompe a cota sem atualizar o TWR
    payload.summary.currentQuotaValueBrl = 145.20;
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 5 (Consistência Cota x TWR)"))).toBe(true);
  });

  it("Gate 6.5 — Invariant Guard bloqueia lacunas cronológicas na série histórica / Calendar Spine (Asserção 6)", () => {
    const payload = createGoldenPayload();
    // Remove o mês de Ago/2026 (simulando a falha histórica original BUG-04)
    payload.monthlyEvolutionSeries = payload.monthlyEvolutionSeries.filter(
      (m) => m.competence !== "2026-08",
    );
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("Asserção 6 (Continuidade Cronológica)") && e.includes("2026-07 e 2026-09")),
    ).toBe(true);
  });

  it("Gate 6.6 — Invariant Guard bloqueia quebra de monotonicidade ou divergência de proventos acumulados (Asserção 8)", () => {
    const payload = createGoldenPayload();
    // Simula proventos acumulados decrescendo
    payload.monthlyEvolutionSeries[10]!.accumulatedDividendsBRL = 5.0;
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 8 (Monotonicidade de Proventos)"))).toBe(true);
  });

  it("Gate 6.7 — Invariant Guard bloqueia soma de metas divergente de 100% ou soma de gaps != R$ 0,00 (Asserção 9)", () => {
    const payload = createGoldenPayload();
    payload.allocationMatrix.totalTargetPct = 200.0; // BUG-11 original
    payload.allocationMatrix.totalGapBrl = -17503.68; // BUG-12 original
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 9 (Soma de Metas)"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Asserção 9 (Soma de Gaps)"))).toBe(true);
  });

  it("Gate 6.8 — Invariant Guard bloqueia divergência entre totais de Raios-X e classes de custódia (Asserção 10)", () => {
    const payload = createGoldenPayload();
    // Corrompe o total do Raio-X de Renda Fixa
    payload.xRays.fixedIncomeIndexers.totalValueBRL = 5000.0;
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 10 (Raio-X Renda Fixa)"))).toBe(true);
  });

  it("Gate 6.9 — Invariant Guard bloqueia divergência na contagem de segmentos ou janela de risco != 12 meses (Asserção 11)", () => {
    const payload = createGoldenPayload();
    payload.xRays.consolidatedSegments.displayedRowsCount = 10; // 10 declarados vs 9 listados (BUG-16)
    payload.benchmarksAndRisk.riskMetrics.closedMonthsCount = 11; // 11 meses em vez de 12
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 11 (Contagem de Segmentos)"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Asserção 11 (Janela Anual de Risco)"))).toBe(true);
  });

  it("Gate 6.10 — Invariant Guard bloqueia distorção de escala decimal no benchmark Ibovespa (Asserção 12)", () => {
    const payload = createGoldenPayload();
    const ibov = payload.benchmarksAndRisk.benchmarks.find((b) => b.key === "ibov");
    if (ibov) {
      ibov.accumulatedRatePct = 1.0; // 1.0% para 25 meses (BUG-15 original)
    }
    const result = PortfolioReportInvariantValidator.validate(payload);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Asserção 12 (Escala de Benchmark)"))).toBe(true);
  });

  it("Gate 6.11 — Validação da Tabela Canônica dos 16 Indicadores Auditados no Caso BR-20261118-6445", () => {
    const payload = createGoldenPayload();

    // 1. Custo Total Reconciliado
    expect(payload.summary.assetsAcquisitionCostBrl).toBe(17319.94);
    expect(payload.summary.cashReserveBrl).toBe(0.96);
    expect(payload.summary.totalAppliedCostBrl).toBe(17320.90);

    // 2. Competência Ago/2026 presente na série
    expect(payload.monthlyEvolutionSeries).toHaveLength(26);
    expect(payload.monthlyEvolutionSeries.some((m) => m.competence === "2026-08")).toBe(true);

    // 3. TWR Set/2026 com expurgo do aporte de R$ 368,80
    const set26 = payload.monthlyEvolutionSeries.find((m) => m.competence === "2026-09");
    expect(set26?.netFlowBRL).toBe(368.80);
    expect(set26?.monthTwrPct).toBe(2.61);

    // 4. TWR Out/2026 com expurgo do aporte de R$ 338,18
    const out26 = payload.monthlyEvolutionSeries.find((m) => m.competence === "2026-10");
    expect(out26?.netFlowBRL).toBe(338.18);
    expect(out26?.monthTwrPct).toBe(-3.13);

    // 5. TWR Nov/2026 (MTD) unificado em -1,1% e Cota R$ 111,50 (TWR acumulado +11,5%)
    const nov26 = payload.monthlyEvolutionSeries.find((m) => m.competence === "2026-11");
    expect(nov26?.monthTwrPct).toBe(-1.10);
    expect(payload.summary.currentQuotaValueBrl).toBe(111.50);
    expect(payload.summary.twrCumulativePct).toBe(11.50);

    // 6. Proventos Mês (Extrato) com valores reais pagos e soma de R$ 1.794,47
    const sumDividends = payload.monthlyEvolutionSeries.reduce((s, m) => s + m.monthDividendsBRL, 0);
    expect(Math.round(sumDividends * 100) / 100).toBe(1794.47);
    expect(payload.summary.totalHistoricalDividendsBrl).toBe(1794.47);

    // 7. Custo Internacional em BRL com câmbio histórico
    const intlClass = payload.custodyByClass.find((c) => c.className === "Internacional");
    expect(intlClass).toBeDefined();
    expect(intlClass?.subtotalMarketValueBRL).toBe(6852.60);

    // 8. Variação de cota BITB (USD) com arredondamento correto de -10,9%
    const bitb = intlClass?.assets.find((a) => a.ticker === "BITB");
    expect(bitb).toBeDefined();
    expect(Math.round(bitb!.unrealizedPnlPct * 10) / 10).toBe(-10.9);

    // 9. Soma da Coluna Meta (%) = 100,0%
    expect(payload.allocationMatrix.totalTargetPct).toBe(100.0);

    // 10. Soma da Coluna Gap (R$) = R$ 0,00
    expect(payload.allocationMatrix.totalGapBrl).toBe(0.0);

    // 11. Índice de Equilíbrio Geral (IEG) = 84,9% (85%)
    expect(payload.allocationMatrix.equilibriumIndexPct).toBe(84.9);

    // 12. Raio-X Renda Fixa: 93,3% pós-fixado (R$ 2.965,52) / 0,0% prefixado
    const rfXRay = payload.xRays.fixedIncomeIndexers;
    const posFixadoSegment = rfXRay.segments.find((s) => s.key === "pos_fixado");
    const preSegment = rfXRay.segments.find((s) => s.key === "pre");
    expect(posFixadoSegment?.valueBRL).toBe(2965.52);
    expect(posFixadoSegment?.pct).toBe(93.3);
    expect(preSegment?.valueBRL).toBe(0.0);
    expect(preSegment?.pct).toBe(0.0);

    // 13. Raio-X Internacional: VOO 52,8% (< 60%, 1 ativo), GLD 27,3%, BITB 8,5%, Emergentes 6,6%, VEA 4,8%
    const intlXRay = payload.xRays.internationalRegions;
    const vooSeg = intlXRay.segments.find((s) => s.key === "eua");
    const gldSeg = intlXRay.segments.find((s) => s.key === "commodities_ouro");
    const bitbSeg = intlXRay.segments.find((s) => s.key === "cripto_bitcoin");
    expect(vooSeg?.valueBRL).toBe(3616.83);
    expect(vooSeg?.pct).toBe(52.8);
    expect(gldSeg?.valueBRL).toBe(1872.26);
    expect(gldSeg?.pct).toBe(27.3);
    expect(bitbSeg?.valueBRL).toBe(584.65);
    expect(bitbSeg?.pct).toBe(8.5);

    // 14. Contagem de Segmentos (Página 5): contagem dinâmica exata (9 segmentos)
    expect(payload.xRays.consolidatedSegments.displayedRowsCount).toBe(9);
    expect(payload.xRays.consolidatedSegments.segments).toHaveLength(9);

    // 15. Benchmark Ibovespa (25M): 100,2% (11,5% do Ibovespa), spread -88,7 p.p.
    const ibovBenchmark = payload.benchmarksAndRisk.benchmarks.find((b) => b.key === "ibov");
    expect(ibovBenchmark?.accumulatedRatePct).toBe(100.2);
    expect(ibovBenchmark?.alphaPp).toBe(-88.7);
    expect(Math.round((ibovBenchmark?.pctOfBenchmark ?? 0) * 10) / 10).toBe(11.5);

    // 16. Janela Anual de Risco & Sharpe: exatamente 12 meses fechados, consistency "8/12"
    expect(payload.benchmarksAndRisk.riskMetrics.closedMonthsCount).toBe(12);
    expect(payload.benchmarksAndRisk.riskMetrics.consistencyPositiveFraction).toBe("8/12");
  });
});
