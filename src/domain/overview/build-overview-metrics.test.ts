import { describe, expect, it } from "vitest";
import type { Budget, Category, Debt, Expense, Income, PublicShare } from "@/types";
import {
  OVERVIEW_OTHERS_COLOR,
  buildOverviewCashGapResult,
  buildOverviewWeeklyRadarSummary,
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
});
