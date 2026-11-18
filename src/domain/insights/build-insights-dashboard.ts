import {
  budgetLimitsByCategory,
  budgetStatus,
  resolveEffectiveLimit,
  spentByCategoryMap,
} from "@/domain/budgets";
import { numberToCents, sumGrossCents } from "@/domain/money";
import { computeOverview } from "@/domain/overview";
import {
  dailyBudget,
  endOfMonthProjection,
  pendingProjection,
  spendingPace,
  type EmergencyFundComposition,
} from "@/domain/projection";
import type { Budget, Category, CreditCard, Debt, Expense, FamilyConsolidationResult, Income } from "@/types";
import { criticalAlerts } from "./alerts";
import { buildInsightsAnalytics, type InsightsAnalyticsResult } from "./build-insights-analytics";
import {
  buildInsightsWarnings,
  type InsightsWarningItem,
  type PortfolioWarningRow,
} from "./build-insights-warnings";
import type { FeedbackMap } from "./feedback";

export interface BuildInsightsDashboardInput {
  month: string;
  currentCalendarMonth: string;
  now: Date;
  expensesByMonth: readonly (readonly Expense[])[];
  incomes: readonly Income[];
  budgets: readonly Budget[];
  categories: readonly Category[];
  cards: readonly CreditCard[];
  debts: readonly Debt[];
  feedbackMap: FeedbackMap;
  portfolioRows: readonly PortfolioWarningRow[];
  monthlyContributionCents: number;
  committedObligationsCents: number;
  openInvoicesCents: number;
  emergencyComposition: EmergencyFundComposition;
  householdData?: FamilyConsolidationResult | null;
  currentUserId?: string;
}

export interface InsightsDashboardModel extends InsightsAnalyticsResult {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  savingsRate: number;
  effectiveSavingsRateForHealth: number;
  overspentBudgets: number;
  hasTransactions: boolean;
  warnings: InsightsWarningItem[];
  dailyCents: number | null;
  projectedExpensesCents: number | null;
  surplusCents: number | null;
  onTrack: boolean | null;
  spentPercent: number;
  elapsedPercent: number;
  paceActive: boolean;
  pendingSummary: { receivablesCents: number; payablesCents: number; balanceCents: number };
  baselineMonthlyExpensesCents: number;
  detectedReserveCents: number;
}

function toLocalIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildInsightsDashboard(input: BuildInsightsDashboardInput): InsightsDashboardModel {
  const { month, currentCalendarMonth, now, expensesByMonth, incomes, budgets, categories, cards, debts } = input;
  const [month0 = [], month1 = [], month2 = [], month3 = []] = expensesByMonth;

  const { incomeCents, expenseCents, balanceCents, savingsRatePercent } = computeOverview(
    sumGrossCents(incomes),
    sumGrossCents(month0),
    input.monthlyContributionCents,
  );
  const pastMonthly = [month1, month2, month3].map((list) => sumGrossCents(list)).filter((v) => v > 0);
  const averagePastExpensesCents =
    pastMonthly.length > 0 ? Math.round(pastMonthly.reduce((a, b) => a + b, 0) / pastMonthly.length) : 0;

  const savingsRate = savingsRatePercent ?? 0;
  const burnRate = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const todayISOStr = toLocalIso(now);
  const effectiveMonthlyBudgetCents =
    incomeCents > 0 ? Math.max(incomeCents, averagePastExpensesCents) : Math.max(1, averagePastExpensesCents);
  const pace = spendingPace({
    spentCents: expenseCents,
    monthlyBudgetCents: effectiveMonthlyBudgetCents,
    dayOfMonth,
    daysInMonth,
  });
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;

  const limitsByCategory = budgetLimitsByCategory(budgets);
  const spentByCategory = spentByCategoryMap(month0);
  const overspentBudgets = categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month),
      spentCents: spentByCategory.get(c.id) ?? 0,
    }))
    .filter((row) => row.limitCents > 0 && budgetStatus(row.spentCents, row.limitCents) === "exceeded").length;

  const projection = endOfMonthProjection({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents: input.monthlyContributionCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });
  const projectedDeficit = dayOfMonth >= 10 && projection.onTrack === false;
  const isCurrentMonth = month === currentCalendarMonth;
  const committedObligationsCents = isCurrentMonth ? input.committedObligationsCents : 0;
  const cycleBalanceCents = balanceCents - committedObligationsCents;
  const cycleSavingsRate = incomeCents > 0 ? (cycleBalanceCents / incomeCents) * 100 : 0;
  const effectiveSavingsRateForHealth = isCurrentMonth ? cycleSavingsRate : savingsRate;

  const alerts = criticalAlerts({
    balanceCents,
    incomeCents,
    expenseCents,
    paceRatio,
    overspentBudgets,
    burnRatePercent: burnRate,
    projectedDeficit,
    savingsRatePercent: savingsRate,
    dayOfMonth: isCurrentMonth ? dayOfMonth : undefined,
    daysInMonth: isCurrentMonth ? daysInMonth : undefined,
    committedObligationsCents,
    cycleSavingsRatePercent: cycleSavingsRate,
  });

  const analytics = buildInsightsAnalytics({
    month,
    isCurrentMonth,
    dayOfMonth,
    daysInMonth,
    todayISOStr,
    now,
    expensesByMonth,
    incomes,
    categories,
    cards,
    feedbackMap: input.feedbackMap,
    incomeCents,
    expenseCents,
    effectiveSavingsRateForHealth,
  });

  const daily = dailyBudget({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents: input.monthlyContributionCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });

  const rangeStart = `${month}-01`;
  const pending = debts
    .filter((d) => d.paid_at === null && d.due_date >= rangeStart)
    .map((d) => ({
      id: d.id,
      kind: d.type === "receivable" ? ("receivable" as const) : ("payable" as const),
      remainingCents: numberToCents(d.amount),
    }));

  const settlement = input.householdData?.settlement;
  if (input.householdData && !input.householdData.is_settled && settlement && settlement.amount_cents > 0) {
    const isPayer = input.currentUserId ? settlement.payer_id === input.currentUserId : false;
    const isReceiver = input.currentUserId ? settlement.receiver_id === input.currentUserId : false;
    if (isPayer) pending.push({ id: "family-settlement-payable", kind: "payable", remainingCents: settlement.amount_cents });
    else if (isReceiver) pending.push({ id: "family-settlement-receivable", kind: "receivable", remainingCents: settlement.amount_cents });
  }
  if (isCurrentMonth && input.openInvoicesCents > 0) {
    pending.push({ id: "card-invoices-cycle-pending", kind: "payable", remainingCents: input.openInvoicesCents });
  }

  const warnings = buildInsightsWarnings({
    alerts,
    portfolioRows: input.portfolioRows,
    todayISO: todayISOStr,
    emergencyWarnings: input.emergencyComposition.warnings,
    householdData: input.householdData,
    daysInMonth,
    dayOfMonth,
  });

  const baselineMonthlyExpensesCents =
    averagePastExpensesCents > 0 ? averagePastExpensesCents : (projection.projectedExpensesCents ?? expenseCents);
  const detectedReserveCents =
    input.emergencyComposition.totalReserveCents > 0
      ? input.emergencyComposition.totalReserveCents
      : Math.max(0, balanceCents);

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    savingsRate,
    effectiveSavingsRateForHealth,
    overspentBudgets,
    hasTransactions: month0.length > 0 || incomes.length > 0,
    warnings,
    dailyCents: daily.dailyCents,
    projectedExpensesCents: projection.projectedExpensesCents,
    surplusCents: projection.surplusCents,
    onTrack: projection.onTrack,
    spentPercent: pace.spentPercent,
    elapsedPercent: pace.elapsedPercent,
    paceActive: pace.active,
    pendingSummary: pendingProjection(pending),
    baselineMonthlyExpensesCents,
    detectedReserveCents,
    ...analytics,
  };
}
