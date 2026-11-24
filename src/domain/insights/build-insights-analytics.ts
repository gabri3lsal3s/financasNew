import { shiftMonth } from "@/domain/cards";
import { numberToCents, sumGrossCents } from "@/domain/money";
import { aggregateByWeekday } from "@/domain/reports";
import {
  buildChallengeOptions,
  discretionaryChallenge,
  pickTopChallenges,
  typicalMonthlySpendCents,
  type CategorySpend,
  type ChallengeOption,
  type DiscretionaryChallenge,
} from "@/domain/savings";
import { realizedByCategoryMap } from "@/domain/budgets";
import type { Category, CreditCard, Expense, Income } from "@/types";
import {
  calculateProRataTrend,
  calculateWeekdayWeekendDailyAverages,
  essentialSpendingRatio,
  incomeConcentration,
  isWeekendComparisonReliable,
  savingsHealth,
  weekendSpendingRatio,
  type EssentialSpendingResult,
  type IncomeConcentration,
  type SavingsHealth,
} from "./diagnostics";
import { resolveCategorySemantics } from "./category-semantics";
import { partitionFeedback, type FeedbackDecision, type FeedbackMap } from "./feedback";
import type { UnifiedLearningGraph } from "./learning-graph";
import { calculateRecurringTotals, detectRecurrences, type ExpenseLike, type RecurrenceOccurrence } from "./recurrences";
import { normalizeText, stripTemporalSuffixes } from "./shared";

function isExpenseMarkedEssential(
  expense: Pick<Expense, "id" | "description" | "category_id">,
  category: Category | undefined,
  essentialKeys?: ReadonlySet<string>,
): boolean {
  if (category) {
    const sem = resolveCategorySemantics({ name: category.name, icon: category.icon });
    if (sem.isEssential) {
      return true;
    }
  }
  if (!essentialKeys || essentialKeys.size === 0) return false;
  if (essentialKeys.has(expense.id) || essentialKeys.has(expense.category_id)) return true;
  const normalizedDesc = normalizeText(stripTemporalSuffixes(expense.description ?? ""));
  if (normalizedDesc && essentialKeys.has(normalizedDesc)) return true;
  if (category?.name) {
    const normalizedCat = normalizeText(category.name);
    if (normalizedCat && essentialKeys.has(normalizedCat)) return true;
  }
  return false;
}

export interface BuildInsightsAnalyticsInput {
  month: string;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  todayISOStr: string;
  now: Date;
  expensesByMonth: readonly (readonly Expense[])[];
  incomes: readonly Income[];
  categories: readonly Category[];
  cards: readonly CreditCard[];
  feedbackMap: FeedbackMap;
  incomeCents: number;
  expenseCents: number;
  effectiveSavingsRateForHealth: number;
  hasIncome?: boolean;
  referenceIncomeCents?: number;
  learning?: UnifiedLearningGraph;
}

export interface InsightsAnalyticsResult {
  health: SavingsHealth;
  concentration: IncomeConcentration;
  weekendComparable: boolean;
  weekendRatio: number;
  trendHasPreviousBase: boolean;
  trendSignificant: boolean;
  trendPercent: number;
  essentialSpending: EssentialSpendingResult;
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
  activeOccurrences: RecurrenceOccurrence[];
  ignoredOccurrences: RecurrenceOccurrence[];
  lapsedOccurrences: RecurrenceOccurrence[];
  challenges: ChallengeOption[];
  showDiscretionary: boolean;
  discretionary: DiscretionaryChallenge | null;
}

