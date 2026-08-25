import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoanScheduleDialog } from "./loan-schedule-dialog";
import type { Debt, Loan } from "@/types";

const mockLoan: Loan = {
  id: "loan-1",
  user_id: "user-1",
  name: "Financiamento Imobiliário",
  loan_type: "financing",
  principal_amount: 100000,
  interest_rate_monthly: 1.0,
  monthly_interest_rate: 1.0,
  total_installments: 12,
  amortization_system: "sac",
  start_date: "2026-01-01",
  installment_group_id: "group-1",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockDebts: Debt[] = [
  {
    id: "debt-1",
    user_id: "user-1",
    name: "Financiamento Imobiliário (1/12)",
    amount: 9333.33,
    type: "payable",
    due_date: "2026-02-01",
    paid_at: "2026-02-01T12:00:00Z",
    notes: null,
    installment_group_id: "group-1",
    installment_number: 1,
    category_id: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("LoanScheduleDialog", () => {
  it("renderiza o cronograma analítico SAC com parcelas e saldo devedor", () => {
    render(
      <LoanScheduleDialog
        loan={mockLoan}
        debts={mockDebts}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Cronograma: Financiamento Imobiliário")).toBeDefined();
    expect(screen.getByText("Valor Financiado")).toBeDefined();
    expect(screen.getByText("Total de Juros")).toBeDefined();
    expect(screen.getByText("Quitada")).toBeDefined();
  });
});
