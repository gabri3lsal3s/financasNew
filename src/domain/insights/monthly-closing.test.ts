import { describe, expect, it } from "vitest";
import type { Budget, Category, Expense, Income } from "@/types";
import { buildMonthlyClosingSummary } from "./monthly-closing";

const categories: Category[] = [
  { id: "c1", user_id: "u1", name: "Lazer", icon: "lazer", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c2", user_id: "u1", name: "Compras", icon: "compras", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c3", user_id: "u1", name: "Salário", icon: "salario", color: null, type: "income", is_reserved: false, is_active: true },
  { id: "c4", user_id: "u1", name: "Saúde", icon: "saude", color: null, type: "expense", is_reserved: false, is_active: true },
];

const budgets: Budget[] = [
  { id: "b1", user_id: "u1", category_id: "c1", month: "2026-10", limit: 400 }, // estourado
  { id: "b2", user_id: "u1", category_id: "c2", month: "2026-10", limit: 1200 }, // discricionário subutilizado -> reduz
  { id: "b4", user_id: "u1", category_id: "c4", month: "2026-10", limit: 800 }, // essencial subutilizado -> NÃO reduz
];

const closedExpenses: Expense[] = [
  {
    id: "e1",
    user_id: "u1",
    value: 600,
    date: "2026-10-12",
    category_id: "c1",
    payment_method: "pix",
    card_id: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: 600,
    description: "Show",
    charge_kind: "regular",
    recurrence_id: null,
    created_at: "2026-10-12",
  },
  {
    id: "e2",
    user_id: "u1",
    value: 300,
    date: "2026-10-15",
    category_id: "c2",
    payment_method: "pix",
    card_id: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: 300,
    description: "Feira",
    charge_kind: "regular",
    recurrence_id: null,
    created_at: "2026-10-15",
  },
];

const closedIncomes: Income[] = [
  {
    id: "i1",
    user_id: "u1",
    value: 5000,
    date: "2026-10-05",
    category_id: "c3",
    receive_type: "transfer",
    description: "Salário",
    report_weight: 1,
    source_ref: null,
    recurrence_id: null,
    created_at: "2026-10-05",
  },
];

describe("buildMonthlyClosingSummary (Fase 6)", () => {
  it("gera resumo completo nos dias 1 a 5 com resultado real, conquista e até 2 sugestões de teto", () => {
    const summary = buildMonthlyClosingSummary({
      currentMonth: "2026-11",
      dayOfMonth: 3,
      dismissedMonth: null,
      closedMonthExpenses: closedExpenses,
      closedMonthIncomes: closedIncomes,
      budgets,
      categories,
    });

    expect(summary).not.toBeNull();
    expect(summary?.closedMonth).toBe("2026-10");
    expect(summary?.incomeCents).toBe(500_000);
    expect(summary?.expenseCents).toBe(90_000);
    expect(summary?.balanceCents).toBe(410_000);
    expect(summary?.savingsRatePercent).toBe(82);
    expect(summary?.highlightAchievement).toContain("82%");
    expect(summary?.limitSuggestions).toHaveLength(2);
    expect(summary?.limitSuggestions.some((s) => s.categoryId === "c1" && s.kind === "increase")).toBe(true);
    expect(summary?.limitSuggestions.some((s) => s.categoryId === "c2" && s.kind === "reduce")).toBe(true);
  });

  it("retorna null após o dia 5 ou quando já foi dispensado para M-1", () => {
    expect(
      buildMonthlyClosingSummary({
        currentMonth: "2026-11",
        dayOfMonth: 6,
        dismissedMonth: null,
        closedMonthExpenses: closedExpenses,
        closedMonthIncomes: closedIncomes,
        budgets,
        categories,
      }),
    ).toBeNull();

    expect(
      buildMonthlyClosingSummary({
        currentMonth: "2026-11",
        dayOfMonth: 2,
        dismissedMonth: "2026-10",
        closedMonthExpenses: closedExpenses,
        closedMonthIncomes: closedIncomes,
        budgets,
        categories,
      }),
    ).toBeNull();
  });
});
