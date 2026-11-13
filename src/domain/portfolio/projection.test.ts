import { describe, expect, it } from "vitest";
import { projectPatrimony } from "./projection";

describe("domain/portfolio/projection", () => {
  const base = {
    initialCents: 2_500_000, // R$ 25.000
    monthlyContributionCents: 300_000, // R$ 3.000
    annualRatePercent: 8,
    years: 25,
    monthlyLivingCostCents: 250_000, // R$ 2.500
  };

  it("inicia no patrimônio atual, sem juros no ano 0", () => {
    const result = projectPatrimony(base);

    expect(result.years[0]).toMatchObject({
      year: 0,
      balanceCents: 2_500_000,
      contributedCents: 2_500_000,
      totalInterestCents: 0,
    });
    expect(result.years).toHaveLength(26);
  });

  it("usa o capital crítico da regra dos 4% como meta de independência", () => {
    const result = projectPatrimony(base);

    // R$ 2.500/mês × 300 = R$ 750.000
    expect(result.independenceTargetCents).toBe(75_000_000);
  });

  it("encontra o ano de independência quando o saldo alcança o capital crítico", () => {
    const result = projectPatrimony(base);

    expect(result.independenceYear).toBe(12);
    const year11 = result.years[11]!;
    const year12 = result.years[12]!;
    expect(year11.balanceCents).toBeLessThan(75_000_000);
    expect(year12.balanceCents).toBeGreaterThanOrEqual(75_000_000);
  });

  it("projeta a renda passiva pelo yield da carteira, não pela regra de retirada", () => {
    const result = projectPatrimony({ ...base, annualPassiveYieldPercent: 10 });

    // R$ 25.000 × (10% a.a. convertido para mensal) ≈ R$ 199/mês
    expect(result.years[0]!.monthlyPassiveIncomeCents).toBe(19_935);
    expect(result.finalMonthlyPassiveIncomeCents).toBe(result.years.at(-1)!.monthlyPassiveIncomeCents);
  });

  it("mantém a renda passiva coerente com o saldo exibido no último ano", () => {
    const result = projectPatrimony(base);
    const last = result.years.at(-1)!;

    // Yield padrão = rentabilidade anual (8% a.a. => 0,6434% a.m.)
    expect(last.monthlyPassiveIncomeCents).toBe(Math.round(last.balanceCents * (Math.pow(1.08, 1 / 12) - 1)));
  });

  it("corrige a série pela inflação quando a base é real", () => {
    const nominal = projectPatrimony(base);
    const real = projectPatrimony({ ...base, basis: "real", inflationPercent: 4 });
    const year10Nominal = nominal.years[10]!.balanceCents;
    const year10Real = real.years[10]!.balanceCents;

    expect(real.basis).toBe("real");
    expect(year10Real).toBeLessThan(year10Nominal);
    expect(year10Real).toBe(Math.round(year10Nominal / Math.pow(1.04, 10)));
    // A independência chega depois em valores reais
    expect(real.independenceYear).toBeGreaterThan(nominal.independenceYear ?? 0);
  });

  it("registra o mês em que os juros passam a superar o aporte", () => {
    const result = projectPatrimony(base);

    expect(result.interestExceedsContributionAt).not.toBeNull();
    expect(result.interestExceedsContributionAt!.year).toBeGreaterThan(0);
    expect(result.interestExceedsContributionAt!.month).toBeGreaterThanOrEqual(1);
    expect(result.interestExceedsContributionAt!.month).toBeLessThanOrEqual(12);
  });

  it("não calcula meta de independência sem custo de vida informado", () => {
    const result = projectPatrimony({ ...base, monthlyLivingCostCents: 0 });

    expect(result.independenceTargetCents).toBeNull();
    expect(result.independenceYear).toBeNull();
    expect(result.years[5]!.targetProgressPct).toBe(0);
  });

  it("normaliza entradas inválidas e limita o horizonte", () => {
    const result = projectPatrimony({
      initialCents: -500,
      monthlyContributionCents: Number.NaN,
      annualRatePercent: -3,
      years: 999,
      monthlyLivingCostCents: 250_000,
    });

    expect(result.years[0]!.balanceCents).toBe(0);
    expect(result.years).toHaveLength(61);
    expect(result.finalBalanceCents).toBe(0);
    expect(result.independenceYear).toBeNull();
  });

  it("não acumula renda passiva quando o yield é zero", () => {
    const result = projectPatrimony({ ...base, annualPassiveYieldPercent: 0 });

    expect(result.years[0]!.monthlyPassiveIncomeCents).toBe(0);
    expect(result.finalMonthlyPassiveIncomeCents).toBe(0);
  });
});
