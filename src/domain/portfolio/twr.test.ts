import { describe, expect, it } from "vitest";
import {
  annualizeRateFromMonths,
  calculateTwrSeries,
  compoundMonthlyRates,
  type TwrMonthlyInputPoint,
} from "./twr";

describe("TWR — Time-Weighted Return (Padrão CVM/ANBIMA)", () => {
  const realPortfolioData: TwrMonthlyInputPoint[] = [
    { month: "2024-02", totalValueBRL: 4057.1, totalCostBRL: 4048.26, explicitRatePct: 0.43 },
    { month: "2024-03", totalValueBRL: 6783.04, totalCostBRL: 6721.18, explicitRatePct: 1.11 },
    { month: "2024-04", totalValueBRL: 7019.55, totalCostBRL: 7045.29, explicitRatePct: -0.8 },
    { month: "2024-05", totalValueBRL: 12572.85, totalCostBRL: 12524.72, explicitRatePct: 0.95 },
    { month: "2024-06", totalValueBRL: 16882.4, totalCostBRL: 16727.6, explicitRatePct: 1.14 },
    { month: "2024-07", totalValueBRL: 17267.08, totalCostBRL: 16898.86, explicitRatePct: 1.57 },
    { month: "2024-08", totalValueBRL: 24155.39, totalCostBRL: 23523.56, explicitRatePct: 1.77 },
    { month: "2024-09", totalValueBRL: 24010.73, totalCostBRL: 23523.56, explicitRatePct: -0.36 },
    { month: "2024-10", totalValueBRL: 57186.6, totalCostBRL: 56817.17, explicitRatePct: -0.46 },
    { month: "2024-11", totalValueBRL: 63760.97, totalCostBRL: 63250.9, explicitRatePct: 0.46 },
    { month: "2024-12", totalValueBRL: 63203.7, totalCostBRL: 62933.45, explicitRatePct: -0.54 },
    { month: "2025-01", totalValueBRL: 76681.42, totalCostBRL: 76101.51, explicitRatePct: 1.0 },
    { month: "2025-02", totalValueBRL: 78303.81, totalCostBRL: 77864.99, explicitRatePct: 0.2 },
    { month: "2025-03", totalValueBRL: 79617.04, totalCostBRL: 78050.46, explicitRatePct: 2.21 },
    { month: "2025-04", totalValueBRL: 81378.29, totalCostBRL: 78302.06, explicitRatePct: 2.23 },
    { month: "2025-05", totalValueBRL: 82242.56, totalCostBRL: 78302.06, explicitRatePct: 1.29 },
    { month: "2025-06", totalValueBRL: 83597.37, totalCostBRL: 78868.32, explicitRatePct: 1.45 },
    { month: "2025-07", totalValueBRL: 82899.42, totalCostBRL: 79395.0, explicitRatePct: -0.99 },
    { month: "2025-08", totalValueBRL: 93648.48, totalCostBRL: 89225.94, explicitRatePct: 1.03 },
    { month: "2025-09", totalValueBRL: 95665.05, totalCostBRL: 89723.46, explicitRatePct: 1.97 },
    { month: "2025-10", totalValueBRL: 101061.69, totalCostBRL: 94062.49, explicitRatePct: 1.24 },
    { month: "2025-11", totalValueBRL: 94277.77, totalCostBRL: 86731.98, explicitRatePct: 2.16 },
    { month: "2025-12", totalValueBRL: 96197.43, totalCostBRL: 87144.27, explicitRatePct: 2.02 },
    { month: "2026-01", totalValueBRL: 98044.28, totalCostBRL: 87144.27, explicitRatePct: 2.04 },
    { month: "2026-02", totalValueBRL: 99421.18, totalCostBRL: 88187.35, explicitRatePct: 1.12 },
    { month: "2026-03", totalValueBRL: 104601.22, totalCostBRL: 95850.22, explicitRatePct: -2.0 },
    { month: "2026-04", totalValueBRL: 105216.73, totalCostBRL: 96768.49, explicitRatePct: -0.06 },
    { month: "2026-05", totalValueBRL: 104018.57, totalCostBRL: 96768.49, explicitRatePct: -0.77 },
    { month: "2026-06", totalValueBRL: 101902.32, totalCostBRL: 95768.49, explicitRatePct: -0.41 },
    { month: "2026-07", totalValueBRL: 102846.08, totalCostBRL: 95768.49, explicitRatePct: 1.06 },
    { month: "2026-08", totalValueBRL: 103761.29, totalCostBRL: 95768.49, explicitRatePct: 1.19 },
    { month: "2026-09", totalValueBRL: 103345.38, totalCostBRL: 94532.22, explicitRatePct: 0.86 },
  ];

  describe("compoundMonthlyRates", () => {
    it("retorna 0 para array vazio", () => {
      expect(compoundMonthlyRates([])).toBe(0);
    });

    it("encadeia taxas simples corretamente", () => {
      // 10% seguido de 10% = 21%
      expect(compoundMonthlyRates([10, 10])).toBe(21);
    });

    it("encadeia taxas positivas e negativas", () => {
      // +10% e depois -10% = -1% (1.1 * 0.9 = 0.99)
      expect(compoundMonthlyRates([10, -10])).toBe(-1);
    });
  });

  describe("annualizeRateFromMonths", () => {
    it("não anualiza séries com menos de 12 meses (salvaguarda de ruído)", () => {
      expect(annualizeRateFromMonths(10, 6)).toBeNull();
      expect(annualizeRateFromMonths(5, 11)).toBeNull();
    });

    it("anualiza exatamente para 12 meses", () => {
      expect(annualizeRateFromMonths(12.68, 12)).toBe(12.68);
    });

    it("anualiza corretamente para prazos maiores (ex: 24 meses)", () => {
      // 21% em 24 meses -> 10% a.a.
      expect(annualizeRateFromMonths(21, 24)).toBe(10);
    });
  });

  describe("calculateTwrSeries com dados reais da carteira (32 meses: Fev/2024 a Set/2026)", () => {
    it("calcula exatamente o acumulado de 26,92% e anualizado de 9,35% a.a.", () => {
      const result = calculateTwrSeries(realPortfolioData);

      expect(result.status).toBe("ok");
      expect(result.monthsElapsed).toBe(32);
      expect(result.accumulatedRatePct).toBe(26.92);
      expect(result.annualizedRatePct).toBe(9.35);
      expect(result.currentSharePrice).toBe(126.92);
      expect(result.series).toHaveLength(32);
    });

    it("preserva a cota e a rentabilidade positiva em Nov/2025 apesar da queda de saldo bruto por resgate", () => {
      const result = calculateTwrSeries(realPortfolioData);
      const out2025 = result.series.find((s) => s.month === "2025-10");
      const nov2025 = result.series.find((s) => s.month === "2025-11");

      expect(out2025).toBeDefined();
      expect(nov2025).toBeDefined();

      // Saldo bruto caiu de 101k para 94k por causa do resgate
      expect(nov2025!.totalValueBRL).toBeLessThan(out2025!.totalValueBRL);

      // Mas o valor da cota subiu (+2,16%), mantendo a integridade da rentabilidade
      expect(nov2025!.monthRatePct).toBe(2.16);
      expect(nov2025!.sharePrice).toBeGreaterThan(out2025!.sharePrice);
      expect(nov2025!.accumulatedRatePct).toBeGreaterThan(out2025!.accumulatedRatePct);
    });
  });

  describe("calculateTwrSeries com snapshots puros (sem explicitRatePct — derivação Modified Dietz)", () => {
    it("calcula rentabilidade constante com aportes sem inflar a taxa de retorno", () => {
      // Mês 1: Saldo 10.000 (Cota 100)
      // Mês 2: Rendeu 10% (11.000) e recebeu aporte de 5.000 no meio do mês -> Saldo final 16.000
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-01", totalValueBRL: 10000 },
        { month: "2026-02", totalValueBRL: 16000, netExternalCashFlowBRL: 5000 },
      ];

      const result = calculateTwrSeries(points);
      expect(result.status).toBe("ok");
      expect(result.monthsElapsed).toBe(2);

      // Ganho econômico = 16.000 - 10.000 - 5.000 = 1.000
      // Base média ponderada = 10.000 + 0.5 * 5.000 = 12.500
      // Taxa = 1.000 / 12.500 = 8%
      expect(result.series[1]?.monthRatePct).toBe(8);
      expect(result.accumulatedRatePct).toBe(8);
    });

    it("resiste a resgate de saldo sem derrubar a cota teórica", () => {
      // Mês 1: Saldo 100.000
      // Mês 2: Rendimento neutro (0%), mas resgatou 40.000 -> Saldo final 60.000
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-01", totalValueBRL: 100000 },
        { month: "2026-02", totalValueBRL: 60000, netExternalCashFlowBRL: -40000 },
      ];

      const result = calculateTwrSeries(points);
      // Ganho econômico = 60.000 - 100.000 - (-40.000) = 0
      // Cota deve permanecer em 100 e acumulado em 0%
      expect(result.series[1]?.monthRatePct).toBe(0);
      expect(result.accumulatedRatePct).toBe(0);
      expect(result.currentSharePrice).toBe(100);
    });

    it("trata lista vazia graciosamente", () => {
      const result = calculateTwrSeries([]);
      expect(result.status).toBe("empty");
      expect(result.accumulatedRatePct).toBe(0);
      expect(result.annualizedRatePct).toBeNull();
      expect(result.series).toHaveLength(0);
    });

    it("trata série de 1 único mês com status insufficient_history", () => {
      const result = calculateTwrSeries([{ month: "2026-01", totalValueBRL: 5000 }]);
      expect(result.status).toBe("insufficient_history");
      expect(result.accumulatedRatePct).toBe(0);
      expect(result.annualizedRatePct).toBeNull();
      expect(result.series).toHaveLength(1);
    });

    it("compara Modified Dietz nos 32 meses com fluxos corretos", () => {
      let prevCost = 0;
      const dietzPoints: TwrMonthlyInputPoint[] = realPortfolioData.map((pt) => {
        const cost = pt.totalCostBRL ?? 0;
        const flow = Math.round((cost - prevCost) * 100) / 100;
        prevCost = cost;
        return {
          month: pt.month,
          totalValueBRL: pt.totalValueBRL,
          totalCostBRL: cost,
          netExternalCashFlowBRL: flow,
        };
      });

      const result = calculateTwrSeries(dietzPoints);
      expect(result.status).toBe("ok");
      expect(result.accumulatedRatePct).toBeGreaterThan(10);
    });

    it("suporta liquidação total temporária e retomada de aportes sem corromper cota", () => {
      // Mês 1: Saldo 10.000 (Cota 100,00)
      // Mês 2: Saldo 11.000 (Ganho de 10% -> Cota 110,00)
      // Mês 3: Resgate total de 11.000 -> Saldo 0 (Cota preservada em 110,00)
      // Mês 4: Novo aporte de 5.000 -> Saldo 5.000 (Cota 110,00, novas cotas = 5000/110)
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-01", totalValueBRL: 10000, netExternalCashFlowBRL: 10000 },
        { month: "2026-02", totalValueBRL: 11000, netExternalCashFlowBRL: 0 },
        { month: "2026-03", totalValueBRL: 0, netExternalCashFlowBRL: -11000 },
        { month: "2026-04", totalValueBRL: 5000, netExternalCashFlowBRL: 5000 },
      ];

      const result = calculateTwrSeries(points);
      expect(result.status).toBe("ok");
      expect(result.currentSharePrice).toBe(110);
      expect(result.accumulatedRatePct).toBe(10);
      expect(result.series[2]?.totalShares).toBe(0);
      expect(result.series[3]?.totalShares).toBeGreaterThan(0);
      expect(Number.isNaN(result.currentSharePrice)).toBe(false);
    });
  });
});
