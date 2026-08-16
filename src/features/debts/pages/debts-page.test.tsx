import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DebtsPage } from "./debts-page";

vi.mock("react-router", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const createDebtMock = vi.fn();
const deleteDebtMock = vi.fn();
const payDebtMock = vi.fn();
const receiveDebtMock = vi.fn();
const settleMock = vi.fn();

vi.mock("@/state", () => ({
  useDebts: () => ({
    data: [
      {
        id: "d1",
        name: "Conta de luz",
        type: "payable",
        amount: 200,
        due_date: "2026-08-20",
        paid_at: null,
        expense_id: null,
      },
      {
        id: "d2",
        name: "Empréstimo ao João",
        type: "receivable",
        amount: 500,
        due_date: "2026-08-10",
        paid_at: null,
        expense_id: null,
      },
      {
        id: "d3",
        name: "Conta paga",
        type: "payable",
        amount: 100,
        due_date: "2026-07-01",
        paid_at: "2026-07-02T00:00:00Z",
        expense_id: null,
      },
      {
        id: "d4",
        name: "Recebível integrado",
        type: "receivable",
        amount: 300,
        due_date: "2026-08-25",
        paid_at: null,
        expense_id: "e1",
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDeleteDebt: () => ({ mutateAsync: deleteDebtMock, isPending: false }),
  useCreateDebt: () => ({ mutateAsync: createDebtMock, isPending: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayDebt: () => ({ mutateAsync: payDebtMock, isPending: false }),
  useReceiveDebt: () => ({ mutateAsync: receiveDebtMock, isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: settleMock, isPending: false }),
  useCategories: () => ({
    data: [{ id: "inc1", name: "Outros", type: "income" }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useExpense: () => ({
    data: { id: "e1", base_amount: 1000 },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

describe("DebtsPage — contas a pagar e receber (§3.4)", () => {
  it("lista dívidas com status derivado", () => {
    render(<DebtsPage />);
    expect(screen.getByText("Conta de luz")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Quitada")).toBeInTheDocument();
  });

  it("alterna entre as abas a pagar / a receber", async () => {
    const user = userEvent.setup();
    render(<DebtsPage />);
    await user.click(screen.getByRole("tab", { name: /a receber/i }));
    expect(screen.getByText("Empréstimo ao João")).toBeInTheDocument();
    expect(screen.queryByText("Conta de luz")).not.toBeInTheDocument();
  });

  it("cria uma nova dívida", async () => {
    createDebtMock.mockResolvedValue({ id: "d4" });
    const user = userEvent.setup();
    render(<DebtsPage />);

    await user.click(screen.getByRole("button", { name: "Nova dívida" }));
    await user.type(screen.getByLabelText("Nome"), "Internet");
    const amount = screen.getByRole("textbox", { name: "Valor da dívida" });
    await user.type(amount, "12000");

    // Seleciona o vencimento no calendário (primitivo do app, sem input nativo).
    await user.click(screen.getByRole("button", { name: "Vencimento da dívida" }));
    const calendar = await screen.findByRole("grid");
    const day15 = [...calendar.querySelectorAll("[role=gridcell]")].find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(day15.querySelector("button") as HTMLButtonElement);

    await user.click(screen.getByRole("button", { name: "Criar dívida" }));

    await waitFor(() => expect(createDebtMock).toHaveBeenCalledTimes(1));
    const params = createDebtMock.mock.calls[0]?.[0];
    expect(params.name).toBe("Internet");
    expect(params.type).toBe("payable");
    expect(params.amount).toBe(120);
    expect(params.due_date).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("quita dívida a pagar apenas (sem criar despesa)", async () => {
    payDebtMock.mockResolvedValue("d1");
    const user = userEvent.setup();
    render(<DebtsPage />);

    await user.click(screen.getByRole("button", { name: "Quitar Conta de luz" }));
    await user.click(screen.getByRole("button", { name: "Confirmar quitação" }));

    expect(payDebtMock).toHaveBeenCalledWith({
      debtId: "d1",
      createExpense: false,
      expenseCategoryId: null,
    });
  });

  it("quita dívida a receber com criação de renda", async () => {
    receiveDebtMock.mockResolvedValue("d2");
    const user = userEvent.setup();
    render(<DebtsPage />);

    await user.click(screen.getByRole("tab", { name: /a receber/i }));
    await user.click(screen.getByRole("button", { name: "Quitar Empréstimo ao João" }));
    await user.click(screen.getByText("Receber e criar renda"));

    // Categoria obrigatória para criar a renda (RPC valida no servidor).
    await user.click(screen.getByRole("combobox", { name: "Categoria da renda" }));
    await user.click(await screen.findByRole("option", { name: "Outros" }));

    await user.click(screen.getByRole("button", { name: "Confirmar quitação" }));

    expect(receiveDebtMock).toHaveBeenCalledWith({
      debtId: "d2",
      createIncome: true,
      incomeCategoryId: "inc1",
    });
  });

  it("recebimento integrado sugere o resultado e quita via RPC", async () => {
    settleMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DebtsPage />);

    await user.click(screen.getByRole("tab", { name: /a receber/i }));
    await user.click(screen.getByRole("button", { name: "Quitar Recebível integrado" }));

    // Sugestão automática: despesa R$ 1.000,00 − dívida R$ 300,00 = R$ 700,00
    // (o separador de milhar pode ser espaço simples ou NBSP — compara pelo número)
    const resultInput = screen.getByRole("textbox", { name: "Resultado da despesa no relatório" }) as HTMLInputElement;
    expect(resultInput.value.includes("700,00")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Confirmar quitação" }));
    expect(settleMock).toHaveBeenCalledWith({ debtId: "d4", result: 700 });
  });

  it("exclui dívida pelo formulário de edição com confirmação", async () => {
    deleteDebtMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DebtsPage />);

    // A exclusão mora no formulário de edição (botão Excluir + confirmação).
    await user.click(screen.getByRole("button", { name: "Editar Conta de luz" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    // O botão da confirmação é o último "Excluir" no DOM (form fica por trás).
    const confirmButtons = screen.getAllByRole("button", { name: "Excluir" });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    expect(deleteDebtMock).toHaveBeenCalledWith("d1");
  });
});
