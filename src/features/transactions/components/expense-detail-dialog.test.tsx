import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseDetailDialog } from "./expense-detail-dialog";
import type { Expense } from "@/types";

const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();
const createExpenseMock = vi.fn();

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
  useCreateExpense: () => ({ mutateAsync: createExpenseMock, isPending: false }),
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
  it("repete o lançamento no mês atual com data ajustada (F21)", async () => {
    createExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog open={true} onOpenChange={vi.fn()} expense={baseExpense} />);

    await user.click(screen.getByRole("button", { name: /Repetir no mês atual/ }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const input = createExpenseMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      value: 120.5,
      categoryId: "cat1",
      paymentMethod: "credit_card",
      cardId: "card1",
      description: null,
      reportWeight: 1,
    });
    // Data ajustada para hoje (não a original).
    expect(input.date).not.toBe("2026-08-04");
  });

  it("exibe o nome da categoria quando a despesa não tiver descrição", () => {
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    // Não deve conter "Despesa sem descrição" ou "Sem descrição"
    expect(screen.queryByText(/sem descrição/i)).not.toBeInTheDocument();
    // Deve exibir o nome da categoria "Alimentação" como título
    expect(screen.getAllByText("Alimentação").length).toBeGreaterThan(0);
  });

  it("oferece compartilhamento via Web Share (F22)", async () => {
    const user = userEvent.setup();
    render(<ExpenseDetailDialog open={true} onOpenChange={vi.fn()} expense={baseExpense} />);

    const shareButton = screen.getByRole("button", { name: /compartilhar/i });
    await user.click(shareButton);

    // Web Share/clipboard indisponíveis no jsdom — não deve lançar erro.
    expect(screen.getByRole("button", { name: /compartilhar/i })).toBeInTheDocument();
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
