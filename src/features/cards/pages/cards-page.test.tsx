import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardsPage } from "./cards-page";

vi.mock("react-router", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const paymentMock = vi.fn();
const refundMock = vi.fn();
const createCardMock = vi.fn();
const updateCardMock = vi.fn();

vi.mock("@/state", () => ({
  useCreditCards: () => ({
    data: [
      {
        id: "c1",
        name: "Nubank",
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
    data: [
      {
        id: "e1",
        description: "Supermercado",
        date: "2026-08-05",
        value: 150,
        report_weight: 1,
        bill_competence: "2026-08",
      },
    ],
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
}));

describe("CardsPage — faturas, pagamentos e estornos (§3.3.3)", () => {
  it("exibe KPIs da fatura (previsto, pago, saldo aberto)", () => {
    render(<CardsPage />);
    expect(screen.getByText("Previsto")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Saldo aberto")).toBeInTheDocument();
    // Previsto R$ 150,00 · Pago R$ 100,00 · Saldo R$ 50,00
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
  });

  it("lista despesas da competência e pagamentos", () => {
    render(<CardsPage />);
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Pagamento de fatura")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Novo cartão" }));
    expect(screen.getByRole("heading", { name: "Novo cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });
});
