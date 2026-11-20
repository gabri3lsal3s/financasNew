import { describe, expect, it } from "vitest";
import {
  buildAllTimePnlBreakdown,
  buildIrrBreakdown,
  buildTwrBreakdown,
  buildYieldBreakdown,
} from "./performance-breakdown";

describe("domain/calculation-memory/builders/performance-breakdown", () => {
  describe("buildTwrBreakdown", () => {
    it("constrói a memória de cálculo do TWR acumulado (imune a aportes e resgates)", () => {
      const breakdown = buildTwrBreakdown({
        accumulatedRatePct: 18.4,
        monthsElapsed: 6,
        currentSharePrice: 118.4,
        status: "ok",
      });

      expect(breakdown.id).toBe("portfolio-twr-breakdown");
      expect(breakdown.unit).toBe("percent");
      expect(breakdown.result.rawValue).toBe(18.4);
      expect(breakdown.result.unit).toBe("percent");
      expect(breakdown.result.formattedValue).toBe("18,4%");
      expect(breakdown.result.tone).toBe("positive");

      // Auditoria do Bug AUD-02: Nunca deve conter 'R$' no resultado ou taxa
      expect(breakdown.result.formattedValue).not.toContain("R$");
      expect(breakdown.steps.some((s) => s.label.includes("Rentabilidade Acumulada"))).toBe(true);
      expect(breakdown.steps.some((s) => s.label.includes("Cota Base Inicial"))).toBe(true);
    });

    it("adiciona passo de Taxa Anualizada CVM apenas para períodos >= 12 meses", () => {
      const withAnnual = buildTwrBreakdown({
        accumulatedRatePct: 25.0,
        annualizedRatePct: 19.5,
        monthsElapsed: 15,
        currentSharePrice: 125.0,
        status: "ok",
      });

      const annualStep = withAnnual.steps.find((s) => s.label.includes("Taxa Anualizada CVM"));
      expect(annualStep).toBeDefined();
      expect(annualStep?.rawValue).toBe(19.5);
      expect(annualStep?.unit).toBe("percent");
      expect(annualStep?.formattedValue).toBe("19,5%");

      // Menos de 12 meses não deve ter o passo de taxa anualizada
      const under12m = buildTwrBreakdown({
        accumulatedRatePct: 10.0,
        annualizedRatePct: 21.0,
        monthsElapsed: 6,
        currentSharePrice: 110.0,
        status: "ok",
      });

      const under12AnnualStep = under12m.steps.find((s) => s.label.includes("Taxa Anualizada CVM"));
      expect(under12AnnualStep).toBeUndefined();
      expect(under12m.notes?.some((n) => n.includes("CVM 19/2021"))).toBe(true);
    });

    it("lida com série vazia ou status não ok com segurança matemática", () => {
      const empty = buildTwrBreakdown({
        accumulatedRatePct: null,
        status: "empty",
      });

      expect(empty.result.rawValue).toBe(0);
      expect(empty.result.tone).toBe("muted");
      expect(empty.notes?.some((n) => n.includes("Histórico em formação"))).toBe(true);
    });
  });

  describe("buildIrrBreakdown", () => {
    it("constrói memória completa da TIR / XIRR com fluxos de entrada, saída e valor final", () => {
      const breakdown = buildIrrBreakdown({
        annualizedRatePct: 14.5,
        periodRatePct: 18.2,
        daysElapsed: 450,
        isEligible: true,
        status: "ok",
        totalInflowsBRL: 100000,
        totalOutflowsBRL: 10000,
        currentValueBRL: 115000,
      });

      expect(breakdown.id).toBe("portfolio-irr-breakdown");
      expect(breakdown.unit).toBe("percent");
      expect(breakdown.result.rawValue).toBe(14.5);
      expect(breakdown.result.formattedValue).toBe("14,5%");
      expect(breakdown.result.tone).toBe("positive");

      // Deve listar os passos de fluxos de caixa em moeda
      const inflowStep = breakdown.steps.find((s) => s.label.includes("Aportes Externos"));
      expect(inflowStep).toBeDefined();
      expect(inflowStep?.unit).toBe("currency");
      expect(inflowStep?.rawValue).toBe(10000000); // centavos

      const outflowStep = breakdown.steps.find((s) => s.label.includes("Resgates e Retiradas"));
      expect(outflowStep).toBeDefined();
      expect(outflowStep?.unit).toBe("currency");
      expect(outflowStep?.rawValue).toBe(1000000);

      const periodStep = breakdown.steps.find((s) => s.label.includes("Retorno do Bolso no Período"));
      expect(periodStep).toBeDefined();
      expect(periodStep?.rawValue).toBe(18.2);
      expect(periodStep?.unit).toBe("percent");

      const annualStep = breakdown.steps.find((s) => s.label.includes("TIR / XIRR"));
      expect(annualStep).toBeDefined();
      expect(annualStep?.rawValue).toBe(14.5);
    });

    it("lida com histórico em formação (< 30 dias) e salvaguarda de anualização (< 365 dias)", () => {
      // Menos de 30 dias
      const under30d = buildIrrBreakdown({
        annualizedRatePct: null,
        periodRatePct: 1.2,
        daysElapsed: 15,
        isEligible: false,
        status: "insufficient_history",
      });

      expect(under30d.result.tone).toBe("muted");
      expect(under30d.notes?.some((n) => n.includes("< 30 dias"))).toBe(true);

      // Entre 30 e 364 dias
      const between30and365 = buildIrrBreakdown({
        annualizedRatePct: null,
        periodRatePct: 8.5,
        daysElapsed: 120,
        isEligible: true,
        status: "ok",
      });

      expect(between30and365.result.rawValue).toBe(8.5);
      expect(between30and365.result.label).toBe("Retorno do Bolso no Período");
      expect(between30and365.notes?.some((n) => n.includes("Salvaguarda CVM/ANBIMA"))).toBe(true);
    });
  });

  describe("buildAllTimePnlBreakdown", () => {
    it("decompõe o P&L Histórico Total em Lucro Realizado + Ganho Aberto + Proventos", () => {
      const breakdown = buildAllTimePnlBreakdown({
        allTimePnlBRL: 35000,
        realizedPnlBRL: 12000,
        unrealizedPnlBRL: 15000,
        totalDividendsBRL: 8000,
      });

      expect(breakdown.id).toBe("portfolio-all-time-pnl-breakdown");
      expect(breakdown.unit).toBe("currency");
      expect(breakdown.result.rawValue).toBe(3500000); // 35k em centavos
      expect(breakdown.result.formattedValue).toContain("35.000,00");
      expect(breakdown.result.tone).toBe("positive");

      expect(breakdown.steps).toHaveLength(3);
      expect(breakdown.steps[0]?.rawValue).toBe(1200000); // Realizado
      expect(breakdown.steps[1]?.rawValue).toBe(1500000); // Não realizado
      expect(breakdown.steps[2]?.rawValue).toBe(800000); // Proventos

      // Invariante aditiva da riqueza gerada
      const sumSteps = breakdown.steps.reduce((acc, s) => acc + s.rawValue, 0);
      expect(sumSteps).toBe(breakdown.result.rawValue);
    });

    it("lida com prejuízo histórico consolidado", () => {
      const breakdown = buildAllTimePnlBreakdown({
        allTimePnlBRL: -5000,
        realizedPnlBRL: -8000,
        unrealizedPnlBRL: 1000,
        totalDividendsBRL: 2000,
      });

      expect(breakdown.result.rawValue).toBe(-500000);
      expect(breakdown.result.tone).toBe("negative");
      expect(breakdown.result.formattedValue).toContain("-R$");
    });
  });

  describe("buildYieldBreakdown", () => {
    it("calcula e decompõe YoC e DY para ações brasileiras", () => {
      const breakdown = buildYieldBreakdown({
        ticker: "ITSA4",
        dividendsAmount: 1200,
        totalCost: 10000,
        currentValue: 15000,
      });

      expect(breakdown.id).toBe("yield-breakdown-itsa4");
      expect(breakdown.unit).toBe("percent");
      // YoC = (1200 / 10000) * 100 = 12%
      expect(breakdown.result.rawValue).toBe(12);
      expect(breakdown.result.formattedValue).toBe("12,0%");

      // Passo de YoC
      const yocStep = breakdown.steps.find((s) => s.label.includes("Yield on Cost"));
      expect(yocStep?.rawValue).toBe(12);
      expect(yocStep?.unit).toBe("percent");

      // Passo de DY: (1200 / 15000) * 100 = 8%
      const dyStep = breakdown.steps.find((s) => s.label.includes("Dividend Yield"));
      expect(dyStep?.rawValue).toBe(8);
      expect(dyStep?.unit).toBe("percent");
      expect(dyStep?.formattedValue).toBe("8,0%");
    });

    it("previne divisão por zero quando o custo for nulo", () => {
      const breakdown = buildYieldBreakdown({
        dividendsAmount: 0,
        totalCost: 0,
      });

      expect(breakdown.result.rawValue).toBe(0);
      expect(breakdown.result.formattedValue).toBe("0,0%");
    });
  });
});
