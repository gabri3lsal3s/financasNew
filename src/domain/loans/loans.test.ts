import { describe, expect, it } from "vitest";
import { calculateEarlyAmortization, calculateLoanProgress, calculateLoanSchedule } from "./index";

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

  it("não aplica desconto indevido de juros em parcelas vencendo no mesmo mês de referência", () => {
    const remaining = [
      { id: "p1", installmentNumber: 1, amountCents: 100000, dueDate: "2026-03-25" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      2.5, // 2,5% a.m.
      100000,
      "2026-03-05"
    );

    expect(res.eliminatedInstallmentIds).toEqual(["p1"]);
    expect(res.totalOriginalAmountCents).toBe(100000);
    expect(res.totalPresentValuePaidCents).toBe(100000);
    expect(res.totalDiscountCents).toBe(0);
  });

  it("não aplica desconto para parcelas já vencidas em mês anterior ao de referência", () => {
    const remaining = [
      { id: "p_past", installmentNumber: 1, amountCents: 100000, dueDate: "2026-02-15" },
    ];

    const res = calculateEarlyAmortization(
      remaining,
      3,
      100000,
      "2026-03-10"
    );

    expect(res.eliminatedInstallmentIds).toEqual(["p_past"]);
    expect(res.totalPresentValuePaidCents).toBe(100000);
    expect(res.totalDiscountCents).toBe(0);
  });

  it("calcula desconto exato para parcelas futuras preservando valor nominal da parcela do mês corrente", () => {
    const remaining = [
      { id: "p_current", installmentNumber: 1, amountCents: 100000, dueDate: "2026-03-15" },
      { id: "p_future", installmentNumber: 2, amountCents: 100000, dueDate: "2026-04-15" },
    ];

    // Orçamento suficiente para pagar as duas parcelas
    const res = calculateEarlyAmortization(
      remaining,
      2, // 2% a.m.
      200000,
      "2026-03-01"
    );

    // Prioriza eliminar de trás pra frente: p_future depois p_current
    expect(res.eliminatedInstallmentIds).toEqual(["p_future", "p_current"]);
    expect(res.totalOriginalAmountCents).toBe(200000);
    // p_future (1 mês à frente): 100000 / 1.02 = 98039
    // p_current (mesmo mês): 100000 / 1.00 = 100000
    // Total PV = 198039
    // Desconto total = 200000 - 198039 = 1961
    expect(res.totalPresentValuePaidCents).toBe(198039);
    expect(res.totalDiscountCents).toBe(1961);
  });
});

describe("calculateLoanProgress", () => {
  it("calculates progress and pending amount for loan contract debts", () => {
    const debts = [
      { amount: 250, paid_at: "2026-01-10" },
      { amount: 250, paid_at: "2026-02-10" },
      { amount: 250, paid_at: null },
      { amount: 250, paid_at: null },
    ];

    const result = calculateLoanProgress(debts, 4);
    expect(result.paidCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.progressPercent).toBe(50);
    expect(result.pendingAmountCents).toBe(50000);
  });

  it("handles empty debts using fallback installments", () => {
    const result = calculateLoanProgress([], 12);
    expect(result.paidCount).toBe(0);
    expect(result.totalCount).toBe(12);
    expect(result.progressPercent).toBe(0);
    expect(result.pendingAmountCents).toBe(0);
  });
});

