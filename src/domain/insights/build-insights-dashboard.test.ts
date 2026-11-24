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
    // Com apenas 2 lançamentos no mês (< 3), Gastos Essenciais entra em estado "em_formacao"
    expect(result.essentialSpending.status).toBe("em_formacao");
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

  describe("Fase 4 — Portão de Qualidade (Diagnósticos, Essenciais, Desafios & Congruência)", () => {
    it("Cenário 1: 1 despesa R$ 50 sem renda gera exatamente 1 aviso informativo e estados neutros", () => {
      const result = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 23, 12, 0, 0),
        expensesByMonth: [[makeExpense("e1", "Lanche", 50, "2026-08-23", "c2")], [], [], []],
        incomes: [],
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
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.variant).toBe("info");
      expect(result.health).toBe("indefinido");
      expect(result.trendHasPreviousBase).toBe(false);
      expect(result.trendPercent).toBe(0);
      expect(result.essentialSpending.status).toBe("em_formacao");
      expect(result.weekendComparable).toBe(false);
      expect(result.paceBreakdown).toBeNull();
    });

    it("Cenário 2: aluguel compartilhado (report_weight = 0.5) entra exatamente com 50% em Gastos Essenciais", () => {
      const sharedRent: Expense = {
        ...makeExpense("e-rent", "Aluguel", 2000, "2026-08-05", "c1"),
        report_weight: 0.5,
      };
      const result = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 15, 12, 0, 0),
        expensesByMonth: [
          [
            sharedRent,
            makeExpense("e2", "Cinema", 200, "2026-08-06", "c2"),
            makeExpense("e3", "Jantar", 300, "2026-08-08", "c2"),
          ],
          [],
          [],
          [],
        ],
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
      });

      // Aluguel 2000 * 0.5 = 1000 (100_000 cents)
      expect(result.essentialSpending.essentialCents).toBe(100_000);
      expect(result.essentialSpending.hasCriticalMass).toBe(true);
      // Base de referência = renda (500_000 cents): 100_000 / 500_000 = 20%
      expect(result.essentialSpending.ratioPercent).toBe(20);
    });

    it("Cenário 3: despesa marcada como 'essential' no feedback entra em Gastos Essenciais e sai dos Desafios de Corte", () => {
      const result = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 15, 12, 0, 0),
        expensesByMonth: [
          [
            makeExpense("e1", "Academia Saúde", 600, "2026-08-05", "c2"),
            makeExpense("e2", "Cinema", 100, "2026-08-06", "c2"),
            makeExpense("e3", "Aluguel", 1500, "2026-08-10", "c1"),
          ],
          [makeExpense("e1b", "Academia Saúde", 600, "2026-07-05", "c2")],
          [makeExpense("e1c", "Academia Saúde", 600, "2026-06-05", "c2")],
          [],
        ],
        incomes: [makeIncome("i1", 4000, "2026-08-05")],
        budgets: [],
        categories,
        cards,
        debts: [],
        feedbackMap: {
          "habit:academia saude": "essential",
        },
        portfolioRows: [],
        monthlyContributionCents: 0,
        committedObligationsCents: 0,
        openInvoicesCents: 0,
        emergencyComposition: emptyComposition,
      });

      // Aluguel (1500) + Academia Saúde (600) = 2100 (210_000 cents)
      expect(result.essentialSpending.essentialCents).toBe(210_000);
      // Nos desafios, Academia Saúde foi excluída da média da categoria Lazer (sobrou apenas 100/mês < 10% da renda 4000)
      expect(result.challenges.some((c) => c.categoryId === "c2")).toBe(false);
    });

    it("Congruência Matemática (?): paceBreakdown usa dayOfMonth real e bate ao centavo com projectedExpensesCents", () => {
      const result = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 23, 12, 0, 0),
        expensesByMonth: [
          [
            makeExpense("e1", "Mercado", 800, "2026-08-04", "c2"),
            makeExpense("e2", "Aluguel", 1500, "2026-08-10", "c1"),
          ],
          [
            makeExpense("e3", "Mercado", 700, "2026-07-05", "c2"),
            makeExpense("e4", "Aluguel", 1500, "2026-07-10", "c1"),
          ],
          [],
          [],
        ],
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
      });

      expect(result.dayOfMonth).toBe(23);
      expect(result.daysInMonth).toBe(31);
      expect(result.paceBreakdown).not.toBeNull();
      expect(result.paceBreakdown?.periodLabel).toContain("dia 23 de 31");
      // O resultado da projeção na Memória de Cálculo (?) bate com surplusCents
      expect(result.paceBreakdown?.result.rawValue).toBe(result.surplusCents);
    });

    it("Blindagem de Cortes: Alimentação (R$ 50 sem renda ou R$ 800 com renda) e Empréstimos jamais recebem Desafio de Corte", () => {
      const fullCategories: Category[] = [
        ...categories,
        { id: "c-alim", user_id: "u1", name: "Alimentação", icon: "alimentacao", color: null, type: "expense", is_reserved: false, is_active: true },
        { id: "c-emp", user_id: "u1", name: "Empréstimos", icon: "emprestimo", color: null, type: "expense", is_reserved: false, is_active: true },
        { id: "c-comp", user_id: "u1", name: "Compras", icon: "compras", color: null, type: "expense", is_reserved: false, is_active: true },
      ];

      // 1. Cenário exato do print: 1 despesa R$ 50 em Alimentação, sem renda e várias categorias zeradas
      const coldResult = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 23, 12, 0, 0),
        expensesByMonth: [[makeExpense("e1", "Almoço", 50, "2026-08-23", "c-alim")], [], [], []],
        incomes: [],
        budgets: [],
        categories: fullCategories,
        cards,
        debts: [],
        feedbackMap: {},
        portfolioRows: [],
        monthlyContributionCents: 0,
        committedObligationsCents: 0,
        openInvoicesCents: 0,
        emergencyComposition: emptyComposition,
      });

      expect(coldResult.challenges).toEqual([]);
      expect(coldResult.discretionary).toBeNull();
      expect(coldResult.showDiscretionary).toBe(false);
      expect(coldResult.essentialSpending.essentialCents).toBe(5_000);

      // 2. Com renda cadastrada (R$ 3.000): Alimentação (R$ 800) e Empréstimos (R$ 600) NÃO entram; Compras (R$ 500) entra
      const activeResult = buildInsightsDashboard({
        month: "2026-08",
        currentCalendarMonth: "2026-08",
        now: new Date(2026, 7, 23, 12, 0, 0),
        expensesByMonth: [
          [
            makeExpense("e1", "Supermercado e Feira", 800, "2026-08-05", "c-alim"),
            makeExpense("e2", "Parcela Empréstimo", 600, "2026-08-10", "c-emp"),
            makeExpense("e3", "Roupas e Eletrônicos", 500, "2026-08-12", "c-comp"),
          ],
          [],
          [],
          [],
        ],
        incomes: [makeIncome("i1", 3000, "2026-08-05")],
        budgets: [],
        categories: fullCategories,
        cards,
        debts: [],
        feedbackMap: {},
        portfolioRows: [],
        monthlyContributionCents: 0,
        committedObligationsCents: 0,
        openInvoicesCents: 0,
        emergencyComposition: emptyComposition,
      });

      expect(activeResult.challenges.some((c) => c.categoryId === "c-alim")).toBe(false);
      expect(activeResult.challenges.some((c) => c.categoryId === "c-emp")).toBe(false);
      expect(activeResult.challenges.some((c) => c.categoryId === "c-comp")).toBe(true);
    });
  });
});
