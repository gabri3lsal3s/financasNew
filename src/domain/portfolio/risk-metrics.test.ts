import { describe, it, expect } from "vitest";
import {
  calculateMaxDrawdown,
  calculateSampleVolatility,
  calculateConsistencyMetrics,
  calculateSharpeRatio,
  calculatePortfolioRiskSummary,
} from "./risk-metrics";

describe("risk-metrics — Motor de Risco & Consistência", () => {
  describe("calculateMaxDrawdown", () => {
    it("calcula max drawdown com pico e recuperação subsequente", () => {
      // 100 -> 120 (pico) -> 108 (-10%) -> 96 (-20%) -> 130 (novo pico)
      const values = [100, 120, 108, 96, 130];
      const res = calculateMaxDrawdown(values);

      expect(res.maxDrawdownPct).toBe(-20);
      expect(res.peakIndex).toBe(1); // 120
      expect(res.troughIndex).toBe(3); // 96
    });

    it("retorna 0 para série sem quedas (crescimento contínuo)", () => {
      const values = [100, 105, 110, 120];
      const res = calculateMaxDrawdown(values);
      expect(res.maxDrawdownPct).toBe(0);
    });

    it("retorna salvaguarda segura para série com menos de 2 elementos", () => {
      expect(calculateMaxDrawdown([]).maxDrawdownPct).toBe(0);
      expect(calculateMaxDrawdown([100]).maxDrawdownPct).toBe(0);
    });
  });

  describe("calculateSampleVolatility", () => {
    it("calcula desvio padrão mensal e anualizado com escalonamento por raiz de 12", () => {
      const rates = [1.0, 2.0, 3.0];
      const res = calculateSampleVolatility(rates);
      // Média = 2.0, variância amostral = ((1-2)^2 + (2-2)^2 + (3-2)^2) / 2 = 1.0. stdDev = 1.0
      expect(res.monthlyStdDevPct).toBe(1.0);
      // Anualizado = 1.0 * sqrt(12) = ~3.46%
      expect(res.annualizedStdDevPct).toBe(3.46);
    });

    it("retorna 0 para série de 1 elemento ou vazia", () => {
      expect(calculateSampleVolatility([]).monthlyStdDevPct).toBe(0);
      expect(calculateSampleVolatility([2.5]).annualizedStdDevPct).toBe(0);
    });
  });

  describe("calculateConsistencyMetrics", () => {
    it("calcula win rate, melhor e pior mês", () => {
      const rates = [1.2, 2.2, -2.0, 0.9, -0.4];
      const res = calculateConsistencyMetrics(rates);

      expect(res.totalMonths).toBe(5);
      expect(res.positiveMonths).toBe(3);
      expect(res.negativeMonths).toBe(2);
      expect(res.winRatePct).toBe(60); // 3/5 = 60%
      expect(res.bestMonthPct).toBe(2.2);
      expect(res.worstMonthPct).toBe(-2.0);
    });

    it("retorna 100% de win rate quando todos os meses forem positivos", () => {
      const rates = [1.0, 1.5, 0.5];
      const res = calculateConsistencyMetrics(rates);
      expect(res.winRatePct).toBe(100);
      expect(res.negativeMonths).toBe(0);
    });
  });

  describe("calculateSharpeRatio", () => {
    it("calcula o Sharpe anualizado quando o retorno supera o CDI", () => {
      const res = calculateSharpeRatio({
        annualizedReturnPct: 16.5,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 4.0,
        monthsCount: 12,
      });

      // Excess return = 16.5 - 10.5 = 6.0. Sharpe = 6.0 / 4.0 = 1.5
      expect(res.sharpeRatio).toBe(1.5);
      expect(res.sharpeLabel).toBe("Excepcional");
    });

    it("retorna null com label explicativo se histórico for inferior a 4 meses", () => {
      const res = calculateSharpeRatio({
        annualizedReturnPct: 15.0,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 3.0,
        monthsCount: 3,
      });

      expect(res.sharpeRatio).toBeNull();
      expect(res.sharpeLabel).toContain("Histórico Curto");
    });

    it("retorna null se a volatilidade for nula ou insignificante", () => {
      const res = calculateSharpeRatio({
        annualizedReturnPct: 12.0,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 0.02,
        monthsCount: 12,
      });

      expect(res.sharpeRatio).toBeNull();
      expect(res.sharpeLabel).toBe("Baixa Volatilidade");
    });
  });

  describe("calculatePortfolioRiskSummary", () => {
    it("consolida o resumo com sucesso a partir dos pontos da série", () => {
      const points = [
        { patrimonyBRL: 100000, ratePct: 1.2 },
        { patrimonyBRL: 102000, ratePct: 2.0 },
        { patrimonyBRL: 101000, ratePct: -1.0 },
        { patrimonyBRL: 105000, ratePct: 2.5 },
      ];

      const summary = calculatePortfolioRiskSummary(points, 10.5);

      expect(summary.consistency.totalMonths).toBe(4);
      expect(summary.consistency.positiveMonths).toBe(3);
      expect(summary.maxDrawdown.maxDrawdownPct).toBeLessThan(0);
      expect(summary.volatility.monthlyStdDevPct).toBeGreaterThan(0);
      expect(summary.sharpeLabel).toBeDefined();
    });
  });
});
