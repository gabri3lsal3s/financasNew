import { describe, expect, it } from "vitest";
import { calculateEarlyAmortization, calculateLoanSchedule } from "./index";

describe("calculateLoanSchedule", () => {
  it("calcula cronograma Price com parcelas fixas", () => {
    const res = calculateLoanSchedule({
      principalCents: 100000, // R$ 1.000,00
      totalInstallments: 5,
      monthlyRatePercent: 2, // 2% a.m.
      system: "price",
      startDate: "2026-01-10",
    });

    expect(res.principalCents).toBe(100000);
    expect(res.schedule).toHaveLength(5);
    expect(res.schedule[0]?.dueDate).toBe("2026-01-10");
    expect(res.schedule[1]?.dueDate).toBe("2026-02-10");
    expect(res.schedule[4]?.dueDate).toBe("2026-05-10");
    expect(res.totalInterestCents).toBeGreaterThan(0);
    expect(res.schedule[4]?.remainingBalanceCents).toBe(0);
  });

  it("calcula cronograma SAC com amortização constante e parcelas decrescentes", () => {
    const res = calculateLoanSchedule({
      principalCents: 100000, // R$ 1.000,00
      totalInstallments: 4,
      monthlyRatePercent: 1.5,
      system: "sac",
      startDate: "2026-01-10",
    });

    expect(res.schedule).toHaveLength(4);
    // Amortização constante de 250,00 (25000 cents)
    expect(res.schedule[0]?.principalCents).toBe(25000);
    expect(res.schedule[1]?.principalCents).toBe(25000);
    // Parcela 1 > Parcela 4
    expect(res.schedule[0]!.amountCents).toBeGreaterThan(res.schedule[3]!.amountCents);
    expect(res.schedule[3]?.remainingBalanceCents).toBe(0);
  });
});

describe("calculateEarlyAmortization", () => {
  it("calcula desconto a valor presente ao antecipar parcelas do fim do contrato", () => {
    const remaining = [
      { id: "p1", installmentNumber: 1, amountCents: 50000, dueDate: "2026-04-10" },
      { id: "p2", installmentNumber: 2, amountCents: 50000, dueDate: "2026-05-10" },
      { id: "p3", installmentNumber: 3, amountCents: 50000, dueDate: "2026-06-10" },
      { id: "p4", installmentNumber: 4, amountCents: 50000, dueDate: "2026-07-10" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      2, // 2% a.m.
      90000, // R$ 900,00 de orçamento disponível
      "2026-03-01"
    );

    // Deve priorizar a eliminação das parcelas do final (p4, p3...)
    expect(res.eliminatedInstallmentIds).toContain("p4");
    expect(res.totalDiscountCents).toBeGreaterThan(0);
    expect(res.totalPresentValuePaidCents).toBeLessThan(res.totalOriginalAmountCents);
  });
});
