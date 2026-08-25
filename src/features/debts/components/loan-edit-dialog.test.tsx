import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoanEditDialog } from "./loan-edit-dialog";
import type { Loan } from "@/types";

const mockUpdateLoan = vi.fn();

vi.mock("@/state", () => ({
  useUpdateLoan: () => ({
    mutateAsync: mockUpdateLoan,
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

describe("LoanEditDialog", () => {
  it("renderiza o formulário pré-preenchido e dispara updateLoan", async () => {
    mockUpdateLoan.mockResolvedValue({ ...mockLoan, name: "Empréstimo Santander Atualizado" });
    const onOpenChange = vi.fn();

    render(
      <LoanEditDialog
        loan={mockLoan}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const nameInput = screen.getByLabelText(/Nome do Contrato/i);
    expect((nameInput as HTMLInputElement).value).toBe("Empréstimo Santander");

    fireEvent.change(nameInput, { target: { value: "Empréstimo Santander Atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    expect(mockUpdateLoan).toHaveBeenCalledWith({
      id: "loan-1",
      patch: expect.objectContaining({
        name: "Empréstimo Santander Atualizado",
      }),
    });
  });
});
