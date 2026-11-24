import {
  budgetLimitsByCategory,
  budgetStatus,
  resolveEffectiveLimit,
  spentByCategoryMap,
} from "@/domain/budgets";
import {
  buildDiagnosticBreakdowns,
  buildPaceProjectionBreakdown,
  buildPendingSummaryBreakdown,
  buildRecurrencesSummaryBreakdown,
  buildSavingsChallengesBreakdown,
  type CalculationBreakdown,
  type DiagnosticBreakdowns,
} from "@/domain/calculation-memory";
import { numberToCents, sumGrossCents } from "@/domain/money";
import { computeOverview } from "@/domain/overview";
import {
  dailyBudget,
  endOfMonthProjection,
  pendingProjection,
  spendingPace,
  type EmergencyFundComposition,
} from "@/domain/projection";
import type {
  Budget,
  Category,
  CreditCard,
  Debt,
  Expense,
  FamilyConsolidationResult,
  Income,
  Recurrence,
  UserCustomSettings,
} from "@/types";
import { WEEKEND_RATIO_LIMIT } from "./diagnostics";
import { criticalAlerts } from "./alerts";
import { buildInsightsAnalytics, type InsightsAnalyticsResult } from "./build-insights-analytics";
import {
  buildInsightsWarnings,
  type InsightsWarningItem,
  type PortfolioWarningRow,
} from "./build-insights-warnings";
import type { FeedbackDecision, FeedbackMap } from "./feedback";
import { buildUserFinancialContext } from "./financial-context";
import {
  buildUnifiedLearningGraph,
  type FeedbackEntry,
  type InsightThemeFamily,
  type LearningMerchantRecordLike,
  type PaydayProfile,
  type SmartDecayRecord,
} from "./learning-graph";

export interface BuildInsightsDashboardInput {
  month: string;
  currentCalendarMonth: string;
  now: Date;
  expensesByMonth: readonly (readonly Expense[])[];
  incomes: readonly Income[];
  historicalIncomes?: readonly Income[];
  budgets: readonly Budget[];
  categories: readonly Category[];
  cards: readonly CreditCard[];
  debts: readonly Debt[];
  recurrences?: readonly Recurrence[];
  feedbackMap: FeedbackMap;
  feedbackEntries?: readonly FeedbackEntry[];
  customSettings?: UserCustomSettings | null;
  portfolioRows: readonly PortfolioWarningRow[];
  monthlyContributionCents: number;
  committedObligationsCents: number;
  openInvoicesCents: number;
  nextCycleInvoicesCents?: number;
  nextCycleInvoicesCount?: number;
  futureInvoicesCents?: number;
  futureInvoicesCount?: number;
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
  hasIncome: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  isProvisionalReference: boolean;
  warnings: InsightsWarningItem[];
  dailyCents: number | null;
  projectedExpensesCents: number | null;
  surplusCents: number | null;
  onTrack: boolean | null;
  spentPercent: number;
  elapsedPercent: number;
  paceActive: boolean;
  paceBreakdown: CalculationBreakdown | null;
  pendingSummary: { receivablesCents: number; payablesCents: number; balanceCents: number };
  nextCycleInvoicesCents: number;
  nextCycleInvoicesCount: number;
  futureInvoicesCents: number;
  futureInvoicesCount: number;
  diagnosticBreakdowns: DiagnosticBreakdowns;
  recurrencesBreakdown: CalculationBreakdown;
  pendingBreakdown: CalculationBreakdown;
  challengesBreakdown: CalculationBreakdown;
  baselineMonthlyExpensesCents: number;
  detectedReserveCents: number;
  paydayProfile: PaydayProfile;
  decayByFamily: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
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
  const isCurrentMonth = month === currentCalendarMonth;

  const learning = buildUnifiedLearningGraph({
    referenceMonth: month,
    feedbackEntries: input.feedbackEntries,
    feedbackMap: input.feedbackMap as Record<string, FeedbackDecision>,
    budgets,
    merchantLearning: (input.customSettings?.merchantLearning ?? null) as Readonly<
      Record<string, LearningMerchantRecordLike>
    > | null,
    historicalIncomes: input.historicalIncomes ?? incomes,
    decayByFamily: input.customSettings?.advisorDecayMeta ?? undefined,
  });

