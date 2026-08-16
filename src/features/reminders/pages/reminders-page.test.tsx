import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RemindersPage } from "./reminders-page";

const setStateMock = vi.fn();

// Dívidas variáveis por teste (para validar o caso de atrasadas de meses anteriores).
const stateMocks = vi.hoisted(() => ({
  debts: [
    { id: "d1", name: "Prestação carro", type: "payable", amount: 500, due_date: "2026-08-12", paid_at: null },
    { id: "d2", name: "Quitada", type: "payable", amount: 100, due_date: "2026-08-05", paid_at: "2026-08-06" },
    { id: "d3", name: "Empréstimo", type: "payable", amount: 300, due_date: "2026-08-25", paid_at: null },
  ],
}));

vi.mock("@/state", () => ({
  useCreditCards: () => ({
    data: [
      { id: "c1", name: "Nubank", due_day: 10, is_active: true },
      { id: "c2", name: "Inativo", due_day: 5, is_active: false },
    ],
    isLoading: false,
    error: null,
  }),
  useAllCardExpenses: () => ({
    data: [{ id: "e1", card_id: "c1", bill_competence: "2026-08", value: 2000, report_weight: 1 }],
    isLoading: false,
    error: null,
  }),
  useAllCardPayments: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useDebts: () => ({
    data: stateMocks.debts,
    isLoading: false,
    error: null,
  }),
  useReminderStates: () => ({
    data: [{ key: "debt:d1", kind: "read", snoozeUntil: undefined }],
    isLoading: false,
    error: null,
  }),
  useSetReminderState: () => ({ mutate: setStateMock }),
}));

describe("RemindersPage (central de lembretes §3.10)", () => {
  it("consolida faturas e dívidas, ocultando lidas", () => {
    render(<RemindersPage />);
    // Fatura Nubank com saldo (previsto 2.000, sem pagamento) → vence dia 10.
    expect(screen.getByText(/Fatura Nubank/)).toBeInTheDocument();
    // Prestação carro marcada como lida → não aparece.
    expect(screen.queryByText("Prestação carro")).not.toBeInTheDocument();
    // Empréstimo vence dia 25 (fora da janela) → não aparece.
    expect(screen.queryByText("Empréstimo")).not.toBeInTheDocument();
  });

  it("inclui dívidas vencidas de meses anteriores (atrasadas)", () => {
    stateMocks.debts = [
      ...stateMocks.debts,
      { id: "d4", name: "Prestação atrasada", type: "payable", amount: 400, due_date: "2026-07-25", paid_at: null },
    ];
    try {
      render(<RemindersPage />);
      // Atrasada de julho (antes do mês atual) NÃO pode sumir da central.
      expect(screen.getByText("Prestação atrasada")).toBeInTheDocument();
    } finally {
      stateMocks.debts = stateMocks.debts.filter((debt) => debt.id !== "d4");
    }
  });

  it("marcar como lido grava o estado", async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);
    const done = screen.getByRole("button", { name: /Marcar como lido/ });
    await user.click(done);
    expect(setStateMock).toHaveBeenCalledWith({
      occurrenceKey: expect.stringMatching(/^bill:/),
      state: { kind: "read" },
    });
  });
});
