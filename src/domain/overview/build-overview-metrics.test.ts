import { describe, expect, it } from "vitest";
import { buildUserFinancialContext } from "@/domain/insights";
import type { Budget, Category, Debt, Expense, Income, PublicShare } from "@/types";
import {
  OVERVIEW_OTHERS_COLOR,
  buildOverviewCashGapResult,
  buildOverviewWeeklyRadarSummary,
  buildPredictedUpcomingCashInflows,
  computeCurrentMonthProjectionMetrics,
  computeLiveGoalProgressMap,
  computeMonthlyCashflowMetrics,
  computeOverviewBudgetAndDonutData,
  computePendingSplitReceivables,
  filterEligibleGoalShares,
} from "./build-overview-metrics";

const makeCategory = (id: string, name: string): Category => ({
  id,
  user_id: "u1",
  type: "expense",
  name,
  icon: "tag",
  color: null,
  is_reserved: false,
  is_active: true,
});

const makeExpense = (id: string, value: number, categoryId: string, date = "2026-08-10"): Expense => ({
  id,
  user_id: "u1",
  value,
  date,
  category_id: categoryId,
  payment_method: "pix",
  card_id: null,
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: null,
  report_weight: 1,
  base_amount: value,
  description: null,
  created_at: "2026-08-10T00:00:00Z",
});

const makeIncome = (id: string, value: number, date = "2026-08-05"): Income => ({
  id,
  user_id: "u1",
  value,
  date,
  category_id: "inc-cat",
  receive_type: "pix",
  description: null,
  report_weight: 1,
  source_ref: null,
  created_at: "2026-08-05T00:00:00Z",
});

