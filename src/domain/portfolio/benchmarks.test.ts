import { describe, it, expect } from "vitest";
import {
  calculatePoupancaRate,
  compoundAnnualRateToPeriod,
  calculateConsolidatedBenchmarks,
} from "./benchmarks";

describe("benchmarks — Motor de Comparativos de Mercado", () => {
  describe("calculatePoupancaRate", () => {
    it("aplica regra de 0.5% a.m. (~6.17% a.a.) quando Selic > 8.5%", () => {
      const rate12m = calculatePoupancaRate(10.5, 12);
      expect(rate12m).toBe(6.17);
    });

    it("aplica 70% da Selic quando Selic <= 8.5%", () => {
      // Selic = 6.0% a.a. -> 70% = 4.2% a.a.
      const rate12m = calculatePoupancaRate(6.0, 12);
      expect(rate12m).toBe(4.2);
    });

    it("retorna 0 para 0 meses", () => {
      expect(calculatePoupancaRate(10.5, 0)).toBe(0);
    });
  });

  describe("compoundAnnualRateToPeriod", () => {
    it("converte taxa anualizada de 10.5% em taxa acumulada de 12 meses", () => {
      const res = compoundAnnualRateToPeriod(10.5, 12);
      expect(res).toBe(10.5);
    });

    it("converte taxa anualizada de 10.5% para período de 6 meses", () => {
      const res = compoundAnnualRateToPeriod(10.5, 6);
      expect(res).toBeGreaterThan(5.0);
      expect(res).toBeLessThan(5.5);
    });
  });

  describe("calculateConsolidatedBenchmarks", () => {
    it("gera comparativo completo com CDI, Poupança, IPCA e IBOVESPA", () => {
      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 15.0,
        monthsCount: 12,
        annualCdiRate: 10.5,
        annualSelicRate: 10.5,
        annualIpcaRate: 4.0,
        ibovPeriodRatePct: 12.0,
      });

      expect(res.items).toHaveLength(4);

      const cdi = res.items.find((i) => i.key === "cdi")!;
      expect(cdi.benchmarkRatePct).toBe(10.5);
      expect(cdi.alphaPct).toBe(4.5); // 15 - 10.5
      expect(cdi.pctOfBenchmark).toBe(142.9); // 15 / 10.5 = 142.9%
      expect(cdi.status).toBe("outperforming");

      const poupanca = res.items.find((i) => i.key === "poupanca")!;
      expect(poupanca.alphaPct).toBeGreaterThan(8);
      expect(poupanca.status).toBe("outperforming");

      const ipca = res.items.find((i) => i.key === "ipca")!;
      expect(ipca.benchmarkRatePct).toBe(4.0);

      // Juro Real Líquido: (1.15 / 1.04) - 1 = ~10.58%
      expect(res.realReturnPct).toBe(10.58);
    });

    it("calcula métricas de 12M e juro real 12M para a visão híbrida quando portfolio12mRatePct é informado", () => {
      const res = calculateConsolidatedBenchmarks({
        portfolioRatePct: 22.4, // Total desde o início
        monthsCount: 32,
        annualCdiRate: 10.5,
        portfolio12mRatePct: 12.8, // Janela recente 12M
        annualIpcaRate: 4.0,
      });

      const cdi = res.items.find((i) => i.key === "cdi")!;
      expect(cdi.benchmarkRatePct).toBeGreaterThan(25); // CDI acumulado em 32 meses
      expect(cdi.sub12m).toBeDefined();
      expect(cdi.sub12m?.portfolio12mRatePct).toBe(12.8);
      expect(cdi.sub12m?.benchmark12mRatePct).toBe(10.5);
      expect(cdi.sub12m?.alpha12mPct).toBe(2.3); // 12.8 - 10.5
      expect(cdi.sub12m?.pctOf12mBenchmark).toBe(121.9); // 12.8 / 10.5 = 121.9%

      // Juro Real Líquido 12M: (1.128 / 1.04) - 1 = 8.46%
      expect(res.realReturn12mPct).toBe(8.46);
    });
  });
});
