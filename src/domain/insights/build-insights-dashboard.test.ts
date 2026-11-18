import { describe, expect, it } from "vitest";
import type { EmergencyFundComposition } from "@/domain/projection";
import type { Category, CreditCard, Debt, Expense, Income } from "@/types";
import { buildInsightsDashboard } from "./build-insights-dashboard";

const emptyComposition: EmergencyFundComposition = {
  totalReserveCents: 1_200_000,
  cashInAccountsCents: 1_200_000,
  portfolioReserveCents: 0,
  breakdown: [],
  warnings: [],
  targetMonths: 6,
  targetMonthsProgressPercent: 100,
  targetMonthsCents: 1_200_000,
};

const categories: Category[] = [
  { id: "c1", user_id: "u1", name: "Moradia", icon: "moradia", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c2", user_id: "u1", name: "Lazer", icon: "lazer", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c3", user_id: "u1", name: "Salário", icon: "salario", color: null, type: "income", is_reserved: false, is_active: true },
];

const cards: CreditCard[] = [
  {
    id: "card-1",
    user_id: "u1",
    name: "Nubank",
    brand: "Mastercard",
    credit_limit: 5000,
    color: "#8B5CF6",
    closing_day: 25,
    due_day: 5,
    is_active: true,
  },
];

function makeExpense(id: string, description: string, value: number, date: string, categoryId = "c2"): Expense {
  return {
    id,
    user_id: "u1",
    value,
    date,
    category_id: categoryId,
    payment_method: "credit_card",
    card_id: "card-1",
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: value,
    description,
    charge_kind: "regular",
    recurrence_id: null,
    created_at: `${date}T10:00:00Z`,
  };
}

function makeIncome(id: string, value: number, date: string): Income {
  return {
    id,
    user_id: "u1",
    value,
    date,
    category_id: "c3",
    receive_type: "transfer",
    description: "Salário",
    report_weight: 1,
    source_ref: null,
    recurrence_id: null,
    created_at: `${date}T10:00:00Z`,
  };
}

describe("buildInsightsDashboard", () => {
  it("calcula KPIs, recorrências ativas e pendências para o mês corrente", () => {
    const debts: Debt[] = [
      {
        id: "d1",
        user_id: "u1",
        name: "Freela",
        type: "receivable",
        amount: 400,
        due_date: "2026-08-20",
        paid_at: null,
        expense_id: null,
        installment_group_id: null,
        created_at: "2026-08-01",
      },
    ];

    const result = buildInsightsDashboard({
      month: "2026-08",
      currentCalendarMonth: "2026-08",
      now: new Date(2026, 7, 15, 12, 0, 0),
      expensesByMonth: [
        [makeExpense("e1", "Streaming", 39.9, "2026-08-05"), makeExpense("e2", "Aluguel", 1500, "2026-08-10", "c1")],
        [makeExpense("e3", "Streaming", 39.9, "2026-07-05"), makeExpense("e4", "Aluguel", 1500, "2026-07-10", "c1")],
        [makeExpense("e5", "Streaming", 39.9, "2026-06-05"), makeExpense("e6", "Aluguel", 1500, "2026-06-10", "c1")],
        [],
      ],
      incomes: [makeIncome("i1", 5000, "2026-08-05")],
      budgets: [],
      categories,
      cards,
      debts,
      feedbackMap: {},
      portfolioRows: [],
      monthlyContributionCents: 0,
      committedObligationsCents: 50000,
      openInvoicesCents: 30000,
      emergencyComposition: emptyComposition,
      householdData: null,
    });

    expect(result.incomeCents).toBe(500_000);
    expect(result.expenseCents).toBe(153_990);
    expect(result.hasTransactions).toBe(true);
    expect(result.activeOccurrences.some((o) => o.name === "Streaming")).toBe(true);
    expect(result.pendingSummary.receivablesCents).toBe(40_000);
    expect(result.pendingSummary.payablesCents).toBe(30_000);
    expect(result.essentialSpending.ratioPercent).toBeGreaterThan(90);
  });

  it("formata datas de vencimento em pt-BR e corrige ortografia nos avisos de renda fixa", () => {
    const result = buildInsightsDashboard({
      month: "2026-08",
      currentCalendarMonth: "2026-08",
      now: new Date(2026, 7, 15, 12, 0, 0),
      expensesByMonth: [[], [], [], []],
      incomes: [makeIncome("i1", 5000, "2026-08-05")],
      budgets: [],
      categories,
      cards,
      debts: [],
      feedbackMap: {},
      portfolioRows: [
        {
          assetId: "a1",
          ticker: "CDB-BANCO",
          isMatured: false,
          maturityDate: "2026-08-25",
          fixedIncomeResult: { taxCountdown: { daysRemaining: 10, nextRatePct: 17.5 } },
        },
        {
          assetId: "a2",
          ticker: "LCI-VENCIDA",
          isMatured: true,
          maturityDate: "2026-08-10",
        },
      ],
      monthlyContributionCents: 0,
      committedObligationsCents: 0,
      openInvoicesCents: 0,
      emergencyComposition: emptyComposition,
      householdData: null,
    });

    const maturing = result.warnings.find((w) => w.id === "maturing-a1");
    expect(maturing?.message).toContain("25/08/2026");
    expect(maturing?.message).toContain("Planeje o reinvestimento do montante.");

    const matured = result.warnings.find((w) => w.id === "matured-a2");
    expect(matured?.message).toContain("10/08/2026");

    const taxOpt = result.warnings.find((w) => w.id === "tax-opt-a1");
    expect(taxOpt?.variant).toBe("success");
    expect(taxOpt?.message).toContain("17.5%");
  });

  it("inclui acerto familiar e teto excedido nos avisos formatados em BRL", () => {
    const result = buildInsightsDashboard({
      month: "2026-08",
      currentCalendarMonth: "2026-08",
      now: new Date(2026, 7, 15, 12, 0, 0),
      expensesByMonth: [[], [], [], []],
      incomes: [makeIncome("i1", 5000, "2026-08-05")],
      budgets: [],
      categories,
      cards,
      debts: [],
      feedbackMap: {},
      portfolioRows: [],
      monthlyContributionCents: 0,
      committedObligationsCents: 0,
      openInvoicesCents: 0,
      emergencyComposition: emptyComposition,
      currentUserId: "u1",
      householdData: {
        family: {
          id: "f1",
          name: "Família",
          owner_id: "u1",
          monthly_budget_cents: 200_000,
          split_rule: "equal",
        },
        month: "2026-08",
        monthly_ceiling_cents: 200_000,
        total_spent_cents: 250_000,
        total_income_cents: 500_000,
        remaining_cents: -50_000,
        spent_percentage: 125,
        members: [],
        expenses: [],
        is_settled: false,
        has_post_settlement_expenses: false,
        settlement: {
          id: "s1",
          month: "2026-08",
          payer_id: "u1",
          payer_name: "Ana",
          receiver_id: "u2",
          receiver_name: "Bruno",
          amount_cents: 25_000,
          settled_at: "2026-08-15",
          payment_method: "pix",
          notes: null,
          created_at: "2026-08-15",
        },
      },
    });

    const ceiling = result.warnings.find((w) => w.id === "household-ceiling-exceeded");
    expect(ceiling?.variant).toBe("error");
    expect(ceiling?.message).toContain("R$ 500,00");

    const settlement = result.warnings.find((w) => w.id === "household-settlement-pending");
    expect(settlement?.message).toContain("R$ 250,00");
    expect(result.pendingSummary.payablesCents).toBe(25_000);
  });
});
