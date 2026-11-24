import { describe, expect, it } from "vitest";
import { addMonthsToCompetence, calculateBillRefinancePlan } from "./refinancing";

describe("addMonthsToCompetence", () => {
  it("avança meses dentro do mesmo ano", () => {
    expect(addMonthsToCompetence("2026-03", 2)).toBe("2026-05");
  });

  it("avança meses com virada de ano", () => {
    expect(addMonthsToCompetence("2026-11", 2)).toBe("2027-01");
    expect(addMonthsToCompetence("2026-12", 12)).toBe("2027-12");
  });
});

describe("calculateBillRefinancePlan", () => {
  it("divide sem juros se a taxa for 0%", () => {
    const res = calculateBillRefinancePlan({
      remainingBalanceCents: 10000, // R$ 100,00
      installmentsCount: 3,
      monthlyInterestRatePercent: 0,
      firstCompetenceMonth: "2026-04",
    });

    expect(res.originalBalanceCents).toBe(10000);
    expect(res.totalInterestCents).toBe(0);
    expect(res.installments).toHaveLength(3);
    expect(res.installments[0]?.billCompetence).toBe("2026-05");
    expect(res.installments[0]?.amountCents).toBe(3334);
    expect(res.installments[1]?.amountCents).toBe(3333);
    expect(res.installments[2]?.amountCents).toBe(3333);
  });

  it("calcula parcelas e juros corretos para taxa positiva", () => {
    const res = calculateBillRefinancePlan({
      remainingBalanceCents: 100000, // R$ 1.000,00
      installmentsCount: 4,
      monthlyInterestRatePercent: 3, // 3% ao mês
      firstCompetenceMonth: "2026-04",
    });

    expect(res.totalInterestCents).toBeGreaterThan(0);
    expect(res.installments).toHaveLength(4);
    expect(res.installments[0]?.billCompetence).toBe("2026-05");
    expect(res.installments[3]?.billCompetence).toBe("2026-08");

    // Soma das parcelas de juros bate com o total de juros
    const sumInterest = res.installments.reduce((acc, curr) => acc + curr.interestCents, 0);
    expect(sumInterest).toBe(res.totalInterestCents);

    // Soma do principal bate exatamente com o saldo financiado (conservação em centavos)
    const sumPrincipal = res.installments.reduce((acc, curr) => acc + curr.principalCents, 0);
    expect(sumPrincipal).toBe(res.originalBalanceCents);
  });

  it("Blindagem #10: distribui resto dos centavos do principal na 1ª parcela", () => {
    const res = calculateBillRefinancePlan({
      remainingBalanceCents: 10001, // R$ 100,01 em 3x -> 3334 + 3334 + 3333? Não, 10001/3 = 3333 resto 2 -> 3334, 3334, 3333; e 10000/3 -> 3334, 3333, 3333
      installmentsCount: 3,
      monthlyInterestRatePercent: 2.5,
      firstCompetenceMonth: "2026-05",
    });

    expect(res.installments[0]?.principalCents).toBe(3334);
    expect(res.installments[1]?.principalCents).toBe(3334);
    expect(res.installments[2]?.principalCents).toBe(3333);
    expect(res.installments.reduce((acc, c) => acc + c.principalCents, 0)).toBe(10001);
  });
});
