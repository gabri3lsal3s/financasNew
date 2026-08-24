import { describe, expect, it } from "vitest";
import { calculateHabitFireImpact } from "./habit-impact";

describe("calculateHabitFireImpact — Impacto de Gastos no FIRE (§F52)", () => {
  it("calcula valor futuro capitalizado e antecipação de anos na independência", () => {
    const result = calculateHabitFireImpact({
      habitMonthlyCostCents: 20000, // R$ 200,00 / mês
      baselineAnnualExpensesCents: 6000000, // R$ 60.000,00 / ano
      baselineInitialCapitalCents: 10000000, // R$ 100.000,00
      baselineMonthlyContributionCents: 100000, // R$ 1.000,00 / mês
      realReturnRate: 0.05,
    });

    expect(result.habitAnnualCostCents).toBe(240000); // R$ 2.400,00 / ano
    expect(result.fireTargetReductionCents).toBe(6000000); // Meta FIRE reduz em R$ 60.000,00 (25x)
    expect(result.futureValue10yCents).toBeGreaterThan(3000000); // > R$ 30.000,00 em 10 anos
    expect(result.futureValue30yCents).toBeGreaterThan(15000000); // > R$ 150.000,00 em 30 anos
    expect(result.baselineYearsToFire).toBeDefined();
    expect(result.optimizedYearsToFire).toBeDefined();
    expect(result.yearsSaved).toBeGreaterThan(0);
    expect(result.impactSummary).toContain("antecipa sua independência");
  });
});
