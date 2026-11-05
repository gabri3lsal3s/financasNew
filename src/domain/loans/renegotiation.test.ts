import { describe, expect, it } from "vitest";
import { calculateLoanRenegotiation, calculatePaidAmortization } from "./renegotiation";
import type { Debt, Loan } from "@/types";

const mockLoan: Loan = {
  id: "l1",
  user_id: "u1",
  name: "Financiamento Carro",
  loan_type: "financing",
  principal_amount: 10000,
  interest_rate_monthly: 1.5,
  amortization_system: "price",
  total_installments: 10,
  start_date: "2026-01-10",
  installment_group_id: "ig-1",
  created_at: "2026-01-01T00:00:00Z",
};

const mockDebts: Debt[] = [
  {
    id: "d1",
    user_id: "u1",
    name: "Financiamento Carro (1/10)",
    type: "payable",
    amount: 1084.34,
    due_date: "2026-01-10",
    paid_at: "2026-01-10T12:00:00Z",
    expense_id: null,
    installment_group_id: "ig-1",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "d2",
    user_id: "u1",
    name: "Financiamento Carro (2/10)",
    type: "payable",
    amount: 1084.34,
    due_date: "2026-02-10",
    paid_at: "2026-02-10T12:00:00Z",
    expense_id: null,
    installment_group_id: "ig-1",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "d3",
    user_id: "u1",
    name: "Financiamento Carro (3/10)",
    type: "payable",
    amount: 1084.34,
    due_date: "2026-03-10",
    paid_at: null,
    expense_id: null,
    installment_group_id: "ig-1",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("renegotiation domain", () => {
  it("calcula amortização acumulada e saldo devedor restante corretamente", () => {
    const info = calculatePaidAmortization(mockLoan, mockDebts);
    expect(info.paidCount).toBe(2);
    expect(info.totalPaidAmountCents).toBe(216868);
    // Após 2 parcelas de 10k a 1.5% a.m., saldo devedor restante é menor que 10.000
    expect(info.remainingBalanceCents).toBeLessThan(1000000);
    expect(info.remainingBalanceCents).toBeGreaterThan(700000);
    expect(info.nextSuggestedDueDate).toBe("2026-03-10");
  });

  it("renegocia contrato com amortização sobre saldo restante (modo amortize_remaining)", () => {
    const result = calculateLoanRenegotiation(mockLoan, mockDebts, {
      name: "Financiamento Carro Repactuado",
      loanType: "financing",
      principalCents: 1000000,
      installmentsCount: 15, // 15 novas parcelas
      monthlyRatePercent: 1.2, // nova taxa 1.2%
      system: "price",
      startDate: "2026-03-10",
      strategy: "amortize_remaining",
    });

    expect(result.strategy).toBe("amortize_remaining");
    expect(result.paidCount).toBe(2);
    expect(result.remainingCount).toBe(15);
    // Novo total é 2 pagas + 15 novas = 17
    expect(result.newTotalInstallments).toBe(17);
    expect(result.scheduleToInsert).toHaveLength(15);
    // Primeira nova parcela tem número 3 (após 1 e 2)
    expect(result.scheduleToInsert[0]?.installmentNumber).toBe(3);
    // Última nova parcela tem número 17
    expect(result.scheduleToInsert[14]?.installmentNumber).toBe(17);
    expect(result.firstInstallmentAmountCents).toBeGreaterThan(0);
    // Por estender o prazo de 8 restantes para 15 com taxa menor, a parcela unitária diminui
    expect(result.firstInstallmentAmountCents).toBeLessThan(108434);
  });

  it("recalcula integralmente do zero no modo reset", () => {
    const result = calculateLoanRenegotiation(mockLoan, mockDebts, {
      name: "Financiamento Resetado",
      loanType: "financing",
      principalCents: 1200000, // novo valor R$ 12.000
      installmentsCount: 20, // 20 parcelas
      monthlyRatePercent: 1.0,
      system: "sac",
      startDate: "2026-04-10",
      strategy: "reset",
    });

    expect(result.strategy).toBe("reset");
    expect(result.paidCount).toBe(0);
    expect(result.newTotalInstallments).toBe(20);
    expect(result.scheduleToInsert).toHaveLength(20);
    expect(result.scheduleToInsert[0]?.installmentNumber).toBe(1);
    expect(result.scheduleToInsert[19]?.installmentNumber).toBe(20);
  });

  it("recalcula do zero quando não há parcelas pagas mesmo que a estratégia seja amortize_remaining", () => {
    const debtsNoPaid = mockDebts.map((d) => ({ ...d, paid_at: null }));
    const result = calculateLoanRenegotiation(mockLoan, debtsNoPaid, {
      name: "Financiamento Sem Pagas",
      loanType: "financing",
      principalCents: 500000,
      installmentsCount: 10,
      monthlyRatePercent: 1.5,
      system: "price",
      startDate: "2026-01-10",
      strategy: "amortize_remaining",
    });

    expect(result.strategy).toBe("reset");
    expect(result.paidCount).toBe(0);
    expect(result.newTotalInstallments).toBe(10);
    expect(result.scheduleToInsert[0]?.installmentNumber).toBe(1);
  });
});
