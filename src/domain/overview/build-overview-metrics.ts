import {
  budgetLimitsByCategory,
  isInheritedLimit,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
} from "@/domain/budgets";
import { buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import { isParticipantFullySettled, isSplitFullyCompleted } from "@/domain/finance/split-math";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import { numberToCents, sumGrossCents, sumWeightedCents } from "@/domain/money";
import { contributionsInMonthCents } from "@/domain/portfolio";
import {
  analyzeCashGap,
  computeWeeklyDueRadar,
  dailyBudget,
  endOfMonthProjection,
  projectCardInvoiceObligations,
  spendingPace,
  type CashGapAnalysisResult,
  type WeeklyRadarSummary,
} from "@/domain/projection";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Debt,
  Expense,
  GoalAlertDismissalCheckpoint,
  GoalCompositionConfig,
  Income,
  PortfolioContribution,
  PublicShare,
  SplitSharePayload,
} from "@/types";
import { shouldShowGoalAlert } from "./alert-dismissals";
import {
  buildDailyCumulativeSeries,
  buildDailyFlow,
  computeOverview,
  type DailyFlowItem,
  type DailySeriesAccumulator,
  type OverviewTotals,
} from "./index";

export interface OverviewPortfolioPositionLike {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  quantity: number;
  valueBRL: number;
  totalCostBRL: number;
}

export interface MonthlyCashflowMetricsResult {
  incomeCents: number;
  expenseCents: number;
  grossIncomeCents: number;
  grossExpenseCents: number;
  prevGrossIncomeCents: number;
  prevGrossExpenseCents: number;
  investmentCents: number;
  prevInvestmentCents: number;
  totals: OverviewTotals;
  prevTotals: OverviewTotals;
  dailyFlow: DailyFlowItem[];
  dailySeries: DailySeriesAccumulator;
}

export function computeMonthlyCashflowMetrics(params: {
  month: string;
  prevMonth: string;
  incomes: readonly Income[];
  expenses: readonly Expense[];
  prevIncomes: readonly Income[];
  prevExpenses: readonly Expense[];
  contributions: readonly PortfolioContribution[];
}): MonthlyCashflowMetricsResult {
  const { month, prevMonth, incomes, expenses, prevIncomes, prevExpenses, contributions } = params;

  const incomeCents = sumWeightedCents(incomes);
  const expenseCents = sumWeightedCents(expenses);
  const grossIncomeCents = sumGrossCents(incomes);
  const grossExpenseCents = sumGrossCents(expenses);
  const prevGrossIncomeCents = sumGrossCents(prevIncomes);
  const prevGrossExpenseCents = sumGrossCents(prevExpenses);

  const investmentCents = contributionsInMonthCents(contributions, month);
  const prevInvestmentCents = contributionsInMonthCents(contributions, prevMonth);

  const totals = computeOverview(grossIncomeCents, grossExpenseCents, investmentCents);
  const prevTotals = computeOverview(prevGrossIncomeCents, prevGrossExpenseCents, prevInvestmentCents);

  const dailyItems = [
    ...incomes.map((i) => ({ date: i.date, kind: "income" as const, amountCents: numberToCents(i.value) })),
    ...expenses.map((e) => ({ date: e.date, kind: "expense" as const, amountCents: numberToCents(e.value) })),
    ...contributions
      .filter((c) => c.date.startsWith(month))
      .map((c) => ({ date: c.date, kind: "investment" as const, amountCents: numberToCents(c.amount) })),
  ];
  const dailyFlow = buildDailyFlow(month, dailyItems);
  const dailySeries = buildDailyCumulativeSeries(dailyFlow);

  return {
    incomeCents,
    expenseCents,
    grossIncomeCents,
    grossExpenseCents,
    prevGrossIncomeCents,
    prevGrossExpenseCents,
    investmentCents,
    prevInvestmentCents,
    totals,
    prevTotals,
    dailyFlow,
    dailySeries,
  };
}

