import { budgetLimitsByCategory, isInheritedLimit, resolveEffectiveLimit, spentByCategoryMap, spentGrossByCategoryMap } from "@/domain/budgets/index";
import { resolveOpenCardInvoices } from "@/domain/cards/index";
import { isParticipantFullySettled, isSplitFullyCompleted } from "@/domain/finance/split-math";
import { resolveGoalComposition, type AccountCompositionItem, type PortfolioAssetCompositionItem } from "@/domain/goals/goal-composition";
import type {
  PaydayProfile,
  ReferenceBudgetSource,
  UserFinancialContext,
} from "@/domain/insights";
import { numberToCents } from "@/domain/money/parse";
import { sumGrossCents, sumWeightedCents } from "@/domain/money/totals";
import { contributionsInMonthCents } from "@/domain/portfolio/contributions";
import { analyzeCashGap, projectCardInvoiceObligations, type CashGapAnalysisResult, type CashGapInflow } from "@/domain/projection/cash-gap";
import { computeWeeklyDueRadar, type WeeklyRadarSummary } from "@/domain/projection/weekly-radar";
import { dailyBudget, endOfMonthProjection, spendingPace } from "@/domain/projection/index";
import type {
  Budget,
  CardBillRollover,
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
  Recurrence,
  SplitSharePayload,
} from "@/types";
import { shouldShowGoalAlert } from "./alert-dismissals";
import { buildDailyCumulativeSeries, buildDailyFlow, computeOverview, type DailyFlowItem, type DailySeriesAccumulator, type OverviewTotals } from "@/domain/overview/index";

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

export interface CurrentMonthProjectionMetricsResult {
  pace: ReturnType<typeof spendingPace>;
  daily: ReturnType<typeof dailyBudget>;
  projection: ReturnType<typeof endOfMonthProjection>;
  showPaceAlert: boolean;
  referenceBudgetCents: number;
  referenceBudgetSource: ReferenceBudgetSource;
  isProvisionalReference: boolean;
}

