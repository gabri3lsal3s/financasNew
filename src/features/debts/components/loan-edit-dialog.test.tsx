import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoanEditDialog } from "./loan-edit-dialog";
import type { Debt, Loan } from "@/types";

const mockRenegotiateLoan = vi.fn();

vi.mock("@/state", () => ({
  useRenegotiateLoanContract: () => ({
    mutateAsync: mockRenegotiateLoan,
    isPending: false,
  }),
}));

const mockLoan: Loan = {
  id: "loan-1",
  user_id: "user-1",
  name: "Empréstimo Santander",
  loan_type: "personal",
  principal_amount: 5000,
  interest_rate_monthly: 2.5,
  total_installments: 10,
  amortization_system: "price",
  start_date: "2026-01-01",
  installment_group_id: "group-2",
  created_at: "2026-01-01T00:00:00Z",
};

const mockDebtsWithPaid: Debt[] = [
  {
    id: "d1",
    user_id: "user-1",
    name: "Empréstimo Santander (1/10)",
    type: "payable",
    amount: 572.82,
    due_date: "2026-01-01",
    paid_at: "2026-01-01T12:00:00Z",
    expense_id: null,
    installment_group_id: "group-2",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "d2",
    user_id: "user-1",
    name: "Empréstimo Santander (2/10)",
    type: "payable",
    amount: 572.82,
    due_date: "2026-02-01",
    paid_at: null,
    expense_id: null,
    installment_group_id: "group-2",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("LoanEditDialog", () => {
  it("renderiza o formulário pré-preenchido e dispara renegotiateLoanContract para contrato sem parcelas pagas", async () => {
    mockRenegotiateLoan.mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <LoanEditDialog
        loan={mockLoan}
        debts={[]}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const nameInput = screen.getByLabelText(/Nome do Contrato/i);
    expect((nameInput as HTMLInputElement).value).toBe("Empréstimo Santander");

    fireEvent.change(nameInput, { target: { value: "Empréstimo Santander Atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e Atualizar Parcelas/i }));

    expect(mockRenegotiateLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: "loan-1",
        name: "Empréstimo Santander Atualizado",
        strategy: "reset",
      }),
    );
  });

  it("exibe o histórico de parcelas pagas, seleção de estratégia e recalcula parcelas", async () => {
    mockRenegotiateLoan.mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <LoanEditDialog
        loan={mockLoan}
        debts={mockDebtsWithPaid}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Exibe o status das parcelas quitadas
    expect(screen.getByText(/1 de 10 parcelas quitadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Repactuar saldo restante/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar e Atualizar Parcelas/i }));

    expect(mockRenegotiateLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: "loan-1",
        strategy: "amortize_remaining",
      }),
    );
  });
});
