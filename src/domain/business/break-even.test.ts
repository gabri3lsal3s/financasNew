import { describe, expect, it } from "vitest";
import { calculateBusinessBreakEven } from "./break-even";

describe("break-even (Ponto de Equilíbrio PJ)", () => {
  it("soma custos + imposto estimado + meta de pró-labore e calcula progresso", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 150_000,
      estimatedTaxCents: 7_590,
      targetProLaboreCents: 300_000,
      grossRevenueCents: 228_795,
    });
    expect(res.breakEvenTargetCents).toBe(457_590);
    expect(res.progressPct).toBe(50);
    expect(res.remainingCents).toBe(228_795);
    expect(res.isReached).toBe(false);
  });

  it("protege contra divisão por zero quando meta = 0", () => {
    const res = calculateBusinessBreakEven({
      operationalCostsCents: 0,
      estimatedTaxCents: 0,
      targetProLaboreCents: 0,
      grossRevenueCents: 0,
    });
    expect(res.progressPct).toBe(0);
    expect(res.isReached).toBe(false);
  });
});
