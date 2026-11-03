import { describe, expect, it } from "vitest";
import { annualizeRateFromDays } from "@/domain/portfolio/twr";
import { normalizePercentagesTo100 } from "@/domain/reports/distribution";
import { calculatePortfolioRiskSummary } from "@/domain/portfolio/risk-metrics";
import { calculateConsolidatedBenchmarks } from "@/domain/portfolio/benchmarks";
import { buildAllocationDonutSegments } from "@/domain/reports/allocation-donuts";
import { calculatePointInTimePosition } from "@/domain/portfolio/point-in-time";
import type { PortfolioAsset, PortfolioTransaction, PortfolioDividend } from "@/types";

describe("Fase 7 — Testes Integrados Parametrizados de Regressão Financeira", () => {
  it("Cenário 1: Carteira Auditada em 03/11/2026 (978 dias, 34 competências, TWR +22,4% -> +7,8% a.a.)", () => {
    // 1. TWR anualizado com contagem de dias exatos
    const daysElapsed = 978;
    const accumulatedRatePct = 22.4;
    const annualizedTwr = annualizeRateFromDays(accumulatedRatePct, daysElapsed);

    // (1 + 0.224)^(365 / 978) - 1 = 7.84%
    expect(annualizedTwr).not.toBeNull();
    expect(annualizedTwr).toBeCloseTo(7.84, 1);
    expect(annualizedTwr?.toFixed(1)).toBe("7.8");

    // 2. Soma de percentuais das classes fechando em exatamente 100,0%
    const rawClassPcts = [
      { rawPct: 38.44, name: "Ações" },
      { rawPct: 24.86, name: "FIIs" },
      { rawPct: 18.22, name: "Internacional" },
      { rawPct: 17.94, name: "Renda Fixa" },
      { rawPct: 0.54, name: "Caixa" },
    ];
    const normalizedClasses = normalizePercentagesTo100(rawClassPcts, 1);
    const sumClasses = normalizedClasses.reduce((acc, c) => acc + c.formattedPct, 0);
    expect(Math.round(sumClasses * 10) / 10).toBe(100.0);

    // 3. Volatilidade e Sharpe calculados sobre 33 meses fechados (excluindo MTD de 3 dias)
    const series34Points = Array.from({ length: 33 }, (_, i) => ({
      patrimonyBRL: 80000 + i * 800,
      ratePct: (i % 2 === 0 ? 1.2 : -0.4),
      isMtd: false,
    }));
    // 34º mês é o mês corrente parcial (MTD)
    series34Points.push({
      patrimonyBRL: 106107.27,
      ratePct: 0.15,
      isMtd: true,
    });

    const riskSummary = calculatePortfolioRiskSummary(series34Points, 10.5, {
      hasPartialCurrentMonth: true,
    });

    expect(riskSummary.volatility.monthlyStdDevPct).toBeGreaterThan(0);
    expect(riskSummary.sharpeRatio).not.toBeNull();

    // 4. Desacoplamento de Caixa dos Setores Econômicos
    const rawPositions = [
      { assetClass: "Ações", sector: "Tecnologia", valueBRL: 30000 },
      { assetClass: "FIIs", sector: "Logística", valueBRL: 25000 },
      { assetClass: "Ações", sector: "Financeiro", valueBRL: 20000 },
    ];
    const donutResult = buildAllocationDonutSegments({
      positions: rawPositions,
      cashBalanceBRL: 500,
      includeCash: true,
    });

    // 3 setores reais, Caixa não contamina a lista de setores produtivos
    expect(donutResult.totalUniqueSectors).toBe(3);
    const cashSectorSeg = donutResult.sectorSegments.find((s) => s.label === "Reserva de Caixa");
    expect(cashSectorSeg).toBeDefined();
    expect(cashSectorSeg?.color).toBe("#10b981");
  });

  it("Cenário 2: Usuário Iniciante (< 365 dias) — Salvaguarda CVM/ANBIMA sem divisão por zero", () => {
    // 90 dias de histórico
    const shortDays = 90;
    const accumulatedRatePct = 3.5;
    const annualizedTwr = annualizeRateFromDays(accumulatedRatePct, shortDays);

    // Deve retornar null com salvaguarda
    expect(annualizedTwr).toBeNull();

    // Sharpe com histórico inferior a 4 meses
    const shortSeries = [
      { patrimonyBRL: 1000, ratePct: 1.0 },
      { patrimonyBRL: 1020, ratePct: 2.0 },
      { patrimonyBRL: 1050, ratePct: 0.5 },
    ];
    const riskSummary = calculatePortfolioRiskSummary(shortSeries, 10.5);
    expect(riskSummary.sharpeRatio).toBeNull();
    expect(riskSummary.sharpeLabel).toContain("Histórico Curto");
  });

  it("Cenário 3: Fechamento Mensal Retroativo Efetivo — Ponto-no-tempo 100% fechado", () => {
    const assets: PortfolioAsset[] = [
      {
        id: "ast-petr4",
        user_id: "user-1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
      },
    ];

    const transactions: PortfolioTransaction[] = [
      {
        id: "tx-buy-1",
        user_id: "user-1",
        asset_id: "ast-petr4",
        type: "buy",
        quantity: 100,
        price: 30,
        total: 3000,
        date: "2026-08-15",
      },
      // Compra feita no mês seguinte (não deve entrar no fechamento de 2026-08)
      {
        id: "tx-buy-2",
        user_id: "user-1",
        asset_id: "ast-petr4",
        type: "buy",
        quantity: 50,
        price: 35,
        total: 1750,
        date: "2026-09-10",
      },
    ];

    const dividends: PortfolioDividend[] = [];
    const monthlyPrices = [
      {
        id: "mp-1",
        user_id: "user-1",
        ticker: "PETR4",
        month: "2026-08",
        price: 34,
        currency: "BRL" as const,
        source: "api" as const,
      },
    ];

    const pitResult = calculatePointInTimePosition({
      month: "2026-08",
      assets,
      transactions,
      dividends,
      monthlyPrices,
      apiPrices: {},
      annualCdiRate: 10.5,
      cashBalance: 1500,
    });

    // Posição no fechamento de agosto/2026: 100 unidades a R$ 34,00
    expect(pitResult.positions).toHaveLength(1);
    expect(pitResult.positions[0]?.quantity).toBe(100);
    expect(pitResult.positions[0]?.valueBRL).toBe(3400);
    expect(pitResult.totalCostBRL).toBe(3000);
    expect(pitResult.cashQuantity).toBe(1500);
    expect(pitResult.totalValueBRL).toBe(4900);
  });

  it("Cenário 4: Carteira Puramente Doméstica — Ausência de Ruídos Cambiais e Benchmarks Híbridos", () => {
    const benchmarks = calculateConsolidatedBenchmarks({
      portfolioRatePct: 15.0,
      monthsCount: 12,
      annualCdiRate: 10.5,
      annualSelicRate: 10.5,
      annualIpcaRate: 4.0,
      portfolio12mRatePct: 15.0,
    });

    expect(benchmarks.items.length).toBe(4);
    const cdiBm = benchmarks.items.find((b) => b.key === "cdi");
    expect(cdiBm).toBeDefined();
    expect(cdiBm?.alphaPct).toBeGreaterThan(0);
    expect(cdiBm?.status).toBe("outperforming");
    expect(benchmarks.realReturnPct).toBeGreaterThan(0);
  });
});
