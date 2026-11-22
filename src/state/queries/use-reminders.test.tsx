import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReminders } from "./use-reminders";

const mockCreditCards = {
  data: [
    { id: "c1", name: "Nubank", due_day: 10, closing_day: 3, is_active: true, limit_cents: 500000 },
  ],
  isLoading: false,
  error: null,
};

const mockCardExpenses = {
  data: [
    {
      id: "e1",
      card_id: "c1",
      value: 150,
      bill_competence: "2026-08",
      date: "2026-08-01",
      report_weight: 1,
    },
  ],
  isLoading: false,
  error: null,
};

const mockCardPayments = {
  data: [],
  isLoading: false,
  error: null,
};

const mockDebts = {
  data: [
    {
      id: "d1",
      name: "Empréstimo",
      amount: 200,
      due_date: "2026-08-10",
      paid_at: null,
      type: "payable",
    },
  ],
  isLoading: false,
  error: null,
};

const mockStates = {
  data: [],
  isLoading: false,
  error: null,
};

const mockSplitShares = {
  data: [] as Array<{ id: string; debt_id?: string | null; expense_id?: string | null; payload?: Record<string, unknown> }>,
  isLoading: false,
  error: null,
};

const mockPreferences = {
  data: {
    reminders_enabled: true,
    reminder_days_before_debt: 3,
    reminder_days_before_bill: 3,
  },
  isLoading: false,
  error: null,
};

vi.mock("@/state/queries/use-credit-cards", () => ({
  useCreditCards: () => mockCreditCards,
}));

vi.mock("@/state/queries/use-overview", () => ({
  useAllCardExpenses: () => mockCardExpenses,
  useAllCardPayments: () => mockCardPayments,
}));

vi.mock("@/state/queries/use-debts", () => ({
  useDebts: () => mockDebts,
}));

vi.mock("@/state/queries/use-public-shares", () => ({
  useMyPublicShares: () => mockSplitShares,
}));

vi.mock("@/state/queries/use-reminder-states", () => ({
  useReminderStates: () => mockStates,
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => mockPreferences,
}));

describe("useReminders", () => {
  it("consolida faturas e dívidas respeitando preferências e estados", () => {
    // Hoje: 2026-08-08 (dívida e fatura vencem em 2026-08-10, dentro da janela de 3 dias)
    const { result } = renderHook(() => useReminders("2026-08-08"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.items).toHaveLength(2);
    expect(result.current.allItems).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.readCount).toBe(0);
    expect(result.current.preferences.enabled).toBe(true);
  });

  it("retorna lista vazia de itens quando queries essenciais estiverem carregando para evitar falsos positivos", () => {
    mockCardPayments.isLoading = true;
    const { result } = renderHook(() => useReminders("2026-08-08"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.allItems).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.readHistoryItems).toHaveLength(0);
    mockCardPayments.isLoading = false;
  });

  it("suprime dívidas vinculadas a rachas e mantém contas a receber fora de overdueCount/urgentCount", () => {
    const prevDebts = mockDebts.data;
    mockDebts.data = [
      ...prevDebts,
      {
        id: "d-racha",
        name: "Racha: Jantar",
        amount: 80,
        due_date: "2026-08-01",
        paid_at: null,
        type: "receivable",
      },
      {
        id: "d-recv",
        name: "Reembolso Trabalho",
        amount: 300,
        due_date: "2026-08-02",
        paid_at: null,
        type: "receivable",
      },
    ] as never;
    mockSplitShares.data = [{ id: "share-1", debt_id: "d-racha" }];

    // Hoje: 2026-08-10 (fatura Nubank vence hoje!)
    const { result } = renderHook(() => useReminders("2026-08-10"));

    expect(result.current.items.some((i) => i.key === "debt:d-racha")).toBe(false);
    const recv = result.current.items.find((i) => i.key === "debt:d-recv");
    expect(recv?.status).toBe("pending");
    expect(recv?.direction).toBe("receivable");
    expect(result.current.receivableCount).toBe(1);
    expect(result.current.overdueCount).toBe(0);
    expect(result.current.dueTodayCount).toBe(2); // fatura + d1 vencem em 2026-08-10
    expect(result.current.urgentCount).toBe(2);

    mockDebts.data = prevDebts;
    mockSplitShares.data = [];
  });

  it("reconstitui histórico de itens lidos mesmo quando faturas foram quitadas ou passaram da janela", () => {
    // Simula fatura quitada de mês anterior marcada como lida
    mockStates.data = [
      { key: "bill:c1:2026-07", kind: "read" },
      { key: "debt:d1", kind: "read" },
    ] as never;

    const { result } = renderHook(() => useReminders("2026-08-08"));

    expect(result.current.readHistoryItems).toHaveLength(2);
    expect(result.current.readCount).toBe(2);
    expect(result.current.readHistoryItems.some((i) => i.key === "bill:c1:2026-07")).toBe(true);
    expect(result.current.readHistoryItems.some((i) => i.key === "debt:d1")).toBe(true);

    mockStates.data = [];
  });
});
