import { describe, expect, it } from "vitest";
import { buildUnifiedFeedItems, groupFeedByDay } from "./feed";
import type { Expense, Income } from "@/types";

describe("domain feed", () => {
  const mockExpenses: Expense[] = [
    {
      id: "exp-1",
      user_id: "u1",
      description: "Supermercado",
      value: 150.5,
      date: "2026-10-10",
      category_id: "cat-food",
      payment_method: "credit_card",
      card_id: "card-1",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-10",
      base_amount: 150.5,
      recurrence_id: null,
      report_weight: 1,
      created_at: "2026-10-10T10:00:00Z",
    },
    {
      id: "exp-2",
      user_id: "u1",
      description: "Netflix",
      value: 55.9,
      date: "2026-10-12",
      category_id: "cat-sub",
      payment_method: "credit_card",
      card_id: "card-1",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-10",
      base_amount: 55.9,
      recurrence_id: "rec-1",
      report_weight: 1,
      created_at: "2026-10-12T08:00:00Z",
    },
    {
      id: "exp-3",
      user_id: "u1",
      description: "Notebook 1/10",
      value: 300,
      date: "2026-10-12",
      category_id: "cat-tech",
      payment_method: "credit_card",
      card_id: "card-1",
      installments_total: 10,
      installment_number: 1,
      installment_group_id: "grp-1",
      bill_competence: "2026-10",
      base_amount: 3000,
      recurrence_id: null,
      report_weight: 1,
      created_at: "2026-10-12T09:00:00Z",
    },
  ];

  const mockIncomes: Income[] = [
    {
      id: "inc-1",
      user_id: "u1",
      description: "Salário",
      value: 5000,
      date: "2026-10-05",
      category_id: "cat-salary",
      receive_type: "cash",
      source_ref: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      recurrence_id: "rec-inc-1",
      report_weight: 1,
      created_at: "2026-10-05T08:00:00Z",
    },
    {
      id: "inc-2",
      user_id: "u1",
      description: "Freelance",
      value: 1200,
      date: "2026-10-12",
      category_id: "cat-extra",
      receive_type: "cash",
      source_ref: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      recurrence_id: null,
      report_weight: 1,
      created_at: "2026-10-12T14:00:00Z",
    },
  ];

  it("deve unificar despesas e receitas e ordenar por data decrescente", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "all");

    expect(items).toHaveLength(5);
    // Mais recente é 2026-10-12
    expect(items[0]?.date).toBe("2026-10-12");
    expect(items[1]?.date).toBe("2026-10-12");
    expect(items[2]?.date).toBe("2026-10-12");
    // Em 2026-10-12, a receita (Freelance) deve vir antes das despesas
    expect(items[0]?.kind).toBe("income");
    expect(items[0]?.description).toBe("Freelance");
    // O mais antigo é 2026-10-05
    expect(items[4]?.date).toBe("2026-10-05");
  });

  it("deve filtrar apenas receitas quando solicitado", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "incomes");
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === "income")).toBe(true);
  });

  it("deve filtrar apenas despesas quando solicitado", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "expenses");
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.kind === "expense")).toBe(true);
  });

  it("deve filtrar apenas recorrentes quando solicitado", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "recurring");
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(["exp-2", "inc-1"]);
  });

  it("deve filtrar apenas parceladas quando solicitado", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "installments");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("exp-3");
  });

  it("deve agrupar itens por dia e computar saldo líquido", () => {
    const items = buildUnifiedFeedItems(mockExpenses, mockIncomes, "all");
    const groups = groupFeedByDay(items);

    expect(groups).toHaveLength(3);
    // Grupo 1: 2026-10-12
    expect(groups[0]?.date).toBe("2026-10-12");
    expect(groups[0]?.items).toHaveLength(3);
    expect(groups[0]?.incomeCents).toBe(120000);
    expect(groups[0]?.expenseCents).toBe(5590 + 30000); // 35590
    expect(groups[0]?.netCents).toBe(120000 - 35590);

    // Grupo 2: 2026-10-10
    expect(groups[1]?.date).toBe("2026-10-10");
    expect(groups[1]?.netCents).toBe(-15050);

    // Grupo 3: 2026-10-05
    expect(groups[2]?.date).toBe("2026-10-05");
    expect(groups[2]?.netCents).toBe(500000);
  });
});
