import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardsPage } from "./cards-page";

const searchParamsMock = vi.fn(() => [new URLSearchParams(), vi.fn()]);

vi.mock("react-router", () => ({
  useSearchParams: () => searchParamsMock(),
}));

const paymentMock = vi.fn();
const refundMock = vi.fn();
const createCardMock = vi.fn();
const updateCardMock = vi.fn();
const deleteCardMock = vi.fn();
const deleteCardPaymentMock = vi.fn();

// Despesas da fatura variáveis por teste (para validar a separação parceladas × à vista).
const stateMocks = vi.hoisted(() => ({
  expenses: [
    {
      id: "e1",
      description: "Supermercado",
      date: "2026-08-05",
      value: 150,
      report_weight: 1,
      bill_competence: "2026-08",
      installments_total: 1,
      installment_number: 1,
    },
  ],
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreditCards: () => ({
    data: [
      {
        id: "c1",
        name: "Nubank",
        brand: "Mastercard",
        credit_limit: 5000,
        color: "#8B5CF6",
        closing_day: 10,
        due_day: 15,
        is_active: true,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCardExpenses: () => ({
    data: stateMocks.expenses,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCardPayments: () => ({
    data: [{ id: "p1", competence_month: "2026-08", amount: 100, date: "2026-08-10", note: null }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateCardPayment: () => ({ mutateAsync: paymentMock, isPending: false }),
  useCreateRefund: () => ({ mutateAsync: refundMock, isPending: false }),
  useCreateCard: () => ({ mutateAsync: createCardMock, isPending: false }),
  useUpdateCard: () => ({ mutateAsync: updateCardMock, isPending: false }),
  useDeleteCard: () => ({ mutateAsync: deleteCardMock, isPending: false }),
  useDeleteCardPayment: () => ({ mutateAsync: deleteCardPaymentMock, isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("CardsPage — Gestão completa, Wallet 3D e faturas (§3.3.3)", () => {
  it("exibe a carteira de cartões com todas as métricas embutidas no cartão 3D", () => {
    render(<CardsPage />);
    expect(screen.getByText("Sua Carteira")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fatura Total (Bruto)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Melhor dia:/i)).toBeInTheDocument();
    expect(screen.getByText(/Fechamento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Vencimento:/i)).toBeInTheDocument();
  });

  it("exibe KPIs da fatura (fatura total bruto, pago, saldo aberto)", () => {
    render(<CardsPage />);
    expect(screen.getAllByText("Fatura Total (Bruto)").length).toBeGreaterThan(0);
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Saldo aberto (Bruto)")).toBeInTheDocument();
    // Previsto R$ 150,00 · Pago R$ 100,00 · Saldo R$ 50,00
    expect(screen.getAllByText("R$ 150,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 50,00").length).toBeGreaterThan(0);
  });

  it("lista despesas da competência e pagamentos com botão de exclusão", () => {
    render(<CardsPage />);
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Pagamento de fatura")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excluir pagamento/i })).toBeInTheDocument();
  });

  it("permite excluir pagamento com diálogo de confirmação", async () => {
    deleteCardPaymentMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CardsPage />);

    const deletePayBtn = screen.getByRole("button", { name: /excluir pagamento/i });
    await user.click(deletePayBtn);

    expect(screen.getByRole("heading", { name: "Excluir pagamento de fatura" })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Excluir" });
    await user.click(confirmBtn);

    expect(deleteCardPaymentMock).toHaveBeenCalledWith("p1");
  });

  it("permite abrir diálogo de edição do cartão", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);

    const cardBtn = screen.getByRole("button", { name: /^cartão nubank/i });
    await user.click(cardBtn);

    expect(screen.getByRole("heading", { name: "Editar cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Nubank");
  });

  it("permite excluir o cartão com diálogo de confirmação", async () => {
    deleteCardMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CardsPage />);

    const deleteBtn = screen.getByRole("button", { name: /excluir cartão nubank/i });
    await user.click(deleteBtn);

    expect(screen.getByRole("heading", { name: "Excluir cartão" })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Excluir cartão" });
    await user.click(confirmBtn);

    expect(deleteCardMock).toHaveBeenCalledWith("c1");
  });

  it("registra pagamento via diálogo", async () => {
    paymentMock.mockResolvedValue("p1");
    const user = userEvent.setup();
    render(<CardsPage />);

    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    await user.type(input, "5000");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    expect(paymentMock).toHaveBeenCalledTimes(1);
    const params = paymentMock.mock.calls[0]?.[0];
    expect(params.cardId).toBe("c1");
    expect(params.competenceMonth).toBe("2026-08");
    expect(params.amount).toBe(50);
  });

  it("registra estorno via diálogo (gera renda automática)", async () => {
    refundMock.mockResolvedValue("r1");
    const user = userEvent.setup();
    render(<CardsPage />);

    await user.click(screen.getByRole("button", { name: "Estorno" }));
    const input = screen.getByRole("textbox", { name: "Valor do estorno" });
    await user.type(input, "2000");
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(refundMock.mock.calls[0]?.[0]?.amount).toBe(20);
  });

  it("abre o formulário de novo cartão", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);
    await user.click(screen.getByRole("button", { name: /adicionar novo cartão/i }));
    expect(screen.getByRole("heading", { name: "Novo cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("abre o diálogo de detalhes da despesa ao clicar na linha da fatura", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);
    await user.click(screen.getByText("Supermercado"));
    expect(screen.getByRole("heading", { name: "Detalhes da despesa" })).toBeInTheDocument();
  });

  it("separa a fatura: parceladas no topo e à vista abaixo, ordenadas por data", () => {
    stateMocks.expenses = [
      ...stateMocks.expenses,
      // Parcelada herdada (data do mês anterior à competência) e parcelada recente.
      { id: "e2", description: "Celular 10x", date: "2026-07-20", value: 300, report_weight: 1, bill_competence: "2026-08", installments_total: 10, installment_number: 2 },
      { id: "e3", description: "Notebook 3x", date: "2026-08-12", value: 1200, report_weight: 1, bill_competence: "2026-08", installments_total: 3, installment_number: 1 },
    ];
    try {
      render(<CardsPage />);

      // Os dois grupos aparecem com os títulos.
      expect(screen.getByText("Parceladas")).toBeInTheDocument();
      expect(screen.getByText("À vista")).toBeInTheDocument();
      expect(screen.getByText("Celular 10x")).toBeInTheDocument();
      expect(screen.getByText("Notebook 3x")).toBeInTheDocument();

      // Parceladas exibem a parcela atual como subtítulo (2/10, 1/3).
      expect(screen.getByText(/2\/10/)).toBeInTheDocument();
      expect(screen.getByText(/1\/3/)).toBeInTheDocument();

      // Parceladas vêm ANTES das à vista no DOM (grupo superior).
      const parceladasTitle = screen.getByText("Parceladas");
      const avistaTitle = screen.getByText("À vista");
      expect(parceladasTitle.compareDocumentPosition(avistaTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      stateMocks.expenses = stateMocks.expenses.filter((e) => e.id === "e1");
    }
  });

  it("abre o formulário de criação via FAB contextual (?novo=cartao)", () => {
    searchParamsMock.mockReturnValue([new URLSearchParams("novo=cartao"), vi.fn()]);
    render(<CardsPage />);
    expect(screen.getByRole("heading", { name: "Novo cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    searchParamsMock.mockReturnValue([new URLSearchParams(), vi.fn()]);
  });
});
