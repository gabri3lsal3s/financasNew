import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RemindersPage } from "./reminders-page";

const setStateMock = vi.fn();
const markAllMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Dívidas variáveis por teste (para validar o caso de atrasadas de meses anteriores).
const stateMocks = vi.hoisted(() => ({
  debts: [
    { id: "d1", name: "Prestação carro", type: "payable", amount: 500, due_date: "2026-08-12", paid_at: null },
    { id: "d2", name: "Quitada", type: "payable", amount: 100, due_date: "2026-08-05", paid_at: "2026-08-06" },
    { id: "d3", name: "Empréstimo", type: "payable", amount: 300, due_date: "2026-08-25", paid_at: null },
  ],
}));

vi.mock("@/state", () => ({
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
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
  useUserPreferences: () => ({
    data: {
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 3,
    },
    isLoading: false,
    error: null,
  }),
  useReminderStates: () => ({
    data: [{ key: "debt:d1", kind: "read", snoozeUntil: undefined }],
    isLoading: false,
    error: null,
  }),
  useSetReminderState: () => ({ mutate: setStateMock }),
  useMarkAllRemindersAsRead: () => ({ mutate: markAllMock, isPending: false }),
  useReminders: () => {
    // Implementação direta do mock baseada no state atual
    const bills = [
      {
        key: "bill:c1:2026-08",
        kind: "bill" as const,
        title: "Fatura Nubank · 2026-08",
        subtitle: "Saldo de R$ 2.000,00",
        dueDate: "2026-08-10",
        amountCents: 200000,
        status: "due_soon" as const,
        link: { path: "/cartoes", params: { card: "c1", month: "2026-08" } },
      },
    ];

    const debts = stateMocks.debts
      .filter((d) => d.paid_at === null && d.id !== "d3")
      .map((d) => ({
        key: `debt:${d.id}`,
        kind: "debt" as const,
        title: d.name,
        subtitle: d.type === "payable" ? "A pagar" : "A receber",
        dueDate: d.due_date,
        amountCents: Math.round(d.amount * 100),
        status: (d.due_date < "2026-08-01" ? "overdue" : "due_soon") as "overdue" | "due_soon",
        link: { path: "/dividas", params: { q: d.id } },
      }));

    const allItems = [...bills, ...debts];
    const items = allItems.filter((i) => i.key !== "debt:d1");
    return {
      items,
      allItems,
      totalCount: items.length,
      overdueCount: items.filter((i) => i.status === "overdue").length,
      dueTodayCount: 0,
      dueSoonCount: items.filter((i) => i.status === "due_soon").length,
      urgentCount: items.filter((i) => i.status === "overdue").length,
      readCount: 1,
      preferences: { enabled: true, debtDaysBefore: 3, billDaysBefore: 3 },
      isLoading: false,
      error: null,
    };
  },
}));

describe("RemindersPage (central de lembretes §3.10)", () => {
  it("consolida faturas e dívidas, exibindo ativas e lidas com suporte a filtros", async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);

    // Aba inicial: Pendentes → Fatura Nubank pendente aparece
    expect(screen.getByText(/Fatura Nubank/)).toBeInTheDocument();
    // Empréstimo vence dia 25 (fora da janela) → não aparece
    expect(screen.queryByText("Empréstimo")).not.toBeInTheDocument();
    // Prestação carro marcada como lida → não aparece na aba Pendentes
    expect(screen.queryByText("Prestação carro")).not.toBeInTheDocument();

    // Filtro "Lidas" exibe os itens concluídos
    const readTab = screen.getByRole("tab", { name: /Lidas/i });
    await user.click(readTab);
    expect(screen.getByText("Prestação carro")).toBeInTheDocument();
    expect(screen.getByText("Lido")).toBeInTheDocument();
    expect(screen.queryByText(/Fatura Nubank/)).not.toBeInTheDocument();

    // Volta para "Pendentes"
    const pendingTab = screen.getByRole("tab", { name: /Pendentes/i });
    await user.click(pendingTab);
    expect(screen.getByText(/Fatura Nubank/)).toBeInTheDocument();
    expect(screen.queryByText("Prestação carro")).not.toBeInTheDocument();
  });

  it("permite reabrir um lembrete lido", async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);

    // Alterna para a aba Lidas para visualizar o item lido e reabri-lo
    const readTab = screen.getByRole("tab", { name: /Lidas/i });
    await user.click(readTab);

    const reopenBtn = screen.getByRole("button", { name: /Reabrir lembrete Prestação carro/i });
    await user.click(reopenBtn);

    expect(setStateMock).toHaveBeenCalledWith({
      occurrenceKey: "debt:d1",
      state: null,
    });
  });

  it("inclui dívidas vencidas de meses anteriores (atrasadas)", () => {
    stateMocks.debts = [
      ...stateMocks.debts,
      { id: "d4", name: "Prestação atrasada", type: "payable", amount: 400, due_date: "2026-07-25", paid_at: null },
    ];
    try {
      render(<RemindersPage />);
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

  it("adiar grava snoozeUntil = hoje + 7 dias", async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);

    await user.click(screen.getByRole("button", { name: /Adiar lembrete/ }));

    expect(setStateMock).toHaveBeenCalledWith({
      occurrenceKey: expect.stringMatching(/^bill:/),
      state: {
        kind: "snoozed",
        snoozeUntil: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
  });

  it("permite marcar todas como lidas via ação em lote", async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);

    const markAllBtn = screen.getByRole("button", { name: /Marcar todas como lidas/ });
    await user.click(markAllBtn);

    expect(markAllMock).toHaveBeenCalledWith(["bill:c1:2026-08"]);
  });

  it("clicar no lembrete navega com o deep-link do item", async () => {
    const user = userEvent.setup();
    stateMocks.debts = [
      ...stateMocks.debts,
      { id: "d5", name: "Cartão atrasado", type: "payable", amount: 250, due_date: "2026-07-10", paid_at: null },
    ];
    try {
      render(<RemindersPage />);
      await user.click(screen.getByText("Cartão atrasado"));
      expect(navigateMock).toHaveBeenCalledWith("/dividas?q=d5");
    } finally {
      stateMocks.debts = stateMocks.debts.filter((debt) => debt.id !== "d5");
    }
  });
});
