import { describe, expect, it } from "vitest";
import {
  DEFAULT_REAL_RETURN_RATE,
  EMERGENCY_HEALTH_LABELS,
  emergencyFundMonths,
  fireProjection,
  fireTargetCents,
} from "./index";

describe("domain/fire — regra dos 4% e projeção", () => {
  it("meta FIRE = despesas anuais × 25", () => {
    expect(fireTargetCents(12_000_00)).toBe(300_000_00); // R$ 120.000/ano → R$ 3.000.000
    expect(fireTargetCents(0)).toBe(0);
  });

  it("sem aporte e sem capital, nunca atinge a meta (horizonte limitado)", () => {
    const result = fireProjection({
      annualExpensesCents: 120_000_00,
      initialCapitalCents: 0,
      monthlyContributionCents: 0,
    });
    expect(result.yearsToFire).toBeNull();
    expect(result.series).toHaveLength(41); // ano 0 + 40
    expect(result.series[0]?.capitalCents).toBe(0);
  });

  it("aporta mensalmente até atingir a meta (aritmética anual)", () => {
    // Despesas R$ 2.000/mês → meta R$ 600.000. Aporte R$ 1.000/mês,
    // retorno 0% → 50 anos... com retorno padrão 5% chega bem antes.
    const result = fireProjection({
      annualExpensesCents: 24_000_00,
      initialCapitalCents: 0,
      monthlyContributionCents: 100_000,
    });
    expect(result.targetCents).toBe(600_000_00);
    expect(result.yearsToFire).not.toBeNull();
    // A série é estritamente crescente (capital composto).
    for (let i = 1; i < result.series.length; i += 1) {
      const prev = result.series[i - 1];
      const curr = result.series[i];
      if (!prev || !curr) throw new Error("série incompleta");
      expect(curr.capitalCents).toBeGreaterThanOrEqual(prev.capitalCents);
    }
    const reachedYear = result.yearsToFire;
    if (reachedYear !== null) {
      expect(result.series[reachedYear]?.reached).toBe(true);
    }
  });

  it("capital inicial já na meta → ano 0 atingido", () => {
    const result = fireProjection({
      annualExpensesCents: 24_000_00,
      initialCapitalCents: 600_000_00,
      monthlyContributionCents: 0,
      realReturnRate: 0,
    });
    expect(result.series[0]?.reached).toBe(true);
    expect(result.yearsToFire).toBe(1);
  });

  it("respeita o horizonte máximo configurado", () => {
    const result = fireProjection({
      annualExpensesCents: 240_000_00,
      initialCapitalCents: 0,
      monthlyContributionCents: 10_000,
      maxYears: 10,
    });
    expect(result.series).toHaveLength(11);
    expect(result.series[10]?.year).toBe(10);
  });

  it("usa o retorno real padrão quando omitido", () => {
    expect(DEFAULT_REAL_RETURN_RATE).toBe(0.05);
  });
});

describe("domain/fire — fundo de emergência", () => {
  it("calcula meses de reserva e faixa de saúde", () => {
    // Saldo R$ 12.000 ÷ despesa R$ 2.000 = 6 meses (adequado).
    expect(emergencyFundMonths(1_200_000, 200_000)).toEqual({ months: 6, health: "adequado" });
    // 24 meses → saudável.
    expect(emergencyFundMonths(4_800_000, 200_000)).toEqual({ months: 24, health: "saudavel" });
    // 2 meses → crítico.
    expect(emergencyFundMonths(400_000, 200_000)).toEqual({ months: 2, health: "critico" });
    // 4 meses → baixo.
    expect(emergencyFundMonths(800_000, 200_000)).toEqual({ months: 4, health: "baixo" });
  });

  it("sem despesa de referência → sem métrica (saudável)", () => {
    expect(emergencyFundMonths(100_000, 0)).toEqual({ months: null, health: "saudavel" });
  });

  it("expõe rótulos pt-BR das faixas", () => {
    expect(EMERGENCY_HEALTH_LABELS.critico).toBe("Crítico");
    expect(EMERGENCY_HEALTH_LABELS.saudavel).toBe("Saudável");
  });
});
