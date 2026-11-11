import { describe, expect, it } from "vitest";
import {
  calculateCriticalCapital,
  calculateFireMetrics,
  calculateRunwayMonths,
  getFireStage,
  DEFAULT_SAFE_WITHDRAWAL_RATE_PCT,
} from "./fire";

describe("FIRE Domain Engine (fire.ts)", () => {
  describe("calculateCriticalCapital", () => {
    it("calcula o Capital Crítico na regra padrão dos 4% (Multiplicador de 300x)", () => {
      // Custo mensal de R$ 5.000,00 (500.000 centavos)
      // 500.000 * 300 = 150.000.000 centavos (R$ 1.500.000,00)
      const criticalCapital = calculateCriticalCapital({
        monthlyLivingCostCents: 500_000,
      });

      expect(criticalCapital).toBe(150_000_000);
    });

    it("suporta taxa personalizada de retirada segura (SWR)", () => {
      // 3% a.a. => Multiplicador 1200 / 3 = 400x
      const capital3Pct = calculateCriticalCapital({
        monthlyLivingCostCents: 500_000,
        safeWithdrawalRatePct: 3.0,
      });
      expect(capital3Pct).toBe(200_000_000); // R$ 2.000.000,00

      // 5% a.a. => Multiplicador 1200 / 5 = 240x
      const capital5Pct = calculateCriticalCapital({
        monthlyLivingCostCents: 500_000,
        safeWithdrawalRatePct: 5.0,
      });
      expect(capital5Pct).toBe(120_000_000); // R$ 1.200.000,00
    });

    it("retorna 0 para custo de vida zero ou negativo", () => {
      expect(calculateCriticalCapital({ monthlyLivingCostCents: 0 })).toBe(0);
      expect(calculateCriticalCapital({ monthlyLivingCostCents: -50_000 })).toBe(0);
    });

    it("utiliza fallback para taxa SWR inválida ou zero", () => {
      const fallback = calculateCriticalCapital({
        monthlyLivingCostCents: 500_000,
        safeWithdrawalRatePct: 0,
      });
      expect(fallback).toBe(150_000_000);
    });
  });

  describe("calculateRunwayMonths", () => {
    it("calcula a autonomia de reserva com precisão de 1 casa decimal", () => {
      // R$ 30.000,00 de reserva e R$ 5.000,00 de gastos => 6.0 meses
      expect(calculateRunwayMonths(3_000_000, 500_000)).toBe(6.0);

      // R$ 25.000,00 de reserva e R$ 6.000,00 de gastos => 4.166... => 4.2 meses
      expect(calculateRunwayMonths(2_500_000, 600_000)).toBe(4.2);
    });

    it("trata valores nulos, negativos ou despesas zeradas com segurança", () => {
      expect(calculateRunwayMonths(0, 500_000)).toBe(0);
      expect(calculateRunwayMonths(-100_000, 500_000)).toBe(0);
      expect(calculateRunwayMonths(3_000_000, 0)).toBe(0);
      expect(calculateRunwayMonths(3_000_000, -500_000)).toBe(0);
    });
  });

  describe("getFireStage", () => {
    it("classifica corretamente todos os 6 estágios cognitivos da jornada FIRE", () => {
      expect(getFireStage(5)).toEqual({
        stage: "initial",
        stageLabel: "Fase Inicial (< 10%)",
      });

      expect(getFireStage(15)).toEqual({
        stage: "building",
        stageLabel: "Fase de Construção (10% a 24%)",
      });

      expect(getFireStage(30)).toEqual({
        stage: "quarter",
        stageLabel: "Primeiro Quarto Conquistado (25% a 49%)",
      });

      expect(getFireStage(60)).toEqual({
        stage: "half",
        stageLabel: "Meio Caminho da Liberdade (50% a 74%)",
      });

      expect(getFireStage(85)).toEqual({
        stage: "security",
        stageLabel: "Alta Segurança Financeira (75% a 99%)",
      });

      expect(getFireStage(100)).toEqual({
        stage: "freedom",
        stageLabel: "Independência Financeira Plena (100%+)",
      });

      expect(getFireStage(140)).toEqual({
        stage: "freedom",
        stageLabel: "Independência Financeira Plena (100%+)",
      });
    });
  });

  describe("calculateFireMetrics", () => {
    it("consolida as métricas FIRE com precisão matemática integral em centavos", () => {
      const result = calculateFireMetrics({
        currentNetWorthCents: 50_000_000, // R$ 500.000,00
        monthlyDividendsCents: 150_000, // R$ 1.500,00
        monthlyExpensesCents: 500_000, // R$ 5.000,00
        liquidReservesCents: 3_000_000, // R$ 30.000,00
        safeWithdrawalRatePct: DEFAULT_SAFE_WITHDRAWAL_RATE_PCT,
      });

      // Capital Crítico: R$ 5.000,00 * 300 = R$ 1.500.000,00 (150.000.000 centavos)
      expect(result.criticalCapitalCents).toBe(150_000_000);
      // Progresso FIRE: 500.000 / 1.500.000 = 33,3%
      expect(result.fireProgressPct).toBe(33.3);
      // Grau de Liberdade: 1.500 / 5.000 = 30,0%
      expect(result.freedomPct).toBe(30.0);
      expect(result.stage).toBe("quarter");
      expect(result.stageLabel).toBe("Primeiro Quarto Conquistado (25% a 49%)");
      // Runway: 30.000 / 5.000 = 6,0 meses
      expect(result.runwayMonths).toBe(6.0);
      // Déficit mensal: R$ 5.000 - R$ 1.500 = R$ 3.500,00
      expect(result.monthlyPassiveShortfallCents).toBe(350_000);
      // Distância para FIRE: R$ 1.500.000 - R$ 500.000 = R$ 1.000.000,00
      expect(result.gapToFireCents).toBe(100_000_000);
    });

    it("trata adequadamente o atingimento pleno da Independência Financeira (100%+)", () => {
      const result = calculateFireMetrics({
        currentNetWorthCents: 200_000_000, // R$ 2.000.000,00
        monthlyDividendsCents: 600_000, // R$ 6.000,00
        monthlyExpensesCents: 500_000, // R$ 5.000,00
        liquidReservesCents: 5_000_000, // R$ 50.000,00
      });

      expect(result.freedomPct).toBe(120.0);
      expect(result.stage).toBe("freedom");
      expect(result.fireProgressPct).toBe(133.3);
      expect(result.monthlyPassiveShortfallCents).toBe(0);
      expect(result.gapToFireCents).toBe(0);
    });

    it("trata cenários iniciais com valores zerados sem erros de divisão", () => {
      const result = calculateFireMetrics({
        currentNetWorthCents: 0,
        monthlyDividendsCents: 0,
        monthlyExpensesCents: 0,
        liquidReservesCents: 0,
      });

      expect(result.criticalCapitalCents).toBe(0);
      expect(result.fireProgressPct).toBe(0);
      expect(result.freedomPct).toBe(0);
      expect(result.runwayMonths).toBe(0);
      expect(result.stage).toBe("initial");
      expect(result.monthlyPassiveShortfallCents).toBe(0);
      expect(result.gapToFireCents).toBe(0);
    });
  });
});
