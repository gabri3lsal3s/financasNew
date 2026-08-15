import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseDetailDialog } from "./expense-detail-dialog";
import type { Expense } from "@/types";

const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat1", name: "Alimentação", icon: "Utensils", color: "#EF4444" },
      { id: "cat2", name: "Transporte", icon: "Car", color: "#3B82F6" },
    ],
  }),
  useCreditCards: () => ({
    data: [
      {
        id: "card1",
        name: "Nubank",
        brand: "Mastercard",
        credit_limit: 5000,
        color: "#8B5CF6",
        closing_day: 10,
        due_day: 15,
        is_active: true,
      },
    ],
  }),
  useUpdateExpense: () => ({ mutateAsync: updateExpenseMock, isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: deleteExpenseMock, isPending: false }),
}));

const baseExpense: Expense = {
  id: "e1",
  user_id: "u1",
  value: 120.5,
  date: "2026-08-04",
  category_id: "cat1",
  payment_method: "credit_card",
  card_id: "card1",
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: "2026-08",
  report_weight: 1,
  base_amount: 120.5,
  description: null,
  created_at: "2026-08-04T10:00:00Z",
};

describe("ExpenseDetailDialog", () => {
  it("exibe o nome da categoria quando a despesa não tiver descrição", () => {
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    // Não deve conter "Despesa sem descrição" ou "Sem descrição"
    expect(screen.queryByText(/sem descrição/i)).not.toBeInTheDocument();
    // Deve exibir o nome da categoria "Alimentação" como título
    expect(screen.getAllByText("Alimentação").length).toBeGreaterThan(0);
  });

  it("permite editar despesa e alterar a fatura (bill_competence) para transitar entre meses", async () => {
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByRole("heading", { name: "Editar despesa" })).toBeInTheDocument();
    const compInput = screen.getByLabelText("Competência da fatura");
    expect(compInput).toHaveValue("2026-08");

    // Altera a fatura para 2026-09
    await user.clear(compInput);
    await user.type(compInput, "2026-09");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    expect(updateExpenseMock).toHaveBeenCalledWith({
      id: "e1",
      input: expect.objectContaining({
        bill_competence: "2026-09",
      }),
    });
  });
});
