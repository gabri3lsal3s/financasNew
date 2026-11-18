/**
 * Suíte de Testes Automatizados — Portão de Qualidade 5 (Gate 5)
 * Padrão CFA Institute & ANBIMA / CVM
 * Caso Canônico BR-20261118-6445 (Data-base: 18/11/2026)
 *
 * Validações Obrigatórias:
 * 1. Correção do erro de escala decimal no Ibovespa (BUG-15): 1.00165 renderizado como 100,2% e não 1,0%.
 * 2. Cálculo exato do Ganho Real pela Equação de Fisher sobre o TWR canônico único (+11,5%).
 * 3. Janela anual de métricas de risco com N = 12 meses fechados consecutivos (X/12 meses, sem 5/11).
 * 4. Consistência dimensional rigorosa no Índice de Sharpe anualizado.
 * 5. Salvaguarda estatística contra benchmarks negativos.
 */

import { describe, expect, it } from "vitest";
import {
  calculateConsolidatedBenchmarks,
  compoundAnnualRateToPeriod,
} from "@/domain/portfolio/benchmarks";
import {
  calculateMaxDrawdown,
  calculatePortfolioRiskSummary,
  calculateSharpeRatio,
} from "@/domain/portfolio/risk-metrics";
import { formatPercent } from "@/services/masks";