export function computeCurrentMonthProjectionMetrics(params: {
  isCurrentMonth: boolean;
  grossIncomeCents: number;
  grossExpenseCents: number;
  investmentCents: number;
  dayOfMonth: number;
  daysInMonth: number;
  financialContext?: UserFinancialContext;
}): CurrentMonthProjectionMetricsResult {
  const {
    isCurrentMonth,
    grossIncomeCents,
    grossExpenseCents,
    investmentCents,
    dayOfMonth,
    daysInMonth,
    financialContext,
  } = params;

  if (!isCurrentMonth) {
    return {
      pace: { active: false, spentPercent: 0, elapsedPercent: 0, gapPoints: 0, ahead: false },
      daily: { dailyCents: null, monthlyNetCents: 0, daysRemaining: null },
      projection: {
        projectedExpensesCents: null,
        surplusCents: null,
        onTrack: null,
        burnRateCents: null,
      },
      showPaceAlert: false,
      referenceBudgetCents: financialContext
        ? financialContext.referenceBudgetCents
        : Math.max(0, grossIncomeCents),
      referenceBudgetSource: financialContext
        ? financialContext.referenceBudgetSource
        : grossIncomeCents > 0
          ? "current_income"
          : "none",
      isProvisionalReference: financialContext ? financialContext.isProvisionalReference : false,
    };
  }

  if (financialContext) {
    const {
      referenceBudgetCents,
      referenceBudgetSource,
      isProvisionalReference,
      maturity,
      lens,
    } = financialContext;
    const {
      operatingIncomeCents,
      netExpenseCents,
      fixedPaidCents,
      oneOffAndTripCents,
      variableExpenseCents,
      variableTxCount,
      variableDaysCount,
      historicalVariableMedianCents,
      priorCycleRefundCreditCents,
    } = lens.consumption;
    const pendingFixedCents = lens.liquidity.pendingRecurringExpensesCents;

    const pace = spendingPace({
      spentCents: netExpenseCents,
      monthlyBudgetCents: referenceBudgetCents,
      dayOfMonth,
      daysInMonth,
    });

    const daily = dailyBudget({
      phase: "current",
      incomesCents: operatingIncomeCents,
      referenceBudgetCents,
      investmentsCents: investmentCents,
      expensesCents: netExpenseCents,
      pendingFixedCents,
      dayOfMonth,
      daysInMonth,
    });

    const projection = endOfMonthProjection({
      phase: "current",
      incomesCents: operatingIncomeCents,
      referenceBudgetCents,
      investmentsCents: investmentCents,
      expensesCents: netExpenseCents,
      fixedPaidCents,
      pendingFixedCents,
      oneOffAndTripCents,
      variableExpensesCents: variableExpenseCents,
      historicalVariableMedianCents,
      priorCycleRefundCreditCents,
      variableTxCount,
      variableDaysCount,
      dayOfMonth,
      daysInMonth,
    });

    // Regra anti-falso-alarme: contas fixas pagas no ciclo (ex.: Aluguel) não disparam PaceAlert sozinhas;
    // exige base válida, fim de cold_start/early_month e déficit projetado OU aceleração real do consumo variável.
    const availableAfterInvestments = Math.max(0, referenceBudgetCents - investmentCents);
    const variableEnvelope = Math.max(
      0,
      availableAfterInvestments - fixedPaidCents - pendingFixedCents - oneOffAndTripCents,
    );
    const variableSpentPercent =
      variableEnvelope > 0 ? (variableExpenseCents / variableEnvelope) * 100 : 0;
    const isProjectedDeficit =
      projection.onTrack === false || (projection.surplusCents !== null && projection.surplusCents < 0);
    const isVariableAccelerating =
      variableEnvelope > 0 && variableTxCount >= 2 && variableSpentPercent > pace.elapsedPercent + 10;
    const isApproachingCeilingEarly =
      projection.projectedExpensesCents !== null &&
      availableAfterInvestments > 0 &&
      projection.projectedExpensesCents >= availableAfterInvestments * 0.9 &&
      pace.elapsedPercent < 85 &&
      pace.spentPercent > pace.elapsedPercent;

    const showPaceAlert =
      pace.active &&
      referenceBudgetCents > 0 &&
      maturity !== "cold_start" &&
      maturity !== "early_month" &&
      (isProjectedDeficit || isVariableAccelerating || isApproachingCeilingEarly);

    return {
      pace,
      daily,
      projection,
      showPaceAlert,
      referenceBudgetCents,
      referenceBudgetSource,
      isProvisionalReference,
    };
  }

  const safeBudgetCents = Math.max(0, grossIncomeCents);
  const pace = spendingPace({
    spentCents: grossExpenseCents,
    monthlyBudgetCents: safeBudgetCents,
    dayOfMonth,
    daysInMonth,
  });

  const daily = dailyBudget({
    phase: "current",
    incomesCents: safeBudgetCents,
    investmentsCents: investmentCents,
    expensesCents: grossExpenseCents,
    dayOfMonth,
    daysInMonth,
  });

  const projection = endOfMonthProjection({
    phase: "current",
    incomesCents: safeBudgetCents,
    investmentsCents: investmentCents,
    expensesCents: grossExpenseCents,
    dayOfMonth,
    daysInMonth,
  });

  const showPaceAlert =
    safeBudgetCents > 0 &&
    pace.active &&
    (pace.ahead || projection.onTrack === false || (projection.surplusCents !== null && projection.surplusCents < 0));

  return {
    pace,
    daily,
    projection,
    showPaceAlert,
    referenceBudgetCents: safeBudgetCents,
    referenceBudgetSource: safeBudgetCents > 0 ? "current_income" : "none",
    isProvisionalReference: false,
  };
}

function getMonthDaysCount(month: string): number {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr ?? 2026);
  const m = Number(mStr ?? 1);
  return new Date(y, m, 0).getDate();
}

