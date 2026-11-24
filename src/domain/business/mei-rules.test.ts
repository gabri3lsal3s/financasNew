import { describe, expect, it } from "vitest";
import {
  evaluateMeiCeiling,
  getMeiBaseCeilingRule,
  MEI_CAMINHONEIRO_BASE_CEILING_CENTS,
} from "./mei-rules";

describe("mei-rules (SSOT Fiscal do MEI — LC nº 238/2026)", () => {
  describe("1. Tetos Base por Ano e Categoria", () => {
    it("retorna R$ 81.000,00 para 2026 (não condicionado à LOA)", () => {
      const rule = getMeiBaseCeilingRule(2026);
      expect(rule.annualCeilingCents).toBe(81_000_00);
      expect(rule.monthlyProRataCents).toBe(6_750_00);
      expect(rule.isLoaConditioned).toBe(false);
    });

    it("retorna R$ 110.000,00 para 2027 com ressalva de condicionamento à LOA (Art. 3º)", () => {
      const rule = getMeiBaseCeilingRule(2027);
      expect(rule.annualCeilingCents).toBe(110_000_00);
      expect(rule.isLoaConditioned).toBe(true);
    });

    it("retorna R$ 140.000,00 para 2028 com ressalva de condicionamento à LOA (Art. 3º)", () => {
      const rule = getMeiBaseCeilingRule(2028);
      expect(rule.annualCeilingCents).toBe(140_000_00);
      expect(rule.isLoaConditioned).toBe(true);
    });

    it("retorna R$ 251.600,00 para MEI Transportador Autônomo de Cargas (Caminhoneiro)", () => {
      const rule = getMeiBaseCeilingRule(2026, true);
      expect(rule.annualCeilingCents).toBe(MEI_CAMINHONEIRO_BASE_CEILING_CENTS);
    });
  });

  describe("2. Cálculo Pro-Rata no Ano de Abertura (com Clamp)", () => {
    it("aplica pro-rata de 6 meses quando MEI aberto em Julho/2026 avaliado em 2026", () => {
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 8, // Agosto
        accumulatedRevenueCents: 20_000_00,
        openingDate: "2026-07-15",
      });

      expect(result.isProRata).toBe(true);
      expect(result.activeMonthsInYear).toBe(6); // Jul a Dez = 6 meses
      expect(result.applicableCeilingCents).toBe(40_500_00); // 6 * R$ 6.750 = R$ 40.500
      expect(result.activeMonthsElapsed).toBe(2); // Julho e Agosto = 2 meses decorridos
      // Projeção: (20.000 / 2) * 6 = R$ 60.000
      expect(result.projectedAnnualRevenueCents).toBe(60_000_00);
    });

    it("protege com clamp >= 1 contra data de abertura futura no mesmo ano", () => {
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 5, // Maio
        accumulatedRevenueCents: 5_000_00,
        openingDate: "2026-08-01", // Abertura futura em Agosto
      });

      expect(result.isProRata).toBe(true);
      expect(result.activeMonthsInYear).toBe(5); // Ago a Dez = 5 meses
      expect(result.activeMonthsElapsed).toBe(1); // Clamp seguro >= 1
    });

    it("aplica teto integral (12 meses) quando empresa foi aberta em ano anterior", () => {
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 6, // Junho
        accumulatedRevenueCents: 30_000_00,
        openingDate: "2024-03-10", // Aberto em 2024
      });

      expect(result.isProRata).toBe(false);
      expect(result.activeMonthsInYear).toBe(12);
      expect(result.applicableCeilingCents).toBe(81_000_00);
      expect(result.activeMonthsElapsed).toBe(6);
      // Projeção: (30.000 / 6) * 12 = R$ 60.000
      expect(result.projectedAnnualRevenueCents).toBe(60_000_00);
    });
  });

  describe("3. Zonas de Semáforo Legal (Lei Complementar nº 123/2006)", () => {
    it("classifica como 'safe' quando faturamento <= teto aplicável", () => {
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 10,
        accumulatedRevenueCents: 70_000_00,
      });

      expect(result.zone).toBe("safe");
      expect(result.remainingCeilingCents).toBe(11_000_00);
    });

    it("classifica como 'warning_tolerance_20' quando excesso está entre 100% e 120%", () => {
      // Teto 2026 = 81.000; +20% = 97.200
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 11,
        accumulatedRevenueCents: 90_000_00, // Dentro da tolerância
      });

      expect(result.zone).toBe("warning_tolerance_20");
      expect(result.toleranceLimitCents).toBe(97_200_00);
      expect(result.remainingCeilingCents).toBe(0);
    });

    it("classifica como 'critical_over_20' quando estoura os 20% de tolerância", () => {
      const result = evaluateMeiCeiling({
        referenceYear: 2026,
        referenceMonth: 12,
        accumulatedRevenueCents: 100_000_00, // > 97.200
      });

      expect(result.zone).toBe("critical_over_20");
    });
  });
});