describe("Portão de Qualidade 5 (Gate 5) — Benchmarks e Métricas de Risco CFA/ANBIMA", () => {
  describe("Critério 1: Escala e Normalização de Benchmarks (BUG-15)", () => {
    it("não permite erro de escala decimal de 100x no Ibovespa (1.00165 -> 100,2% e não 1,0%)", () => {
      // No caso BR-20261118-6445, horizonte de 25 meses e taxa decimal unitária de 1.00165
      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 11.5, // Retorno da carteira (+11,5%)
        monthsCount: 25,
        ibovPeriodRatePct: 1.00165, // Taxa unitária decimal passada
      });

      const ibov = res.items.find((i) => i.key === "ibov");
      expect(ibov).toBeDefined();

      // No bug anterior, exibia 1,0% e performance de 1.148,0% do Ibovespa!
      expect(ibov?.benchmarkRatePct).not.toBeCloseTo(1.0, 1);
      expect(ibov?.benchmarkRatePct).toBeCloseTo(100.165, 2);

      // Renderização visual deve ser 100,2%
      const renderedIbovPct = formatPercent(ibov?.benchmarkRatePct ?? 0);
      expect(renderedIbovPct).toBe("100,2");

      // % do Benchmark deve ser ~11,5% do índice (e NÃO 1.148,0%!)
      expect(ibov?.pctOfBenchmark).toBeLessThan(100.0);
      expect(ibov?.pctOfBenchmark).toBeCloseTo(11.5, 1);

      // Spread deve ser negativo frente aos 100,2% da bolsa: 11,5 - 100,2 = -88,7 p.p.
      expect(ibov?.alphaPct).toBe(-88.7);
    });

    it("suprime % do benchmark quando o índice de mercado for negativo (salvaguarda CFA)", () => {
      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 5.0,
        monthsCount: 12,
        ibovPeriodRatePct: -8.5, // Ibovespa em queda
      });

      const ibov = res.items.find((i) => i.key === "ibov");
      expect(ibov?.benchmarkRatePct).toBe(-8.5);
      // Razão % do benchmark deve ser nula para não induzir interpretação errônea
      expect(ibov?.pctOfBenchmark).toBeNull();
      // Mas o spread alfa positivo em p.p. é preservado: 5.0 - (-8.5) = +13.5 p.p.
      expect(ibov?.alphaPct).toBe(13.5);
    });
  });

  describe("Critério 2: Equação Exata de Fisher para o Ganho Real", () => {
    it("calcula o ganho real de poder de compra pela Equação de Fisher rigorosa", () => {
      // Carteira = +11,5%, Inflação IPCA = 8,4% acumulada no período
      const annualIpca = 4.0;
      const months = 25;
      const ipcaAccumulated = compoundAnnualRateToPeriod(annualIpca, months);

      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 11.5,
        monthsCount: months,
        annualIpcaRate: annualIpca,
      });

      // Fisher: (1 + 0.115) / (1 + ipcaAccumulated/100) - 1
      const expectedReal = ((1 + 11.5 / 100) / (1 + ipcaAccumulated / 100) - 1) * 100;
      expect(res.realReturnPct).toBeCloseTo(expectedReal, 2);
      expect(res.realReturnPct).toBeGreaterThan(0);
    });
  });

  describe("Critério 3 & 4: Janela Anual de Risco e Índice de Sharpe Dimensional (BUG-16)", () => {
    it("garante janela anual de risco com exatamente 12 meses fechados (sem buracos como 5/11)", () => {
      // Simula a série de 25 meses fechados (Out/2024 a Out/2026) + 1 mês MTD (Nov/2026)
      const monthlyPoints = [
        ...Array.from({ length: 25 }, (_, i) => ({
          patrimonyBRL: 10000 + i * 300,
          ratePct: i % 2 === 0 ? 1.2 : -0.4,
          isMtd: false,
        })),
        {
          patrimonyBRL: 17503.68,
          ratePct: -1.1,
          isMtd: true, // Mês parcial segregado
        },
      ];

      const riskSummary = calculatePortfolioRiskSummary(monthlyPoints, 10.5, {
        useTrailing12Months: true,
      });

      // A consistência deve computar exatamente 12 meses na janela anual
      expect(riskSummary.consistency.totalMonths).toBe(12);
      expect(riskSummary.consistency.positiveMonths).toBeGreaterThan(0);
      expect(riskSummary.consistency.negativeMonths).toBeGreaterThan(0);
      expect(riskSummary.consistency.positiveMonths + riskSummary.consistency.negativeMonths).toBe(12);

      // Volatilidade deve ser positiva e anualizada por sqrt(12)
      expect(riskSummary.volatility.monthlyStdDevPct).toBeGreaterThan(0);
      expect(riskSummary.volatility.annualizedStdDevPct).toBeCloseTo(
        riskSummary.volatility.monthlyStdDevPct * Math.sqrt(12),
        1,
      );
    });

    it("calcula o Índice de Sharpe com numerador e denominador rigorosamente na base anualizada", () => {
      // Exemplo: Retorno anual da carteira = 14,0% a.a., CDI = 10,5% a.a., Volatilidade = 3,5% a.a.
      const sharpeResult = calculateSharpeRatio({
        annualizedReturnPct: 14.0,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 3.5,
        monthsCount: 12,
      });

      // Excess return = 14.0 - 10.5 = 3.5. Sharpe = 3.5 / 3.5 = 1.00
      expect(sharpeResult.sharpeRatio).toBe(1.0);
      expect(sharpeResult.sharpeLabel).toBe("Excelente Eficiência");
    });

    it("atribui rótulo qualitativo e salvaguarda quando o retorno fica abaixo do CDI", () => {
      const sharpeUnderperforming = calculateSharpeRatio({
        annualizedReturnPct: 6.5,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 4.0,
        monthsCount: 12,
      });

      // Excess return = 6.5 - 10.5 = -4.0. Sharpe = -4.0 / 4.0 = -1.0
      expect(sharpeUnderperforming.sharpeRatio).toBe(-1.0);
      expect(sharpeUnderperforming.sharpeLabel).toBe("Abaixo do CDI");
    });

    it("salvaguarda períodos curtos (< 4 meses) e volatilidade nula retornando null no Sharpe", () => {
      const shortHistory = calculateSharpeRatio({
        annualizedReturnPct: 15.0,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 5.0,
        monthsCount: 3, // < 4 meses
      });
      expect(shortHistory.sharpeRatio).toBeNull();
      expect(shortHistory.sharpeLabel).toBe("Histórico Curto (< 4m)");

      const zeroVol = calculateSharpeRatio({
        annualizedReturnPct: 15.0,
        riskFreeRatePct: 10.5,
        annualizedStdDevPct: 0.02, // <= 0.05%
        monthsCount: 12,
      });
      expect(zeroVol.sharpeRatio).toBeNull();
      expect(zeroVol.sharpeLabel).toBe("Baixa Volatilidade");
    });
  });

  describe("Critério 5: Max Drawdown Nominal vs. Curva de Cotas", () => {
    it("calcula o Max Drawdown a partir da curva de cotas imune a distorções de aportes", () => {
      // Simula uma cota que atinge pico de 120 e cai para 108 -> Queda de 10%
      const unitValues = [100, 110, 120, 114, 108, 115];
      const dd = calculateMaxDrawdown(unitValues);

      // (108 - 120) / 120 = -10.0%
      expect(dd.maxDrawdownPct).toBe(-10.0);
      expect(dd.peakIndex).toBe(2);
      expect(dd.troughIndex).toBe(4);
    });
  });
});
