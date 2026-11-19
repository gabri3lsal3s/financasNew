/**
 * Portão de Qualidade v2.5 — Bloco 5: Benchmarks Reais & Bloco 6: Janela 12M de Risco
 *
 * Validações Canônicas:
 * 1. Encadeamento geométrico real de benchmarks (CDI, Poupança, IPCA, Ibovespa);
 * 2. Substituição de taxas anuais fixas por séries históricas reais nos 26 meses do caso BR-20261118-6445;
 * 3. Juro Real Líquido de Fisher calculado com o IPCA real encadeado;
 * 4. Janela estrita de N = 12 meses fechados para Volatilidade, Sharpe e Consistência (eliminando o defeito 4/11 meses);
 * 5. Simetria de Max Drawdown avaliado sobre a mesma janela de 12 meses fechados.
 */

import { describe, it, expect } from "vitest";
import {
  calculateChainedHistoricalBenchmarks,
  calculateConsolidatedBenchmarks,
  HISTORICAL_BENCHMARKS_MONTHLY,
} from "@/domain/portfolio/benchmarks";
import {
  calculatePortfolioRiskSummary,
} from "@/domain/portfolio/risk-metrics";

describe("Portão de Qualidade v2.5 — Benchmarks Reais & Janela 12M de Risco", () => {
  const goldenMonths = [
    "2024-10", "2024-11", "2024-12",
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
  ];

  describe("Bloco 5 — Benchmarks Reais (Produtório Geométrico)", () => {
    it("possui dados cadastrados para todos os 26 meses do caso BR-20261118-6445", () => {
      for (const m of goldenMonths) {
        expect(HISTORICAL_BENCHMARKS_MONTHLY[m]).toBeDefined();
        const entry = HISTORICAL_BENCHMARKS_MONTHLY[m]!;
        expect(Number.isFinite(entry.cdiPct)).toBe(true);
        expect(Number.isFinite(entry.poupancaPct)).toBe(true);
        expect(Number.isFinite(entry.ipcaPct)).toBe(true);
        expect(Number.isFinite(entry.ibovPct)).toBe(true);
      }
    });

    it("calcula encadeamento geométrico real para os 26 meses da carteira", () => {
      const chained = calculateChainedHistoricalBenchmarks(goldenMonths);
      expect(chained.hasRealSeries).toBe(true);

      // Verificação de plausibilidade econômica sobre 26 meses:
      // CDI médio ~0.95% a.m. -> em 26 meses acumula ~27% a 30%
      expect(chained.cdiRatePct).toBeGreaterThan(25.0);
      expect(chained.cdiRatePct).toBeLessThan(35.0);

      // Poupança ~0.58% a.m. -> em 26 meses acumula ~15% a 18%
      expect(chained.poupancaRatePct).toBeGreaterThan(14.0);
      expect(chained.poupancaRatePct).toBeLessThan(20.0);

      // IPCA acumula ~10% a 14%
      expect(chained.ipcaRatePct).toBeGreaterThan(9.0);
      expect(chained.ipcaRatePct).toBeLessThan(15.0);

      // Ibovespa encadeado real
      expect(Number.isFinite(chained.ibovRatePct)).toBe(true);
    });

    it("alimenta calculateConsolidatedBenchmarks com séries reais quando monthsList é fornecido", () => {
      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 22.4,
        monthsCount: goldenMonths.length,
        monthsList: goldenMonths,
        portfolio12mRatePct: 11.5,
      });

      expect(res.items).toHaveLength(4);
      const cdi = res.items.find((i) => i.key === "cdi")!;
      const poupanca = res.items.find((i) => i.key === "poupanca")!;
      const ipca = res.items.find((i) => i.key === "ipca")!;
      const ibov = res.items.find((i) => i.key === "ibov")!;

      expect(cdi.benchmarkRatePct).toBeGreaterThan(25.0);
      expect(poupanca.benchmarkRatePct).toBeGreaterThan(14.0);
      expect(ipca.benchmarkRatePct).toBeGreaterThan(9.0);
      expect(Number.isFinite(ibov.benchmarkRatePct)).toBe(true);

      // Sub12m usa os últimos 12 meses encadeados
      expect(cdi.sub12m).toBeDefined();
      expect(cdi.sub12m?.portfolio12mRatePct).toBe(11.5);
      expect(cdi.sub12m?.benchmark12mRatePct).toBeGreaterThan(10.0);

      // Juro Real Líquido de Fisher: ((1 + R_carteira) / (1 + IPCA)) - 1
      const expectedReal = ((1 + 22.4 / 100) / (1 + ipca.benchmarkRatePct / 100) - 1) * 100;
      expect(Math.abs(res.realReturnPct - expectedReal)).toBeLessThan(0.05);
    });

    it("preserva fallback exato quando monthsList não é informado (compatibilidade total)", () => {
      const resFallback = calculateConsolidatedBenchmarks({
        portfolioRatePct: 15.0,
        monthsCount: 12,
        annualCdiRate: 10.5,
      });

      const cdi = resFallback.items.find((i) => i.key === "cdi")!;
      expect(cdi.benchmarkRatePct).toBe(10.5);
    });
  });

  describe("Bloco 6 — Janela Estrita de 12M e Simetria de Risco", () => {
    // 12 meses fechados simulados + 1 mês MTD
    const trailing12ClosedPoints = [
      { patrimonyBRL: 16000, ratePct: 1.2 }, // Nov/25
      { patrimonyBRL: 16200, ratePct: 1.5 }, // Dez/25
      { patrimonyBRL: 16400, ratePct: -0.5 }, // Jan/26
      { patrimonyBRL: 16500, ratePct: 2.1 }, // Fev/26
      { patrimonyBRL: 16700, ratePct: 1.8 }, // Mar/26
      { patrimonyBRL: 16600, ratePct: -1.2 }, // Abr/26
      { patrimonyBRL: 16800, ratePct: 2.5 }, // Mai/26
      { patrimonyBRL: 17000, ratePct: 1.0 }, // Jun/26
      { patrimonyBRL: 17200, ratePct: 0.9 }, // Jul/26
      { patrimonyBRL: 17200, ratePct: 0.0 }, // Ago/26
      { patrimonyBRL: 17500, ratePct: 2.58 }, // Set/26
      { patrimonyBRL: 17400, ratePct: -3.10 }, // Out/26
    ];

    const mtdPoint = { patrimonyBRL: 17358.36, ratePct: -5.54, isMtd: true }; // Nov/26 MTD

    it("garante consistência calculada estritamente sobre N = 12 meses fechados (eliminando o defeito 4/11)", () => {
      const summary = calculatePortfolioRiskSummary(trailing12ClosedPoints, 10.5, {
        useTrailing12Months: true,
      });

      expect(summary.consistency.totalMonths).toBe(12);
      // No dataset acima: meses >= 0: 1.2, 1.5, 2.1, 1.8, 2.5, 1.0, 0.9, 0.0, 2.58 (9 meses)
      expect(summary.consistency.positiveMonths).toBe(9);
      expect(summary.consistency.negativeMonths).toBe(3);
      expect(summary.consistency.winRatePct).toBe(75.0);
    });

    it("mantém simetria de Max Drawdown na janela fechada sem contaminação pelo MTD", () => {
      const summaryClosed = calculatePortfolioRiskSummary(trailing12ClosedPoints, 10.5, {
        useTrailing12Months: true,
        includeMtdInDrawdown: false,
      });

      // Max drawdown nos 12 meses fechados
      expect(summaryClosed.maxDrawdown.maxDrawdownPct).toBeLessThan(0);
      expect(summaryClosed.maxDrawdown.maxDrawdownPct).toBeGreaterThan(-6.0);

      // Se incluísse o MTD (-5.54%), o drawdown seria muito mais profundo (~ -8% ou mais)
      const summaryWithMtd = calculatePortfolioRiskSummary([...trailing12ClosedPoints, mtdPoint], 10.5, {
        useTrailing12Months: true,
        includeMtdInDrawdown: true,
      });

      expect(summaryWithMtd.maxDrawdown.maxDrawdownPct).toBeLessThan(summaryClosed.maxDrawdown.maxDrawdownPct);
    });

    it("calcula Sharpe Ratio consistente confrontando 12 meses fechados contra CDI anual de 12 meses", () => {
      const summary = calculatePortfolioRiskSummary(trailing12ClosedPoints, 10.5, {
        useTrailing12Months: true,
      });

      expect(summary.sharpeRatio).not.toBeNull();
      expect(typeof summary.sharpeRatio).toBe("number");
      expect(summary.sharpeLabel).toBeDefined();
      expect(summary.volatility.annualizedStdDevPct).toBeGreaterThan(0);
    });
  });
});
