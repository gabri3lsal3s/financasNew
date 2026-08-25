import { describe, expect, it } from "vitest";
import {
  annualRateToDaily,
  calculateFixedIncomeBalance,
  calculateTaxReductionCountdown,
  getFixedIncomeTaxRatePct,
  getIofRatePct,
} from "./fixed-income";

describe("fixed-income domain calculations", () => {
  it("converte taxa anual em taxa diária base 252", () => {
    const daily10 = annualRateToDaily(10);
    // (1 + 0.10)^(1/252) - 1 ≈ 0.000378
    expect(daily10).toBeCloseTo(0.000378, 5);

    expect(annualRateToDaily(0)).toBe(0);
    expect(annualRateToDaily(-5)).toBe(0);
  });

  it("calcula alíquotas regressivas de IOF", () => {
    expect(getIofRatePct(1)).toBe(96);
    expect(getIofRatePct(15)).toBe(50);
    expect(getIofRatePct(29)).toBe(3);
    expect(getIofRatePct(30)).toBe(0);
    expect(getIofRatePct(60)).toBe(0);
  });

  it("calcula alíquotas regressivas de IR", () => {
    // <= 180 dias -> 22.5%
    expect(getFixedIncomeTaxRatePct(30)).toBe(22.5);
    expect(getFixedIncomeTaxRatePct(180)).toBe(22.5);
    // 181 a 360 -> 20%
    expect(getFixedIncomeTaxRatePct(181)).toBe(20.0);
    expect(getFixedIncomeTaxRatePct(360)).toBe(20.0);
    // 361 a 720 -> 17.5%
    expect(getFixedIncomeTaxRatePct(361)).toBe(17.5);
    expect(getFixedIncomeTaxRatePct(720)).toBe(17.5);
    // > 720 -> 15%
    expect(getFixedIncomeTaxRatePct(721)).toBe(15.0);
    expect(getFixedIncomeTaxRatePct(1000)).toBe(15.0);

    // Isento
    expect(getFixedIncomeTaxRatePct(30, true)).toBe(0);
    expect(getFixedIncomeTaxRatePct(1000, true)).toBe(0);
  });

  it("calcula o saldo projetado de um CDB 110% CDI a partir do Marco Zero", () => {
    // 10 dias úteis com CDI de ~10.5% a.a.
    const res = calculateFixedIncomeBalance({
      baseValue: 10000,
      baseDate: "2026-08-03", // Segunda
      today: "2026-08-17", // 10 dias úteis depois
      rateType: "cdi",
      rateValue: 110,
      annualCdiRate: 10.5,
    });

    expect(res.businessDaysAccrued).toBe(10);
    expect(res.grossValue).toBeGreaterThan(10000);
    expect(res.totalAccruedInterest).toBeGreaterThan(0);
    expect(res.isMatured).toBe(false);
    expect(res.taxRatePct).toBe(22.5); // < 180 dias
    expect(res.netValue).toBeLessThan(res.grossValue);
    expect(res.netValue).toBeGreaterThan(10000);
  });

  it("calcula título Prefixado e respeita isenção de IR (ex.: LCA/LCI)", () => {
    const res = calculateFixedIncomeBalance({
      baseValue: 5000,
      baseDate: "2026-01-02",
      today: "2026-07-02",
      rateType: "pre",
      rateValue: 12.0, // 12% a.a.
      isTaxExempt: true,
    });

    expect(res.taxRatePct).toBe(0);
    expect(res.taxAmount).toBe(0);
    expect(res.netValue).toBe(res.grossValue);
  });

  it("trava o cálculo de rendimento na data de vencimento", () => {
    // Título venceu em 2026-06-30, avaliação em 2026-08-25
    const res = calculateFixedIncomeBalance({
      baseValue: 10000,
      baseDate: "2026-01-02",
      maturityDate: "2026-06-30",
      today: "2026-08-25",
      rateType: "cdi",
      rateValue: 100,
      annualCdiRate: 10.0,
    });

    expect(res.isMatured).toBe(true);
    expect(res.effectiveCutoffDate).toBe("2026-06-30");

    // O rendimento com today=2026-06-30 deve ser idêntico a today=2026-08-25
    const resAtMaturity = calculateFixedIncomeBalance({
      baseValue: 10000,
      baseDate: "2026-01-02",
      maturityDate: "2026-06-30",
      today: "2026-06-30",
      rateType: "cdi",
      rateValue: 100,
      annualCdiRate: 10.0,
    });

    expect(res.grossValue).toBe(resAtMaturity.grossValue);
    expect(res.businessDaysAccrued).toBe(resAtMaturity.businessDaysAccrued);
  });

  it("calcula contagem regressiva para próxima alíquota de IR e economia fiscal", () => {
    // Aplicado há 160 dias (está na faixa de 22.5%, faltam 21 dias para 20.0%)
    const countdown = calculateTaxReductionCountdown({
      initialInvestmentDate: "2026-01-01",
      todayDate: "2026-06-10", // 160 dias depois
      accumulatedProfitBRL: 2000,
      isTaxExempt: false,
    });

    expect(countdown).not.toBeNull();
    expect(countdown?.currentRatePct).toBe(22.5);
    expect(countdown?.nextRatePct).toBe(20.0);
    expect(countdown?.daysRemaining).toBe(21);
    // Economia de 2.5% sobre R$ 2000 = R$ 50
    expect(countdown?.estimatedTaxSavingsBRL).toBe(50);
  });

  it("retorna null no countdown se já estiver na alíquota mínima de 15%", () => {
    const countdown = calculateTaxReductionCountdown({
      initialInvestmentDate: "2023-01-01",
      todayDate: "2026-08-25", // > 720 dias
      accumulatedProfitBRL: 5000,
      isTaxExempt: false,
    });

    expect(countdown).toBeNull();
  });
});
