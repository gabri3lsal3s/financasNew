import { describe, expect, it } from "vitest";
import {
  BREAK_EVEN_FALLBACK_REASON,
  calculateBusinessBreakEven,
} from "./break-even";

describe("break-even (Ponto de Equilíbrio PJ — Fase 1 / v2.1)", () => {
  it("aplica método aditivo (fallback) quando receita <= 0", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 150_000,
      estimatedTaxCents: 7_590,
      targetProLaboreCents: 300_000,
      grossRevenueCents: 0,
    });
    expect(res.calculationMethod).toBe("additive_fallback");
    expect(res.explanation).toBe(BREAK_EVEN_FALLBACK_REASON);
    expect(res.breakEvenTargetCents).toBe(457_590);
    expect(res.progressPct).toBe(0);
    expect(res.remainingCents).toBe(457_590);
    expect(res.isReached).toBe(false);
  });

  it("aplica fallback aditivo quando a margem de contribuição é incipiente ou <= 5%", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 10_000_00,
      fixedCostsCents: 5_000_00,
      variableCostsCents: 9_600_00, // Variável consome quase toda a receita
      estimatedTaxCents: 200_00,
      targetProLaboreCents: 3_000_00,
      grossRevenueCents: 10_000_00,
    });

    // Receita Líquida = 9.800. MC = 9.800 - 9.600 = 200 (MC% = 2,04% <= 5%)
    expect(res.calculationMethod).toBe("additive_fallback");
    expect(res.explanation).toBe(BREAK_EVEN_FALLBACK_REASON);
    // Aditivo: 5.000 + 9.600 + 200 + 3.000 = 17.800
    expect(res.breakEvenTargetCents).toBe(17_800_00);
  });

  it("calcula ponto de equilíbrio ponderado por margem quando MC% > 5%", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 6_000_00,
      fixedCostsCents: 4_000_00, // Custos Fixos R$ 4.000
      variableCostsCents: 2_000_00, // Custos Variáveis R$ 2.000
      estimatedTaxCents: 0,
      targetProLaboreCents: 2_000_00, // Pró-labore desejado R$ 2.000
      grossRevenueCents: 10_000_00, // Faturamento R$ 10.000
    });

    // MC = 10.000 - 2.000 = 8.000 -> MC% = 80% (0.8)
    // PE Operacional = 4.000 / 0.8 = R$ 5.000
    // PE Total Digno = (4.000 + 2.000) / 0.8 = R$ 7.500
    expect(res.calculationMethod).toBe("contribution_margin");
    expect(res.operationalBreakEvenCents).toBe(5_000_00);
    expect(res.breakEvenTargetCents).toBe(7_500_00);
    expect(res.isReached).toBe(true); // Faturou 10.000 >= 7.500
    expect(res.surplusAboveBreakEvenCents).toBe(2_500_00);
  });

  it("protege contra divisão por zero e valores nulos", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 0,
      estimatedTaxCents: 0,
      targetProLaboreCents: 0,
      grossRevenueCents: 0,
    });
    expect(res.progressPct).toBe(0);
    expect(res.isReached).toBe(false);
    expect(res.breakEvenTargetCents).toBe(0);
  });
});
