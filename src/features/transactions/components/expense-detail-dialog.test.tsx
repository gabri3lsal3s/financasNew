import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseDetailDialog } from "./expense-detail-dialog";
import type { Expense } from "@/types";

const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();
const createExpenseMock = vi.fn();

// Cartões variáveis por teste (para validar o caso sem cartão cadastrado).
const stateMocks = vi.hoisted(() => ({
  cards: [
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
  ] as unknown[],
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat1", name: "Alimentação", icon: "Utensils", color: "#EF4444" },
      { id: "cat2", name: "Transporte", icon: "Car", color: "#3B82F6" },
    ],
  }),
  useCreditCards: () => ({ data: stateMocks.cards }),
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
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

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
    // Edição otimista (F30): o cache atualiza em onMutate; o modal fecha após
    // a confirmação do servidor.
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("exclusão otimista (F30): confirma e fecha os diálogos na hora, disparando a mutação", async () => {
    deleteExpenseMock.mockResolvedValue(1);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

    expect(deleteExpenseMock).toHaveBeenCalledWith({ expenseId: "e1", mode: "single" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite alterar o peso no relatório por preset dentro do modal de edição", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    // Abre o seletor de pesos (dentro do modal) e escolhe o preset 75%
    await user.click(screen.getByRole("combobox", { name: "Peso no relatório" }));
    await user.click(screen.getByRole("option", { name: "75%" }));

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { report_weight: number } };
    expect(payload.input.report_weight).toBe(0.75);
  });

  it("mudar a data recalcula a competência pelo fechamento do cartão (sem override manual)", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    // Abre o DatePicker e escolhe o dia 15 (fechamento do cartão = dia 10 →
    // competência 2026-09). A competência NÃO foi editada manualmente.
    await user.click(screen.getByRole("button", { name: "Data da despesa" }));
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { bill_competence: string } };
    expect(payload.input.bill_competence).toBe("2026-09");
  });

  it("competência editada manualmente NÃO é sobrescrita ao mudar a data", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const compInput = screen.getByLabelText("Competência da fatura");
    await user.clear(compInput);
    await user.type(compInput, "2026-11");

    // Muda a data para o dia 15 — a competência manual deve ser preservada.
    await user.click(screen.getByRole("button", { name: "Data da despesa" }));
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    expect(compInput).toHaveValue("2026-11");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { bill_competence: string } };
    expect(payload.input.bill_competence).toBe("2026-11");
  });

  it("competência com formato inválido bloqueia o salvamento com mensagem clara", async () => {
    updateExpenseMock.mockClear();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const compInput = screen.getByLabelText("Competência da fatura");
    await user.clear(compInput);
    await user.type(compInput, "2026-8");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Competência da fatura inválida/)).toBeInTheDocument();
  });

  it("permite peso personalizado no relatório no modal de edição e persiste a fração resolvida", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    await user.click(screen.getByRole("combobox", { name: "Peso no relatório" }));
    await user.click(screen.getByRole("option", { name: /personalizado/i }));

    // baseExpense.value = 120,50 → R$ 45,00 = 4500 centavos
    const customInput = screen.getByRole("textbox", { name: "Valor considerado no relatório" });
    await user.clear(customInput);
    await user.type(customInput, "4500");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { report_weight: number } };
    // fração resolvida: 4500 / 12050 = 0.3734 (4 casas, invariante do schema)
    expect(payload.input.report_weight).toBe(Number((4500 / 12050).toFixed(4)));
  });


  it("bloqueia despesa no crédito quando não há cartão cadastrado", async () => {
    updateExpenseMock.mockClear();
    stateMocks.cards = [];
    try {
      const user = userEvent.setup();
      render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /editar/i }));
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(updateExpenseMock).not.toHaveBeenCalled();
      expect(screen.getByText(/Nenhum cartão de crédito cadastrado/)).toBeInTheDocument();
    } finally {
      stateMocks.cards = [
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
      ];
    }
  });

  it("falha ao salvar mantém o modal aberto com o erro e os dados preservados", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockRejectedValue(new Error("Falha ao salvar"));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    // Erro visível e modal continua aberto — nada se perdeu.
    expect(await screen.findByText("Falha ao salvar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar despesa" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
