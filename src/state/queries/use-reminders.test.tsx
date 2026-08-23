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
});
