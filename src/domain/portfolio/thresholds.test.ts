import { describe, expect, it } from "vitest";
import { calculateAllocationDrift } from "./thresholds";

describe("calculateAllocationDrift — Monitoramento de Desvios de Alocação (§F52)", () => {
  it("identifica classes e ativos com desvios além da tolerância", () => {
    const result = calculateAllocationDrift({
      totalPortfolioCents: 1000000, // R$ 10.000,00
      tolerancePercent: 5, // ±5%
      items: [
        {
          id: "acoes",
          name: "Ações",
          currentValueCents: 600000, // 60% (meta: 40% -> drift +20% -> overweight)
          targetPercent: 40,
        },
        {
          id: "fiis",
          name: "FIIs",
          currentValueCents: 200000, // 20% (meta: 40% -> drift -20% -> underweight)
          targetPercent: 40,
        },
        {
          id: "rf",
          name: "Renda Fixa",
          currentValueCents: 200000, // 20% (meta: 20% -> drift 0% -> aligned)
          targetPercent: 20,
        },
      ],
    });

    expect(result.hasTargets).toBe(true);
    expect(result.isBalanced).toBe(false);
    expect(result.maxDriftPercent).toBe(20);
    expect(result.underweightItems).toHaveLength(1);
    expect(result.underweightItems[0]?.name).toBe("FIIs");
    expect(result.underweightItems[0]?.recommendedAporteCents).toBe(200000); // R$ 2.000,00 para fechar o gap
    expect(result.overweightItems).toHaveLength(1);
    expect(result.overweightItems[0]?.name).toBe("Ações");
  });

  it("retorna isBalanced = true quando todas as variações estão dentro da tolerância", () => {
    const result = calculateAllocationDrift({
      totalPortfolioCents: 1000000,
      tolerancePercent: 5,
      items: [
        {
          id: "acoes",
          name: "Ações",
          currentValueCents: 520000, // 52% (meta: 50% -> drift +2%)
          targetPercent: 50,
        },
        {
          id: "fiis",
          name: "FIIs",
          currentValueCents: 480000, // 48% (meta: 50% -> drift -2%)
          targetPercent: 50,
        },
      ],
    });

    expect(result.isBalanced).toBe(true);
    expect(result.underweightItems).toHaveLength(0);
    expect(result.overweightItems).toHaveLength(0);
  });

  it("trata carteira sem metas configuradas", () => {
    const result = calculateAllocationDrift({
      totalPortfolioCents: 1000000,
      items: [],
    });

    expect(result.hasTargets).toBe(false);
    expect(result.isBalanced).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});
