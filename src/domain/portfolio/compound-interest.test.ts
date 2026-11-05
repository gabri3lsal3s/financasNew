import { describe, expect, it } from "vitest";
import {
  calculateCompoundInterest,
  annualRateToMonthlyRate,
} from "./compound-interest";

describe("domain/portfolio/compound-interest", () => {
  it("converte taxa anual nominal para taxa mensal geométrica equivalente", () => {
    // 12% a.a. => (1.12)^(1/12) - 1 =~ 0.00948879 (0.9488% a.m.)
    const monthlyRate = annualRateToMonthlyRate(12);
    expect(monthlyRate).toBeCloseTo(0.00948879, 5);
  });

  it("retorna zero de rendimento quando a taxa de juros for 0%", () => {
    const res = calculateCompoundInterest({
      initialAmountCents: 100000, // R$ 1.000,00
      monthlyContributionCents: 10000, // R$ 100,00
      annualRatePercent: 0,
      periodYears: 2,
    });

    expect(res.totalInterestCents).toBe(0);
    // 1000 + 24 * 100 = 3400
    expect(res.finalBalanceCents).toBe(340000);
    expect(res.totalContributedCents).toBe(340000);
    expect(res.doublingTimeYears).toBeNull();
  });

  it("projeta juros compostos exponencialmente ao longo dos anos", () => {
    const res = calculateCompoundInterest({
      initialAmountCents: 1000000, // R$ 10.000,00
      monthlyContributionCents: 100000, // R$ 1.000,00
      annualRatePercent: 10, // 10% a.a.
      periodYears: 10,
    });

    expect(res.finalBalanceCents).toBeGreaterThan(res.totalContributedCents);
    expect(res.totalInterestCents).toBe(res.finalBalanceCents - res.totalContributedCents);
    expect(res.yearsTimeline).toHaveLength(11); // Ano 0 a 10
    expect(res.doublingTimeYears).toBe(7.2); // 72 / 10
  });

  it("detecta ponto de inflexão e independência financeira (FIRE)", () => {
    const res = calculateCompoundInterest({
      initialAmountCents: 5000000, // R$ 50.000,00
      monthlyContributionCents: 100000, // R$ 1.000,00
      annualRatePercent: 12,
      periodYears: 15,
      monthlyLivingCostCents: 300000, // R$ 3.000,00/mês
    });

    expect(res.interestExceedsContributionAt).toBeDefined();
    expect(res.interestExceedsContributionAt?.year).toBeGreaterThanOrEqual(1);
    expect(res.fireReachedAt).toBeDefined();
    expect(res.fireReachedAt?.year).toBeGreaterThanOrEqual(1);
  });
});