  const financialContext = buildUserFinancialContext({
    month,
    todayISO: todayISOStr,
    isCurrentMonth,
    monthIncomes: incomes,
    monthExpenses: month0,
    historicalIncomes: input.historicalIncomes ?? [],
    historicalExpensesByMonth: [month1, month2, month3],
    categories,
    learning,
    liquidity: {
      committedObligationsCents: input.committedObligationsCents,
    },
    wealth: {
      emergencyReserveCents: input.emergencyComposition.totalReserveCents,
      emergencyTargetMonths: input.emergencyComposition.targetMonths,
      monthlyContributionsCents: input.monthlyContributionCents,
    },
  });

  const effectiveMonthlyBudgetCents =
    financialContext.referenceBudgetCents > 0
      ? financialContext.referenceBudgetCents
      : incomeCents > 0
        ? Math.max(incomeCents, averagePastExpensesCents)
        : averagePastExpensesCents;

  const hasValidReference = effectiveMonthlyBudgetCents > 0;
  const pace = hasValidReference
    ? spendingPace({
        spentCents: expenseCents,
        monthlyBudgetCents: effectiveMonthlyBudgetCents,
        dayOfMonth,
        daysInMonth,
      })
    : {
        active: false,
        spentPercent: 0,
        elapsedPercent: Math.round((dayOfMonth / daysInMonth) * 1000) / 10,
        gapPoints: 0,
      };
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;