describe("build-overview-metrics (seletores puros da Visão Geral)", () => {
  it("computeMonthlyCashflowMetrics calcula totais brutos, ponderados e fluxo diário", () => {
    const res = computeMonthlyCashflowMetrics({
      month: "2026-08",
      prevMonth: "2026-07",
      incomes: [makeIncome("i1", 5000)],
      expenses: [{ ...makeExpense("e1", 2000, "c1"), report_weight: 0.5 }],
      prevIncomes: [makeIncome("i0", 4000, "2026-07-05")],
      prevExpenses: [makeExpense("e0", 1500, "c1", "2026-07-10")],
      contributions: [
        { id: "ct1", user_id: "u1", asset_id: "a1", date: "2026-08-12", amount: 500, notes: null, created_at: "2026-08-12T00:00:00Z" },
      ],
    });

    expect(res.incomeCents).toBe(500000);
    expect(res.expenseCents).toBe(100000);
    expect(res.grossExpenseCents).toBe(200000);
    expect(res.investmentCents).toBe(50000);
    expect(res.totals.operatingBalanceCents).toBe(300000);
    expect(res.dailyFlow).toHaveLength(31);
  });

  it("computeCurrentMonthProjectionMetrics retorna zeros fora do mês vigente", () => {
    const res = computeCurrentMonthProjectionMetrics({
      isCurrentMonth: false,
      grossIncomeCents: 500000,
      grossExpenseCents: 300000,
      investmentCents: 50000,
      dayOfMonth: 15,
      daysInMonth: 31,
    });
    expect(res.pace.active).toBe(false);
    expect(res.daily.dailyCents).toBeNull();
    expect(res.showPaceAlert).toBe(false);
  });

  it("computePendingSplitReceivables aguarda loading e preserva filtros de splits públicos e grupos de parcelas", () => {
    expect(
      computePendingSplitReceivables({ isLoading: true, debts: [], splitShares: [] }).count,
    ).toBe(0);

    const shareArchived: PublicShare = {
      id: "s-arch",
      user_id: "u1",
      kind: "split",
      token: "t1",
      expires_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      is_revoked: false,
      payload: {
        title: "Arquivado",
        total_cents: 5000,
        people_count: 2,
        guest_share_cents: 2500,
        status: "archived",
      },
    };

    const sharePending: PublicShare = {
      id: "s-open",
      user_id: "u1",
      kind: "split",
      token: "t2",
      expires_at: null,
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
      is_revoked: false,
      payload: {
        title: "Churrasco",
        debt_id: "d-mapped",
        total_cents: 10000,
        people_count: 2,
        participants: [
          { id: "p1", name: "Host", share_cents: 5000, is_host: true, is_settled: true },
          { id: "p2", name: "Ana", share_cents: 5000, is_host: false, is_settled: false, settled_cents: 1000 },
        ],
      },
    };

    const debts: Debt[] = [
      {
        id: "d-mapped",
        user_id: "u1",
        name: "Racha: Churrasco",
        type: "receivable",
        amount: 50,
        due_date: "2026-08-20",
        paid_at: null,
        expense_id: null,
        installment_group_id: "grp-1",
        created_at: "2026-08-02T00:00:00Z",
      },
      {
        id: "d-grp-sibling",
        user_id: "u1",
        name: "Racha: Churrasco 2/2",
        type: "receivable",
        amount: 50,
        due_date: "2026-09-20",
        paid_at: null,
        expense_id: null,
        installment_group_id: "grp-1",
        created_at: "2026-08-02T00:00:00Z",
      },
    ];

    const res = computePendingSplitReceivables({
      isLoading: false,
      debts,
      splitShares: [shareArchived, sharePending],
    });

    expect(res.count).toBe(1);
    expect(res.pendingCents).toBe(4000);
    expect(res.items[0]?.title).toBe("Churrasco");
  });

  it("computeOverviewBudgetAndDonutData agrupa Top 5 + Demais usando token CSS (sem hex hardcoded)", () => {
    const categories = Array.from({ length: 7 }, (_, i) => makeCategory(`c${i + 1}`, `Cat ${i + 1}`));
    const expenses = categories.map((cat, i) => makeExpense(`e${i}`, (7 - i) * 100, cat.id));
    const budgets: Budget[] = categories.slice(0, 6).map((cat) => ({
      id: `b-${cat.id}`,
      user_id: "u1",
      category_id: cat.id,
      month: "2026-08",
      limit: 500,
    }));

    const res = computeOverviewBudgetAndDonutData({
      budgets,
      expenses,
      expenseCategories: categories,
      month: "2026-08",
      grossExpenseCents: 280000,
    });

    expect(res.donutSliceDescriptors).toHaveLength(6);
    const othersSlice = res.donutSliceDescriptors[5];
    expect(othersSlice?.label).toBe("Demais (2)");
    expect(othersSlice?.color).toBe(OVERVIEW_OTHERS_COLOR);
    expect(res.budgetSegments).toHaveLength(5);
    expect(res.budgetSegments[4]?.color).toBe(OVERVIEW_OTHERS_COLOR);
  });

  it("buildOverviewCashGapResult e buildOverviewWeeklyRadarSummary consolidam obrigações", () => {
    const cashGap = buildOverviewCashGapResult({
      currentBalanceCents: 5000,
      today: "2026-08-15",
      month: "2026-08",
      rangeEnd: "2026-09-01",
      cards: [{ id: "card1", user_id: "u1", name: "Nu", brand: null, credit_limit: 1000, closing_day: 10, due_day: 25, color: null, is_active: true }],
      cardExpenses: [{ ...makeExpense("ce1", 200, "c1"), card_id: "card1", bill_competence: "2026-08", payment_method: "credit_card" }],
      cardPayments: [],
      debts: [],
      incomes: [],
    });
    expect(cashGap.isCashGapDetected).toBe(true);
    expect(cashGap.maxDeficitCents).toBe(15000);

    const radarLoading = buildOverviewWeeklyRadarSummary({
      isLoading: true,
      today: "2026-08-15",
      month: "2026-08",
      currentBalanceCents: 5000,
    });
    expect(radarLoading.hasObligations).toBe(false);
  });

  it("computeLiveGoalProgressMap e filterEligibleGoalShares avaliam progresso real da meta", () => {
    const goalShare: PublicShare = {
      id: "g1",
      user_id: "u1",
      kind: "goal_tracker",
      token: "gt1",
      expires_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      is_revoked: false,
      payload: {
        title: "Reserva",
        target_cents: 100000,
        current_cents: 85000,
        status: "in_progress",
      },
    };

    const progressMap = computeLiveGoalProgressMap({
      currentBalanceCents: 50000,
      positionRows: [],
      goalShares: [goalShare],
    });
    expect(progressMap.get("g1")?.percentage).toBe(85);

    const eligible = filterEligibleGoalShares({
      goalShares: [goalShare],
      liveGoalProgress: progressMap,
      hasSurplus: false,
    });
    expect(eligible).toHaveLength(1);
  });

  describe("Fase 3 — Blindagem via UserFinancialContext & CashGap Preditivo", () => {
    it("suprime PaceAlert em Cold Start (dia 23, 1 despesa R$ 50, renda 0) e remove Math.max(1, ...)", () => {
      const ctx = buildUserFinancialContext({
        month: "2026-08",
        todayISO: "2026-08-23",
        monthIncomes: [],
        monthExpenses: [makeExpense("e1", 50, "c-food", "2026-08-23")],
        categories: [makeCategory("c-food", "Alimentação")],
      });

      const metrics = computeCurrentMonthProjectionMetrics({
        isCurrentMonth: true,
        grossIncomeCents: 0,
        grossExpenseCents: 5000,
        investmentCents: 0,
        dayOfMonth: 23,
        daysInMonth: 31,
        financialContext: ctx,
      });

      expect(metrics.pace.active).toBe(false);
      expect(metrics.pace.spentPercent).toBe(0);
      expect(metrics.daily.dailyCents).toBeNull();
      expect(metrics.projection.projectedExpensesCents).toBeNull();
      expect(metrics.showPaceAlert).toBe(false);

      // Mesmo em modo fallback (sem financialContext), não divide por 1 centavo
      const fallbackMetrics = computeCurrentMonthProjectionMetrics({
        isCurrentMonth: true,
        grossIncomeCents: 0,
        grossExpenseCents: 5000,
        investmentCents: 0,
        dayOfMonth: 23,
        daysInMonth: 31,
      });
      expect(fallbackMetrics.pace.spentPercent).toBe(0);
      expect(fallbackMetrics.daily.dailyCents).toBeNull();
      expect(fallbackMetrics.showPaceAlert).toBe(false);
    });

    it("não dispara falso alerta de ritmo quando apenas custo fixo estrutural (Aluguel) pesa no início/meio do mês", () => {
      const ctx = buildUserFinancialContext({
        month: "2026-08",
        todayISO: "2026-08-15",
        monthIncomes: [makeIncome("i1", 5000, "2026-08-05")],
        monthExpenses: [
          makeExpense("e1", 3000, "c-moradia", "2026-08-10"),
          makeExpense("e2", 100, "c-lazer", "2026-08-12"),
          makeExpense("e3", 120, "c-lazer", "2026-08-14"),
        ],
        categories: [
          { ...makeCategory("c-moradia", "Moradia"), icon: "moradia" },
          makeCategory("c-lazer", "Lazer"),
        ],
        historicalExpensesByMonth: [
          [makeExpense("h1", 2000, "c-moradia", "2026-07-10"), makeExpense("h2", 800, "c-lazer", "2026-07-12")],
        ],
      });

      const metrics = computeCurrentMonthProjectionMetrics({
        isCurrentMonth: true,
        grossIncomeCents: 500000,
        grossExpenseCents: 322000,
        investmentCents: 0,
        dayOfMonth: 15,
        daysInMonth: 31,
        financialContext: ctx,
      });

      expect(metrics.projection.onTrack).toBe(true);
      expect(metrics.showPaceAlert).toBe(false);
    });

    it("buildOverviewCashGapResult retorna sem déficit quando hasLiquidityContext = false (Cold Start)", () => {
      const res = buildOverviewCashGapResult({
        currentBalanceCents: 0,
        today: "2026-08-23",
        month: "2026-08",
        rangeEnd: "2026-09-01",
        cards: [{ id: "card1", user_id: "u1", name: "Nu", brand: null, credit_limit: 1000, closing_day: 10, due_day: 25, color: null, is_active: true }],
        cardExpenses: [{ ...makeExpense("ce1", 50, "c1"), card_id: "card1", bill_competence: "2026-08", payment_method: "credit_card" }],
        cardPayments: [],
        debts: [],
        incomes: [],
        hasLiquidityContext: false,
      });

      expect(res.isCashGapDetected).toBe(false);
      expect(res.severity).toBe("none");
      expect(res.maxDeficitCents).toBe(0);
    });

    it("inclui salário recorrente previsto no dia 5 para evitar falso déficit em fatura que vence no dia 10", () => {
      const ctx = buildUserFinancialContext({
        month: "2026-09",
        todayISO: "2026-09-02",
        monthIncomes: [],
        monthExpenses: [],
        historicalIncomes: [
          makeIncome("h-jul", 5000, "2026-07-05"),
          makeIncome("h-aug", 5000, "2026-08-05"),
        ],
      });

      const predictedInflows = buildPredictedUpcomingCashInflows({
        month: "2026-09",
        today: "2026-09-02",
        isCurrentMonth: true,
        monthIncomes: [],
        paydayProfile: ctx.learning.paydayProfile,
        expectedUpcomingInflowsCents: ctx.lens.liquidity.expectedUpcomingInflowsCents,
      });

      expect(predictedInflows).toHaveLength(1);
      expect(predictedInflows[0]?.expectedDate).toBe("2026-09-05");
      expect(predictedInflows[0]?.amountCents).toBe(500000);

      // Fatura R$ 2.500 vence dia 10; saldo hoje R$ 1.000; salário R$ 5.000 cai dia 5 -> sem déficit!
      const noGapRes = buildOverviewCashGapResult({
        currentBalanceCents: 100000,
        today: "2026-09-02",
        month: "2026-09",
        rangeEnd: "2026-10-01",
        cards: [{ id: "card1", user_id: "u1", name: "Nu", brand: null, credit_limit: 5000, closing_day: 25, due_day: 10, color: null, is_active: true }],
        cardExpenses: [{ ...makeExpense("ce1", 2500, "c1", "2026-08-20"), card_id: "card1", bill_competence: "2026-09", payment_method: "credit_card" }],
        cardPayments: [],
        debts: [],
        incomes: [],
        hasLiquidityContext: true,
        predictedInflows,
      });
      expect(noGapRes.isCashGapDetected).toBe(false);

      // Fatura R$ 2.500 vence dia 4 (antes do dia 5) -> gap real detectado informando entrada do dia 5!
      const realGapRes = buildOverviewCashGapResult({
        currentBalanceCents: 100000,
        today: "2026-09-02",
        month: "2026-09",
        rangeEnd: "2026-10-01",
        cards: [{ id: "card1", user_id: "u1", name: "Nu", brand: null, credit_limit: 5000, closing_day: 25, due_day: 4, color: null, is_active: true }],
        cardExpenses: [{ ...makeExpense("ce1", 2500, "c1", "2026-08-20"), card_id: "card1", bill_competence: "2026-09", payment_method: "credit_card" }],
        cardPayments: [],
        debts: [],
        incomes: [],
        hasLiquidityContext: true,
        predictedInflows,
      });
      expect(realGapRes.isCashGapDetected).toBe(true);
      expect(realGapRes.maxDeficitCents).toBe(150000);
      expect(realGapRes.nextInflowDate).toBe("2026-09-05");
    });
  });
});
