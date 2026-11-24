import { describe, expect, it } from "vitest";
import { splitMixedExpenseByAmount, splitMixedExpenseByPercent } from "./split-expense";

describe("split-expense (Divisão Atômica PF / PJ)", () => {
  it("divide despesa 50% / 50% com conservação exata de centavos e report_weight = 1.0", () => {
    const result = splitMixedExpenseByPercent({
      totalCents: 200_00, // R$ 200,00
      businessPercent: 50,
    });

    expect(result.personalCents).toBe(100_00);
    expect(result.businessCents).toBe(100_00);
    expect(result.personalCents + result.businessCents).toBe(200_00);
    expect(result.personalReportWeight).toBe(1.0);
    expect(result.businessReportWeight).toBe(1.0);
  });

  it("garante conservação exata com percentuais ímpares (ex.: 33,33% em R$ 100,00)", () => {
    const result = splitMixedExpenseByPercent({
      totalCents: 100_00, // R$ 100,00
      businessPercent: 33.33,
    });

    // 33.33% de 10.000 centavos = 3333 centavos (R$ 33,33)
    // personalCents = 10000 - 3333 = 6667 centavos (R$ 66,67)
    expect(result.businessCents).toBe(3333);
    expect(result.personalCents).toBe(6667);
    expect(result.personalCents + result.businessCents).toBe(100_00);
  });

  it("divide por valor nominal em centavos mantendo exatidão", () => {
    const result = splitMixedExpenseByAmount({
      totalCents: 350_00, // R$ 350,00
      businessCents: 120_00, // R$ 120,00 atribuído à empresa
    });

    expect(result.businessCents).toBe(120_00);
    expect(result.personalCents).toBe(230_00);
    expect(result.personalCents + result.businessCents).toBe(350_00);
  });
});