  const limitsByCategory = budgetLimitsByCategory(budgets);
  const spentByCategory = spentByCategoryMap(month0);
  const activeBudgetsCount = categories
    .filter((c) => c.type === "expense")
    .filter((c) => resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month) > 0).length;
  const overspentBudgets = categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month),
      spentCents: spentByCategory.get(c.id) ?? 0,
    }))
    .filter((row) => row.limitCents > 0 && budgetStatus(row.spentCents, row.limitCents) === "exceeded").length;

  const projection = hasValidReference
    ? endOfMonthProjection({
        phase: "current",
        incomesCents: incomeCents,
        referenceBudgetCents: effectiveMonthlyBudgetCents,
        investmentsCents: input.monthlyContributionCents,
        expensesCents: expenseCents,
        fixedPaidCents: financialContext.lens.consumption.fixedPaidCents,
        pendingFixedCents: financialContext.lens.liquidity.pendingRecurringExpensesCents,
        oneOffAndTripCents: financialContext.lens.consumption.oneOffAndTripCents,
        variableExpensesCents: financialContext.lens.consumption.variableExpenseCents,
        historicalVariableMedianCents: financialContext.lens.consumption.historicalVariableMedianCents,
        dayOfMonth,
        daysInMonth,
      })
    : {
        projectedExpensesCents: null,
        surplusCents: null,
        onTrack: null,
        burnRateCents: null,
      };

  const projectedDeficit =
    financialContext.maturity !== "cold_start" &&
    hasValidReference &&
    dayOfMonth >= 10 &&
    projection.onTrack === false;

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
    isProvisionalReference: financialContext.isProvisionalReference,
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
    hasIncome: incomeCents > 0,
    referenceIncomeCents:
      financialContext.referenceBudgetCents > 0 ? financialContext.referenceBudgetCents : incomeCents,
    learning,
  });

  const daily = hasValidReference
    ? dailyBudget({
        phase: "current",
        incomesCents: effectiveMonthlyBudgetCents,
        investmentsCents: input.monthlyContributionCents,
        expensesCents: expenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { dailyCents: null };

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

  const paceBreakdown =
    hasValidReference && projection.projectedExpensesCents !== null
      ? buildPaceProjectionBreakdown({
          month,
          referenceBudgetCents: effectiveMonthlyBudgetCents,
          referenceBudgetSource: financialContext.referenceBudgetSource,
          isProvisionalReference: financialContext.isProvisionalReference,
          fixedPaidCents: financialContext.lens.consumption.fixedPaidCents,
          pendingFixedCents: financialContext.lens.liquidity.pendingRecurringExpensesCents,
          oneOffAndTripCents: financialContext.lens.consumption.oneOffAndTripCents,
          projectedVariableCents:
            projection.projectedVariableCents ??
            Math.max(
              0,
              projection.projectedExpensesCents - financialContext.lens.consumption.fixedPaidCents,
            ),
          historicalVariableMedianCents: financialContext.lens.consumption.historicalVariableMedianCents,
          blendedWeight: projection.blendedWeight,
          refundsNeutralizedCents: financialContext.lens.consumption.refundsNeutralizedCents,
          priorCycleRefundCreditCents: financialContext.lens.consumption.priorCycleRefundCreditCents,
          investmentCents: input.monthlyContributionCents,
          projectedSurplusCents: projection.surplusCents,
          dailyCents: daily.dailyCents,
          dayOfMonth,
          daysInMonth,
        })
      : null;

  const pendingSummary = pendingProjection(pending);
  const nextCycleInvoicesCents = Math.max(0, input.nextCycleInvoicesCents ?? 0);
  const nextCycleInvoicesCount = Math.max(0, input.nextCycleInvoicesCount ?? 0);
  const futureInvoicesCents = Math.max(0, input.futureInvoicesCents ?? 0);
  const futureInvoicesCount = Math.max(0, input.futureInvoicesCount ?? 0);

  const diagnosticBreakdowns = buildDiagnosticBreakdowns({
    month,
    incomeCents,
    expenseCents,
    investmentCents: input.monthlyContributionCents,
    committedObligationsCents,
    savingsRate: effectiveSavingsRateForHealth,
    hasIncome: incomeCents > 0,
    overspentBudgets,
    activeBudgetsCount,
    topIncomeSourceCents: analytics.incomeTopSourceCents,
    concentrationPercent: analytics.concentration.topSharePercent,
    weekdayDailyCents: analytics.weekdayDailyCents,
    weekendDailyCents: analytics.weekendDailyCents,
    weekendRatio: analytics.weekendRatio,
    weekendComparable: analytics.weekendComparable,
    weekendLimitRatio: WEEKEND_RATIO_LIMIT,
    essentialCents: analytics.essentialSpending.essentialCents,
    essentialDenominatorCents: analytics.essentialSpending.totalCents,
    essentialPercent: analytics.essentialSpending.ratioPercent,
    trendHasPreviousBase: analytics.trendHasPreviousBase,
    previousComparableCents: analytics.previousComparableCents,
    trendPercent: analytics.trendPercent,
    nextCycleInvoicesCents,
    futureInvoicesCents,
  });

  const fixedCommitmentRate =
    incomeCents > 0
      ? Math.round((analytics.totalRecurringCents / incomeCents) * 1000) / 10
      : null;

  const recurrencesBreakdown = buildRecurrencesSummaryBreakdown({
    totalRecurringCents: analytics.totalRecurringCents,
    totalAnnualRecurringCents: analytics.totalAnnualRecurringCents,
    canCutRecurringCents: analytics.canCutRecurringCents,
    monthlyIncomeCents: incomeCents,
    fixedCommitmentRate,
  });

  const pendingBreakdown = buildPendingSummaryBreakdown({
    month,
    receivablesCents: pendingSummary.receivablesCents,
    payablesCents: pendingSummary.payablesCents,
    balanceCents: pendingSummary.balanceCents,
    openInvoicesCents: isCurrentMonth ? input.openInvoicesCents : 0,
    nextCycleInvoicesCents,
    nextCycleInvoicesCount,
    futureInvoicesCents,
    futureInvoicesCount,
  });

  const challengesBreakdown = buildSavingsChallengesBreakdown({
    challenges: analytics.challenges,
    discretionarySavingsCents:
      analytics.showDiscretionary && analytics.discretionary
        ? analytics.discretionary.savingsCents
        : null,
  });

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    savingsRate,
    effectiveSavingsRateForHealth,
    overspentBudgets,
    hasTransactions: month0.length > 0 || incomes.length > 0,
    hasIncome: incomeCents > 0,
    dayOfMonth,
    daysInMonth,
    isProvisionalReference: financialContext.isProvisionalReference,
    warnings,
    dailyCents: daily.dailyCents,
    projectedExpensesCents: projection.projectedExpensesCents,
    surplusCents: projection.surplusCents,
    onTrack: projection.onTrack,
    spentPercent: pace.spentPercent,
    elapsedPercent: pace.elapsedPercent,
    paceActive: pace.active,
    paceBreakdown,
    pendingSummary,
    nextCycleInvoicesCents,
    nextCycleInvoicesCount,
    futureInvoicesCents,
    futureInvoicesCount,
    diagnosticBreakdowns,
    recurrencesBreakdown,
    pendingBreakdown,
    challengesBreakdown,
    baselineMonthlyExpensesCents,
    detectedReserveCents,
    paydayProfile: learning.paydayProfile,
    decayByFamily: learning.decayByFamily,
    ...analytics,
  };
}
