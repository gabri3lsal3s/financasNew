import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCardSubscriptionRadar } from "./use-card-subscription-radar";
import type { Category, CreditCard, Expense } from "@/types";

vi.mock("@/domain/debts", () => ({
  todayISO: () => "2026-10-05",
}));

vi.mock("@/state", () => ({
  useFeedback: () => ({ data: {} }),
  useSetFeedback: () => ({ mutate: vi.fn() }),
}));

describe("useCardSubscriptionRadar (FASE 2 — Paradoxo da Recorrência Formal)", () => {
  it("mantém assinatura formalizada (recurrence_id != null) protegida no Radar de Fatura do cartão", () => {
    const selectedCard: CreditCard = {
      id: "card-nu",
      user_id: "u1",
      name: "Nubank",
      brand: "mastercard",
      color: "#820ad1",
      is_active: true,
      closing_day: 15,
      due_day: 22,
      credit_limit: 5000,
    };

    const categories: Category[] = [
      {
        id: "cat-stream",
        user_id: "u1",
        name: "Assinaturas",
        type: "expense",
        icon: "assinaturas",
        color: null,
        is_reserved: false,
        is_active: true,
      },
    ];
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const allExpenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        description: "Netflix",
        value: 55.9,
        base_amount: 55.9,
        date: "2026-08-10",
        category_id: "cat-stream",
        payment_method: "credit_card",
        card_id: "card-nu",
        bill_competence: "2026-08",
        report_weight: 1,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        recurrence_id: "rec-netflix",
        trip_id: null,
        created_at: "2026-08-10T10:00:00Z",
      },
      {
        id: "e2",
        user_id: "u1",
        description: "Netflix",
        value: 55.9,
        base_amount: 55.9,
        date: "2026-09-10",
        category_id: "cat-stream",
        payment_method: "credit_card",
        card_id: "card-nu",
        bill_competence: "2026-09",
        report_weight: 1,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        recurrence_id: "rec-netflix",
        trip_id: null,
        created_at: "2026-09-10T10:00:00Z",
      },
    ];

    const { result } = renderHook(() =>
      useCardSubscriptionRadar({
        selectedCard,
        allExpenses,
        categoryById,
        currentInvoiceSaldoBrutoCents: 100_000,
        isReadOnlyMode: false,
        onRequireUpgrade: vi.fn(),
      }),
    );

    expect(result.current.cardSubscriptionImpact).not.toBeNull();
    expect(result.current.cardSubscriptionImpact?.projectedCount).toBe(1);
    expect(result.current.cardSubscriptionImpact?.totalProjectedCents).toBe(5590);
    expect(result.current.cardSubscriptionImpact?.items[0]?.name).toBe("Netflix");
  });
});