export function computeCurrentMonthProjectionMetrics(params: {
  isCurrentMonth: boolean;
  grossIncomeCents: number;
  grossExpenseCents: number;
  investmentCents: number;
  dayOfMonth: number;
  daysInMonth: number;
}) {
  const { isCurrentMonth, grossIncomeCents, grossExpenseCents, investmentCents, dayOfMonth, daysInMonth } = params;

  const pace = isCurrentMonth
    ? spendingPace({
        spentCents: grossExpenseCents,
        monthlyBudgetCents: Math.max(1, grossIncomeCents),
        dayOfMonth,
        daysInMonth,
      })
    : { active: false, spentPercent: 0, elapsedPercent: 0, gapPoints: 0, ahead: false };

  const daily = isCurrentMonth
    ? dailyBudget({
        phase: "current",
        incomesCents: grossIncomeCents,
        investmentsCents: investmentCents,
        expensesCents: grossExpenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { dailyCents: null, monthlyNetCents: 0, daysRemaining: null };

  const projection = isCurrentMonth
    ? endOfMonthProjection({
        phase: "current",
        incomesCents: grossIncomeCents,
        investmentsCents: investmentCents,
        expensesCents: grossExpenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { projectedExpensesCents: null, surplusCents: null, onTrack: null, burnRateCents: null };

  const showPaceAlert =
    isCurrentMonth &&
    pace.active &&
    (pace.ahead || projection.onTrack === false || (projection.surplusCents !== null && projection.surplusCents < 0));

  return { pace, daily, projection, showPaceAlert };
}

export function buildOverviewCashGapResult(params: {
  currentBalanceCents: number;
  today: string;
  month: string;
  rangeEnd: string;
  cards: readonly CreditCard[];
  cardExpenses: readonly Expense[];
  cardPayments: readonly CardPayment[];
  debts: readonly Debt[];
  incomes: readonly Income[];
}): CashGapAnalysisResult {
  const { currentBalanceCents, today, month, rangeEnd, cards, cardExpenses, cardPayments, debts, incomes } = params;

  return analyzeCashGap({
    currentBalanceCents,
    today,
    obligations: [
      ...projectCardInvoiceObligations({
        cards: [...cards],
        expenses: [...cardExpenses],
        payments: [...cardPayments],
        today,
        currentMonth: month,
      }),
      ...debts
        .filter((d) => d.type === "payable" && !d.paid_at && d.due_date && d.due_date < rangeEnd)
        .map((d) => ({
          id: `debt-${d.id}`,
          name: d.name,
          dueDate: d.due_date < today ? today : d.due_date,
          amountCents: numberToCents(d.amount),
          kind: "debt" as const,
        })),
    ],
    inflows: [
      ...debts
        .filter((d) => d.type === "receivable" && !d.paid_at && d.due_date && d.due_date >= today)
        .map((d) => ({
          id: `recv-${d.id}`,
          name: d.name,
          expectedDate: d.due_date,
          amountCents: numberToCents(d.amount),
        })),
      ...incomes
        .filter((i) => i.date >= today)
        .map((i) => ({
          id: `income-${i.id}`,
          name: "Renda prevista",
          expectedDate: i.date,
          amountCents: Math.round(i.value * 100),
        })),
    ],
  });
}

export function buildOverviewWeeklyRadarSummary(params: {
  isLoading: boolean;
  today: string;
  month: string;
  currentBalanceCents: number;
  cards?: readonly CreditCard[];
  cardExpenses?: readonly Expense[];
  cardPayments?: readonly CardPayment[];
  debts?: readonly Debt[];
}): WeeklyRadarSummary {
  const { isLoading, today, month, currentBalanceCents, cards, cardExpenses, cardPayments, debts } = params;

  if (isLoading || !cards || !cardExpenses || !cardPayments || !debts) {
    return {
      items: [],
      totalDueCents: 0,
      realCashCents: currentBalanceCents,
      freeBalanceCents: currentBalanceCents,
      isDeficitRisk: false,
      hasObligations: false,
    };
  }

  const invoices = cards
    .filter((card) => card.is_active)
    .flatMap((card) => {
      const expenses = cardExpenses.filter((e) => e.card_id === card.id);
      const payments = cardPayments.filter((p) => p.card_id === card.id);
      return buildCompetenceSummaries(expenses, payments)
        .filter((summary) => summary.saldoCents > 0)
        .map((summary) => ({
          id: `bill:${card.id}:${summary.month}`,
          name: summary.month === month ? `Fatura ${card.name}` : `Fatura ${card.name} (${summary.month})`,
          dueDate: invoiceDueDate(summary.month, card.due_day),
          amountCents: summary.saldoCents,
          cardId: card.id,
          competenceMonth: summary.month,
        }));
    });

  return computeWeeklyDueRadar({
    today,
    realCashCents: currentBalanceCents,
    debts: [...debts],
    invoices,
  });
}

export interface PendingSplitItemSummary {
  id: string;
  title: string;
  pendingCents: number;
  pendingFriendsCount: number;
  totalFriendsCount: number;
}

export interface PendingSplitReceivablesSummary {
  count: number;
  pendingCents: number;
  totalExpensesCents: number;
  items: PendingSplitItemSummary[];
}

export function computePendingSplitReceivables(params: {
  isLoading: boolean;
  debts?: readonly Debt[];
  splitShares?: readonly PublicShare[];
}): PendingSplitReceivablesSummary {
  const { isLoading, debts, splitShares } = params;

  // Aguarda ambas as fontes para evitar flash temporário de rachas já quitados/arquivados
  if (isLoading || !debts || !splitShares) {
    return { count: 0, pendingCents: 0, totalExpensesCents: 0, items: [] };
  }

  if (splitShares.length === 0 && debts.length === 0) {
    return { count: 0, pendingCents: 0, totalExpensesCents: 0, items: [] };
  }

  let count = 0;
  let pendingCents = 0;
  let totalExpensesCents = 0;
  const items: PendingSplitItemSummary[] = [];

  const debtMap = new Map(debts.map((d) => [d.id, d]));
  const expenseDebtMap = new Map(
    debts.filter((d) => d.type === "receivable" && d.expense_id).map((d) => [d.expense_id!, d]),
  );
  const mappedDebtIds = new Set<string>();
  const mappedExpenseIds = new Set<string>();
  const mappedInstallmentGroupIds = new Set<string>();

  for (const share of splitShares) {
    const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
    const debtId = payload?.debt_id;
    const expenseId = payload?.expense_id;
    if (debtId) mappedDebtIds.add(debtId);
    if (expenseId) mappedExpenseIds.add(expenseId);

    const debt = (debtId ? debtMap.get(debtId) : null) || (expenseId ? expenseDebtMap.get(expenseId) : null);
    if (debt) {
      mappedDebtIds.add(debt.id);
      if (debt.installment_group_id) {
        mappedInstallmentGroupIds.add(debt.installment_group_id);
      }
    }

    const participants = payload.participants ?? [];
    const participantInstallments = payload.participant_installments ?? [];
    const hasStructuredData = participants.length > 0 || participantInstallments.length > 0;
    const isCompleted = hasStructuredData
      ? isSplitFullyCompleted(participants, participantInstallments)
      : Boolean(payload?.is_completed);
    const isArchived = (payload as Record<string, unknown>)?.status === "archived";
    const isSettled = isCompleted || (debt ? Boolean(debt.paid_at) : false);

    if (share.is_revoked || isArchived || isSettled) continue;

    const friends = participants.filter((p) => !p.is_host);
    const hostIds = new Set(participants.filter((p) => p.is_host && p.id).map((p) => p.id!));
    const guestCount = Math.max(1, Number(payload.people_count ?? 2) - 1);
    const guestShareCents = Number(payload.guest_share_cents ?? 0);

    const totalFriendsCount = friends.length > 0 ? friends.length : guestCount;
    const pendingFriendsCount =
      friends.length > 0
        ? friends.filter((f) => {
            const friendInsts = participantInstallments.filter(
              (inst) =>
                inst.participant_id === f.id ||
                (friends.length === 1 && !hostIds.has(inst.participant_id)),
            );
            return !isParticipantFullySettled(f, friendInsts);
          }).length
        : guestCount;

    const friendInstallments = participantInstallments.filter(
      (inst) => !hostIds.has(inst.participant_id),
    );
    const pendingForThisSplit =
      friendInstallments.length > 0
        ? friendInstallments
            .filter((inst) => !inst.is_settled)
            .reduce((acc, inst) => acc + Number(inst.amount_cents ?? 0), 0)
        : friends.length > 0
          ? friends.reduce(
              (acc, f) =>
                acc +
                (f.is_settled
                  ? 0
                  : Math.max(0, Number(f.share_cents) - Number(f.settled_cents ?? 0))),
              0,
            )
          : guestShareCents * guestCount;

    if (pendingForThisSplit > 0) {
      count += 1;
      pendingCents += pendingForThisSplit;
      totalExpensesCents += Number(payload.total_cents ?? guestShareCents * Number(payload.people_count ?? 2));
      items.push({
        id: share.id,
        title: payload.title?.trim() || "Despesa",
        pendingCents: pendingForThisSplit,
        pendingFriendsCount,
        totalFriendsCount,
      });
    }
  }

  // Computa dívidas de racha a receber pendentes que ainda não possuem public_share
  for (const debt of debts) {
    if (debt.type !== "receivable" || debt.paid_at) continue;
    if (mappedDebtIds.has(debt.id)) continue;
    if (debt.expense_id && mappedExpenseIds.has(debt.expense_id)) continue;
    if (debt.installment_group_id && mappedInstallmentGroupIds.has(debt.installment_group_id)) continue;
    if (!debt.name.toLowerCase().startsWith("racha:") && !debt.name.toLowerCase().includes("racha")) continue;

    const debtCents = Math.round(debt.amount * 100);
    if (debtCents > 0) {
      count += 1;
      pendingCents += debtCents;
      totalExpensesCents += debtCents;
      items.push({
        id: `debt_${debt.id}`,
        title: debt.name.replace(/^racha:\s*/i, "").trim() || "Despesa",
        pendingCents: debtCents,
        pendingFriendsCount: 1,
        totalFriendsCount: 1,
      });
    }
  }

  return { count, pendingCents, totalExpensesCents, items };
}

export function computeLiveGoalProgressMap(params: {
  currentBalanceCents: number;
  positionRows: readonly OverviewPortfolioPositionLike[];
  goalShares: readonly PublicShare[];
}): Map<string, { currentCents: number; percentage: number; isCompleted: boolean }> {
  const { currentBalanceCents, positionRows, goalShares } = params;
  const currentBalance = Math.max(0, currentBalanceCents);
  const accounts: AccountCompositionItem[] = [
    {
      id: "main_cash",
      name: "Saldo em Conta Corrente / Caixa Geral",
      balanceCents: currentBalance,
      pendingObligationsCents: 0,
    },
  ];

  const assets: PortfolioAssetCompositionItem[] = positionRows
    .filter((r) => r.quantity > 0 || r.valueBRL > 0)
    .map((r) => ({
      id: r.assetId,
      ticker: r.ticker,
      assetClass: r.assetClass ?? "other",
      quantity: r.quantity > 0 ? r.quantity : 1,
      valueCents: Math.round(r.valueBRL * 100),
      totalCostCents: Math.round(r.totalCostBRL * 100),
    }));

  const map = new Map<string, { currentCents: number; percentage: number; isCompleted: boolean }>();

  for (const share of goalShares) {
    const payload = (share.payload as Record<string, unknown> | null) ?? {};
    const config = payload.composition_config as GoalCompositionConfig | undefined;
    const targetCents = Number(payload.target_cents ?? 0);
    const isCompletedInDb = payload.status === "completed";

    if (config) {
      const resolved = resolveGoalComposition({
        config,
        targetCents,
        accounts,
        assets,
        previouslyLockedAsCompleted: isCompletedInDb && targetCents > 0 ? false : isCompletedInDb,
      });

      const isActuallyCompleted = targetCents > 0 ? resolved.currentCents >= targetCents : isCompletedInDb;

      map.set(share.id, {
        currentCents: resolved.currentCents,
        percentage: Math.round(resolved.progressPercent),
        isCompleted: isActuallyCompleted,
      });
    } else {
      const currentCents = Number(payload.current_cents ?? 0);
      const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
      const isActuallyCompleted = targetCents > 0 ? currentCents >= targetCents : isCompletedInDb;

      map.set(share.id, {
        currentCents,
        percentage,
        isCompleted: isActuallyCompleted,
      });
    }
  }

  return map;
}

export function filterEligibleGoalShares(params: {
  goalShares: readonly PublicShare[];
  liveGoalProgress: ReadonlyMap<string, { currentCents: number; percentage: number; isCompleted: boolean }>;
  hasSurplus: boolean;
  goalDismissals?: Record<string, GoalAlertDismissalCheckpoint>;
}): PublicShare[] {
  const { goalShares, liveGoalProgress, hasSurplus, goalDismissals } = params;
  const activeList = goalShares.filter(
    (s) => (s.payload as Record<string, unknown> | null)?.status !== "archived",
  );
  if (activeList.length === 0) return [];

  return activeList.filter((s) => {
    const pld = (s.payload as Record<string, unknown> | null) ?? {};
    const targetCents = Number(pld.target_cents ?? 0);
    const live = liveGoalProgress.get(s.id)?.currentCents;
    const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
    const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
    const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
    const isFinalStretch = percentage >= 80 && !isCompleted;
    const stage: "completed" | "final_stretch" | "has_surplus" | "regular" = isCompleted
      ? "completed"
      : isFinalStretch
        ? "final_stretch"
        : hasSurplus
          ? "has_surplus"
          : "regular";

    return shouldShowGoalAlert(goalDismissals?.[s.id], {
      goalId: s.id,
      currentCents,
      targetCents,
      percentage,
      stage,
    });
  });
}

export interface OverviewBudgetRow {
  category: Category;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
  inherited: boolean;
}

export interface OverviewCategorySliceDescriptor {
  key: string;
  label: string;
  valueCents: number;
  icon: string | null;
  color: string | null;
  isOthers: boolean;
}

export interface OverviewOtherCategoryRow {
  category: Category;
  spentGrossCents: number;
  percent: number;
}

export const OVERVIEW_OTHERS_COLOR = "hsl(var(--muted-foreground))";

export function computeOverviewBudgetAndDonutData(params: {
  budgets: readonly Budget[];
  expenses: readonly Expense[];
  expenseCategories: readonly Category[];
  month: string;
  grossExpenseCents: number;
}) {
  const { budgets, expenses, expenseCategories, month, grossExpenseCents } = params;
  const limitsByCategory = budgetLimitsByCategory([...budgets]);
  const spentWeightedByCategory = spentByCategoryMap([...expenses]);
  const spentGrossByCategory = spentGrossByCategoryMap([...expenses]);

  const budgetRows: OverviewBudgetRow[] = expenseCategories
    .map((category) => {
      const spentWeightedCents = spentWeightedByCategory.get(category.id) ?? 0;
      const limitCents = resolveEffectiveLimit(limitsByCategory.get(category.id) ?? [], month);
      return {
        category,
        limitCents,
        spentCents: spentWeightedCents,
        remainingCents: limitCents - spentWeightedCents,
        percent: limitCents > 0 ? (spentWeightedCents / limitCents) * 100 : 0,
        inherited: isInheritedLimit(limitsByCategory.get(category.id) ?? [], month),
      };
    })
    .filter((row) => row.limitCents > 0);

  const totalLimitsCents = budgetRows.reduce((acc, row) => acc + row.limitCents, 0);
  const totalBudgetedSpent = budgetRows.reduce((acc, row) => acc + row.spentCents, 0);
  const totalRemainingCents = totalLimitsCents - totalBudgetedSpent;
  const globalPercent = totalLimitsCents > 0 ? (totalBudgetedSpent / totalLimitsCents) * 100 : 0;

  const segmentBaseCents = Math.max(1, totalLimitsCents, totalBudgetedSpent);
  const activeBudgetSpentRows = [...budgetRows]
    .filter((r) => r.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);
  const topBudgetSegments = activeBudgetSpentRows.slice(0, 4);
  const otherBudgetRows = activeBudgetSpentRows.slice(4);
  const otherBudgetSpentCents = otherBudgetRows.reduce((acc, r) => acc + r.spentCents, 0);

  const budgetSegments = [
    ...topBudgetSegments.map((row) => ({
      id: row.category.id,
      label: row.category.name,
      color: row.category.color ?? undefined,
      spentCents: row.spentCents,
      percent: (row.spentCents / segmentBaseCents) * 100,
    })),
    ...(otherBudgetSpentCents > 0
      ? [
          {
            id: "others",
            label: "Outros",
            color: OVERVIEW_OTHERS_COLOR,
            spentCents: otherBudgetSpentCents,
            percent: (otherBudgetSpentCents / segmentBaseCents) * 100,
          },
        ]
      : []),
  ];

  const activeCategoryRows: OverviewOtherCategoryRow[] = expenseCategories
    .map((category) => {
      const spentGross = spentGrossByCategory.get(category.id) ?? 0;
      return {
        category,
        spentGrossCents: spentGross,
        percent: grossExpenseCents > 0 ? (spentGross / grossExpenseCents) * 100 : 0,
      };
    })
    .filter((row) => row.spentGrossCents > 0)
    .sort((a, b) => b.spentGrossCents - a.spentGrossCents);

  const top5 = activeCategoryRows.slice(0, 5);
  const otherCategoriesRows = activeCategoryRows.slice(5);
  const top5SpentCents = top5.reduce((acc, r) => acc + r.spentGrossCents, 0);
  const othersSpentCents = Math.max(0, grossExpenseCents - top5SpentCents);

  const donutSliceDescriptors: OverviewCategorySliceDescriptor[] = top5.map((row) => ({
    key: row.category.id,
    label: row.category.name,
    valueCents: row.spentGrossCents,
    icon: row.category.icon,
    color: row.category.color,
    isOthers: false,
  }));

  if (otherCategoriesRows.length > 0 || othersSpentCents > 0) {
    donutSliceDescriptors.push({
      key: "__other_categories__",
      label: otherCategoriesRows.length > 0 ? `Demais (${otherCategoriesRows.length})` : "Demais",
      valueCents: othersSpentCents,
      icon: "layers",
      color: OVERVIEW_OTHERS_COLOR,
      isOthers: true,
    });
  }

  return {
    limitsByCategory,
    spentWeightedByCategory,
    spentGrossByCategory,
    budgetRows,
    otherBudgetRows,
    totalLimitsCents,
    totalRemainingCents,
    globalPercent,
    budgetSegments,
    donutSliceDescriptors,
    otherCategoriesRows,
    totalActiveCategoriesCount: activeCategoryRows.length,
  };
}