export function buildInsightsAnalytics(input: BuildInsightsAnalyticsInput): InsightsAnalyticsResult {
  const { month, isCurrentMonth, dayOfMonth, daysInMonth, todayISOStr, now, expensesByMonth, incomes, categories, cards } = input;
  const [month0 = [], month1 = [], month2 = [], month3 = []] = expensesByMonth;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const allExpenses: ExpenseLike[] = [month0, month1, month2, month3].flatMap((list, index) =>
    list.map((e) => ({
      id: e.id,
      description: e.description,
      date: e.date,
      month: shiftMonth(month, -index),
      valueCents: numberToCents(e.value * e.report_weight),
      categoryId: e.category_id,
      categoryName: categoryById.get(e.category_id)?.name ?? null,
      categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
      installmentGroupId: e.installment_group_id,
      recurrenceId: e.recurrence_id,
      tripId: e.trip_id,
      paymentMethod: e.payment_method,
      cardId: e.card_id,
      cardName: e.card_id ? cardById.get(e.card_id)?.name ?? null : null,
      rawExpense: e,
    })),
  );

  const feedbackMap = input.feedbackMap as Record<string, FeedbackDecision>;
  const occurrences = detectRecurrences(allExpenses, {
    todayISO: todayISOStr,
    feedbackMap,
    includeFormalRecurrences: true,
    merchantAliasMap: input.learning?.merchantAliasMap,
    learnedServices: input.learning?.learnedServices,
  });
  const { active: partitionedActive, ignored: ignoredOccurrences } = partitionFeedback(occurrences, feedbackMap);
  const activeOccurrences = partitionedActive.filter((o) => o.lifecycle !== "lapsed");
  const lapsedOccurrences = partitionedActive.filter((o) => o.lifecycle === "lapsed");
  const recurringTotals = calculateRecurringTotals(activeOccurrences);

  const essentialKeys = input.learning?.essentialKeys;
  const oneOffExpenseIds = input.learning?.oneOffExpenseIds;
  const currentMonthOneOffKeys = input.learning?.currentMonthOneOffKeys;

  const spentByMonth = [month0, month1, month2, month3].map((list, idx) => {
    const map = new Map<string, number>();
    for (const e of list) {
      if (e.trip_id != null) continue;
      if (oneOffExpenseIds?.has(e.id)) continue;
      if (idx === 0 && currentMonthOneOffKeys && currentMonthOneOffKeys.size > 0) {
        const cleanDesc = normalizeText(stripTemporalSuffixes(e.description ?? ""));
        if (cleanDesc && currentMonthOneOffKeys.has(cleanDesc)) continue;
      }
      const cat = categoryById.get(e.category_id);
      if (isExpenseMarkedEssential(e, cat, essentialKeys)) continue;
      const weightedCents = numberToCents(e.value * (e.report_weight ?? 1));
      if (weightedCents <= 0) continue;
      map.set(e.category_id, (map.get(e.category_id) ?? 0) + weightedCents);
    }
    return map;
  });
  const categorySpends: CategorySpend[] = categories
    .filter((c) => c.type === "expense")
    .map((c) => {
      const catKey = normalizeText(c.name);
      const sem = resolveCategorySemantics({ name: c.name, icon: c.icon });
      const isNonCuttable =
        !sem.isCuttableCategory ||
        Boolean(essentialKeys?.has(c.id)) ||
        Boolean(catKey && essentialKeys?.has(catKey));
      return {
        categoryId: c.id,
        name: c.name,
        icon: c.icon,
        monthlyAvgCents: typicalMonthlySpendCents(spentByMonth.map((m) => m.get(c.id) ?? 0)),
        essential: isNonCuttable,
      };
    });
  const hasIncome = input.hasIncome ?? input.incomeCents > 0;
  const hasHistoricalMonths = month1.length > 0 || month2.length > 0 || month3.length > 0;
  const referenceForChallenges =
    hasIncome || hasHistoricalMonths ? (input.referenceIncomeCents ?? input.incomeCents) : 0;
  const challenges = pickTopChallenges(buildChallengeOptions(categorySpends, referenceForChallenges));
  const discretionary = discretionaryChallenge(categorySpends, referenceForChallenges);
  const showDiscretionary = discretionary !== null && discretionary.categoryCount >= 2;

  const incomeByCategory = realizedByCategoryMap(incomes);
  const concentration = incomeConcentration([...incomeByCategory.values()], {
    isSingleSalarySource: incomes.length === 1,
  });
  const health = savingsHealth(input.effectiveSavingsRateForHealth, hasIncome);

  const [yearStr, monthNumStr] = month.split("-");
  const yr = Number(yearStr ?? now.getFullYear());
  const mo = Number(monthNumStr ?? now.getMonth() + 1) - 1;
  const limitDay = isCurrentMonth ? Math.min(dayOfMonth, daysInMonth) : daysInMonth;
  let elapsedWeekdaysCount = 0;
  let elapsedWeekendDaysCount = 0;
  for (let d = 1; d <= limitDay; d++) {
    const dayOfWeek = new Date(yr, mo, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) elapsedWeekendDaysCount++;
    else elapsedWeekdaysCount++;
  }

  const weekdayTotals = aggregateByWeekday(
    month0.map((e) => ({
      id: e.id,
      date: e.date,
      kind: "expense" as const,
      categoryId: e.category_id,
      categoryName: "",
      baseCents: numberToCents(e.value),
      weight: e.report_weight,
    })),
  );
  const { weekdayDailyCents, weekendDailyCents } = calculateWeekdayWeekendDailyAverages(weekdayTotals, {
    elapsedWeekdaysCount: Math.max(1, elapsedWeekdaysCount),
    elapsedWeekendDaysCount: Math.max(1, elapsedWeekendDaysCount),
  });
  const weekendRatio = weekendSpendingRatio(weekdayDailyCents, weekendDailyCents);
  const weekendComparable = isWeekendComparisonReliable({
    totalExpenseCount: month0.length,
    elapsedWeekdaysCount,
    elapsedWeekendDaysCount,
    weekdayDailyCents,
  });

  const prevComparableCents = isCurrentMonth
    ? month1
        .filter((e) => Boolean(e.date) && Number(e.date.slice(8, 10)) <= dayOfMonth)
        .reduce((acc, e) => acc + numberToCents(e.value * (e.report_weight ?? 1)), 0)
    : sumGrossCents(month1);
  const trend = calculateProRataTrend(input.expenseCents, prevComparableCents);

  const essentialExpensesCents = month0
    .filter((e) => isExpenseMarkedEssential(e, categoryById.get(e.category_id), essentialKeys))
    .reduce((acc, e) => acc + numberToCents(e.value * (e.report_weight ?? 1)), 0);

  return {
    health,
    concentration,
    weekendComparable,
    weekendRatio,
    trendHasPreviousBase: trend.hasPreviousBase,
    trendSignificant: trend.isSignificant,
    trendPercent: trend.percentChange,
    essentialSpending: essentialSpendingRatio(essentialExpensesCents, input.expenseCents, {
      transactionCount: month0.length,
      referenceIncomeCents: input.referenceIncomeCents,
    }),
    ...recurringTotals,
    activeOccurrences,
    ignoredOccurrences,
    lapsedOccurrences,
    challenges,
    showDiscretionary,
    discretionary,
  };
}