function resolveIncomeRecurrenceDatesInMonth(
  recurrence: Recurrence,
  month: string,
  daysInMonth: number,
): string[] {
  const startMonth = recurrence.start_date.slice(0, 7);
  if (startMonth > month) return [];

  const [sy, sm] = startMonth.split("-").map(Number);
  const [ty, tm] = month.split("-").map(Number);
  if (sy === undefined || sm === undefined || ty === undefined || tm === undefined) return [];
  const diffMonths = (ty - sy) * 12 + (tm - sm);
  if (diffMonths < 0) return [];

  const dates: string[] = [];
  if (recurrence.frequency === "weekly") {
    const startUtc = new Date(`${recurrence.start_date}T12:00:00Z`);
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
    const cursor = new Date(startUtc);
    let safety = 0;
    while (safety < 400) {
      const iso = cursor.toISOString().slice(0, 10);
      if (iso > monthEnd) break;
      if (iso.slice(0, 7) === month) {
        if (recurrence.occurrences_total != null && safety >= recurrence.occurrences_total) break;
        if (!recurrence.end_date || iso <= recurrence.end_date) {
          dates.push(iso);
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      safety += 1;
    }
    return dates;
  }

  let intervalMonths = 1;
  if (recurrence.frequency === "quarterly") intervalMonths = 3;
  else if (recurrence.frequency === "yearly") intervalMonths = 12;

  if (diffMonths % intervalMonths !== 0) return [];

  const occurrenceIndex = Math.floor(diffMonths / intervalMonths);
  if (recurrence.occurrences_total != null && occurrenceIndex >= recurrence.occurrences_total) {
    return [];
  }

  const startDay = parseInt(recurrence.start_date.slice(8, 10), 10) || 1;
  const clampedDay = Math.min(startDay, daysInMonth);
  const candidateDate = `${month}-${String(clampedDay).padStart(2, "0")}`;
  if (candidateDate < recurrence.start_date) return [];
  if (recurrence.end_date && candidateDate > recurrence.end_date) return [];
  return [candidateDate];
}

export interface BuildPredictedUpcomingCashInflowsParams {
  month: string;
  today: string;
  isCurrentMonth: boolean;
  monthIncomes: readonly Pick<Income, "id" | "date" | "value" | "category_id" | "recurrence_id" | "source_ref">[];
  paydayProfile: PaydayProfile;
  expectedUpcomingInflowsCents: number;
  formalIncomeRecurrences?: readonly Recurrence[];
}

/**
 * Converte rendas recorrentes formais e parcelas esperadas do `PaydayProfile` (confiança >= 0.6)
 * em entradas futuras previstas (`CashGapInflow`) para evitar falsos alarmes de fluxo de caixa antes do salário cair.
 */
export function buildPredictedUpcomingCashInflows(
  params: BuildPredictedUpcomingCashInflowsParams,
): CashGapInflow[] {
  const {
    month,
    today,
    isCurrentMonth,
    monthIncomes,
    paydayProfile,
    expectedUpcomingInflowsCents,
    formalIncomeRecurrences = [],
  } = params;

  if (!isCurrentMonth || today.slice(0, 7) !== month) {
    return [];
  }

  const daysInMonth = getMonthDaysCount(month);
  const currentDay = parseInt(today.slice(8, 10), 10) || 1;
  const operationalIncomes = monthIncomes.filter(
    (inc) => !inc.source_ref?.startsWith("[REFUND]") && numberToCents(inc.value) > 0,
  );

  const predicted: CashGapInflow[] = [];
  const consumedIncomeIds = new Set<string>();
  const coveredDays: number[] = operationalIncomes.map((inc) => parseInt(inc.date.slice(8, 10), 10) || 1);
  let formalSumCents = 0;

  // Passo A: Recorrências formais de receita ativas com vencimento >= hoje no mês atual
  for (const rec of formalIncomeRecurrences) {
    if (!rec.is_active || rec.kind !== "income") continue;
    const expectedCents = numberToCents(rec.value);
    if (expectedCents <= 0) continue;

    const dates = resolveIncomeRecurrenceDatesInMonth(rec, month, daysInMonth);
    for (const expectedDate of dates) {
      const expectedDay = parseInt(expectedDate.slice(8, 10), 10) || 1;

      const matchedIncome =
        operationalIncomes.find(
          (inc) =>
            !consumedIncomeIds.has(inc.id) &&
            inc.recurrence_id === rec.id &&
            (recurrenceDayMatches(rec.frequency, inc.date, expectedDate)),
        ) ??
        operationalIncomes.find((inc) => {
          if (consumedIncomeIds.has(inc.id)) return false;
          const incDay = parseInt(inc.date.slice(8, 10), 10) || 1;
          const sameCat = !rec.category_id || inc.category_id === rec.category_id;
          const incCents = numberToCents(inc.value);
          const nearValue = Math.abs(incCents - expectedCents) <= expectedCents * 0.25;
          const nearDay = Math.abs(incDay - expectedDay) <= 3;
          return sameCat && nearDay && nearValue;
        });

      if (matchedIncome) {
        consumedIncomeIds.add(matchedIncome.id);
        continue;
      }

      if (expectedDate < today) continue;

      predicted.push({
        id: `pred-rec-inc-${rec.id}-${expectedDate}`,
        name: rec.description?.trim() || "Receita recorrente prevista",
        expectedDate,
        amountCents: expectedCents,
      });
      formalSumCents += expectedCents;
      coveredDays.push(expectedDay);
    }
  }

  // Passo B: Parcelas habituais previstas via PaydayProfile (confiança >= 0.6)
  const remainingExpected = Math.max(0, Math.round(expectedUpcomingInflowsCents) - formalSumCents);
  if (remainingExpected > 0 && paydayProfile.confidence >= 0.6) {
    const candidateDays = paydayProfile.typicalIncomeDays
      .map((d) => Math.min(Math.max(1, d), daysInMonth))
      .filter((clampedDay) => clampedDay >= currentDay)
      .filter((clampedDay) => !coveredDays.some((cd) => Math.abs(cd - clampedDay) <= 2));

    let effectiveDates = candidateDays.map((d) => `${month}-${String(d).padStart(2, "0")}`);

    if (effectiveDates.length === 0) {
      const hasWithinTolerance = paydayProfile.typicalIncomeDays.some((d) => {
        const clampedDay = Math.min(Math.max(1, d), daysInMonth);
        return (
          clampedDay < currentDay &&
          currentDay <= Math.min(daysInMonth, clampedDay + 2) &&
          !coveredDays.some((cd) => Math.abs(cd - clampedDay) <= 2)
        );
      });
      if (hasWithinTolerance) {
        effectiveDates = [today];
      }
    }

    if (effectiveDates.length > 0) {
      const baseAmount = Math.floor(remainingExpected / effectiveDates.length);
      let remainder = remainingExpected - baseAmount * effectiveDates.length;

      for (const expectedDate of effectiveDates) {
        const slice = baseAmount + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        if (slice <= 0) continue;
        predicted.push({
          id: `pred-payday-${expectedDate}`,
          name: "Renda habitual prevista",
          expectedDate,
          amountCents: slice,
        });
      }
    }
  }

  return predicted;
}

function recurrenceDayMatches(
  frequency: Recurrence["frequency"],
  incomeDate: string,
  expectedDate: string,
): boolean {
  if (frequency !== "weekly") return true;
  const d1 = parseInt(incomeDate.slice(8, 10), 10) || 1;
  const d2 = parseInt(expectedDate.slice(8, 10), 10) || 1;
  return Math.abs(d1 - d2) <= 3;
}

export function buildOverviewCashGapResult(params: {
  isLoading?: boolean;
  currentBalanceCents: number;
  today: string;
  month: string;
  rangeEnd: string;
  cards: readonly CreditCard[];
  cardExpenses: readonly Expense[];
  cardPayments: readonly CardPayment[];
  cardRollovers?: readonly CardBillRollover[];
  debts: readonly Debt[];
  incomes: readonly Income[];
  hasLiquidityContext?: boolean;
  predictedInflows?: readonly CashGapInflow[];
}): CashGapAnalysisResult {
  const {
    isLoading = false,
    currentBalanceCents,
    today,
    month,
    rangeEnd,
    cards,
    cardExpenses,
    cardPayments,
    cardRollovers = [],
    debts,
    incomes,
    hasLiquidityContext,
    predictedInflows = [],
  } = params;

  if (isLoading || hasLiquidityContext === false) {
    return {
      isCashGapDetected: false,
      severity: "none",
      gapDate: null,
      daysUntilGap: null,
      maxDeficitCents: 0,
      nextInflowDate: null,
      causingObligations: [],
      recommendationMessage: null,
      runway: [],
    };
  }

  const baseInflows: CashGapInflow[] = [
    ...debts
      .filter((d) => d.type === "receivable" && !d.paid_at && d.due_date && d.due_date >= today)
      .map((d) => ({
        id: `recv-${d.id}`,
        name: d.name,
        expectedDate: d.due_date,
        amountCents: numberToCents(d.amount),
      })),
    ...incomes
      .filter((i) => !i.source_ref?.startsWith("[REFUND]") && i.date >= today)
      .map((i) => ({
        id: `income-${i.id}`,
        name: "Renda prevista",
        expectedDate: i.date,
        amountCents: numberToCents(i.value),
      })),
  ];

  const seenIds = new Set(baseInflows.map((inf) => inf.id));
  const extraPredicted: CashGapInflow[] = [];
  for (const inf of predictedInflows) {
    if (seenIds.has(inf.id) || inf.expectedDate < today || inf.amountCents <= 0) continue;
    seenIds.add(inf.id);
    extraPredicted.push(inf);
  }

  return analyzeCashGap({
    currentBalanceCents,
    today,
    obligations: [
      ...projectCardInvoiceObligations({
        cards: [...cards],
        expenses: [...cardExpenses],
        payments: [...cardPayments],
        rollovers: [...cardRollovers],
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
    inflows: [...baseInflows, ...extraPredicted],
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
  cardRollovers?: readonly CardBillRollover[];
  debts?: readonly Debt[];
}): WeeklyRadarSummary {
  const {
    isLoading,
    today,
    month,
    currentBalanceCents,
    cards,
    cardExpenses,
    cardPayments,
    cardRollovers = [],
    debts,
  } = params;

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

  const invoices = resolveOpenCardInvoices({
    cards,
    expenses: cardExpenses,
    payments: cardPayments,
    rollovers: cardRollovers,
    today,
  }).map((inv) => ({
    id: `bill:${inv.cardId}:${inv.competenceMonth}`,
    name:
      inv.competenceMonth === month
        ? `Fatura ${inv.cardName}`
        : `Fatura ${inv.cardName} (${inv.competenceMonth})`,
    dueDate: inv.effectiveDueDate,
    amountCents: inv.saldoBrutoCents,
    cardId: inv.cardId,
    competenceMonth: inv.competenceMonth,
  }));

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
    const normalizedDebtName = debt.name.trim().toLowerCase();
    if (!normalizedDebtName.startsWith("racha:") && !/(?:^|[\s:_-])racha(?:$|[\s:_-])/.test(normalizedDebtName)) continue;

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

  const candidates = activeList
    .map((s) => {
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

      // Apenas metas com marcos relevantes geram alerta no carrossel da Home
      const isAlertWorthy = isCompleted || isFinalStretch || hasSurplus;

      const shouldShow =
        isAlertWorthy &&
        shouldShowGoalAlert(goalDismissals?.[s.id], {
          goalId: s.id,
          currentCents,
          targetCents,
          percentage,
          stage,
        });

      return {
        share: s,
        percentage,
        isCompleted,
        isFinalStretch,
        shouldShow,
      };
    })
    .filter((c) => c.shouldShow);

  // Metas concluídas ou em reta final possuem relevância máxima de celebração/urgência
  const milestoneGoals = candidates
    .filter((c) => c.isCompleted || c.isFinalStretch)
    .map((c) => c.share);

  // Havendo metas apenas elegíveis por sobra de caixa, prioriza no máximo 1 (a mais adiantada)
  // para evitar duplicar múltiplas sugestões de aporte sobre o mesmo capital
  const surplusOnlyCandidates = candidates
    .filter((c) => !c.isCompleted && !c.isFinalStretch)
    .sort((a, b) => b.percentage - a.percentage);

  const topSurplusGoal = surplusOnlyCandidates[0]?.share ? [surplusOnlyCandidates[0].share] : [];

  return [...milestoneGoals, ...topSurplusGoal];
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
