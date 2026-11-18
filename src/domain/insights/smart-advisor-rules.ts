import { budgetLimitsByCategory, realizedByCategoryMap, resolveEffectiveLimit } from "@/domain/budgets";
import { numberToCents, sumGrossCents } from "@/domain/money";
import { calculateSurplusCapacity } from "@/domain/overview";
import { shiftMonth } from "@/lib/date";
import type { Budget, Category, FamilyConsolidationResult, IncomeGoal } from "@/types";
import {
  filterAndRankAllAdvisorInsights,
  generateSmartAdvisorInsights,
  type CardForAdvisorContext,
  type SmartAdvisorInsight,
} from "./advisor";
import type { FeedbackMap, QualifiedDismissReason } from "./feedback";
import type { SpendingHabit } from "./habits";
import {
  detectIncomeRecurrences,
  detectRecurrences,
  type ExpenseLike,
  type IncomeLike,
} from "./recurrences";

export interface RawAdvisorExpenseItem {
  id: string;
  description?: string | null;
  date: string;
  value: number;
  report_weight?: number | null;
  category_id: string;
  installment_group_id?: string | null;
  recurrence_id?: string | null;
}

export interface RawAdvisorIncomeItem {
  id: string;
  description?: string | null;
  date: string;
  value: number;
  report_weight?: number | null;
  category_id: string;
  installment_group_id?: string | null;
  recurrence_id?: string | null;
}

export function mergeAndFilterValidDismissals(
  storeDismissals: Record<string, number>,
  cloudDismissals: Record<string, number> | undefined,
  nowMs: number,
  hasLocalOverride: boolean,
  localDismissals?: Record<string, number>,
): Record<string, number> {
  if (hasLocalOverride && localDismissals !== undefined) return localDismissals;
  if (!cloudDismissals) return storeDismissals;
  const merged = { ...storeDismissals, ...cloudDismissals };
  const valid: Record<string, number> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "number" && v > nowMs) {
      valid[k] = v;
    }
  }
  return valid;
}

export function computeDismissCooldownExpiry(nowMs: number, days: number): number {
  return nowMs + days * 24 * 60 * 60 * 1000;
}

export function mapRawExpensesToAdvisorLikes(
  buckets: ReadonlyArray<{ data: readonly RawAdvisorExpenseItem[] | undefined; month: string }>,
  categoryById: ReadonlyMap<string, Category>,
): ExpenseLike[] {
  return buckets.flatMap(({ data, month }) =>
    (data ?? []).map((e) => ({
      id: e.id,
      description: e.description ?? null,
      date: e.date,
      month: e.date ? e.date.slice(0, 7) : month,
      valueCents: numberToCents(e.value * (e.report_weight ?? 1.0)),
      categoryId: e.category_id,
      categoryName: categoryById.get(e.category_id)?.name ?? null,
      categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
      installmentGroupId: e.installment_group_id ?? null,
      recurrenceId: e.recurrence_id ?? null,
    })),
  );
}

export function mapRawIncomesToAdvisorLikes(
  buckets: ReadonlyArray<readonly RawAdvisorIncomeItem[] | undefined>,
  refMonth: string,
  categoryById: ReadonlyMap<string, Category>,
): IncomeLike[] {
  return buckets.flatMap((data, index) =>
    (data ?? []).map((i) => ({
      id: i.id,
      description: i.description ?? null,
      date: i.date,
      month: shiftMonth(refMonth, -index),
      valueCents: numberToCents(i.value * (i.report_weight ?? 1.0)),
      categoryId: i.category_id,
      categoryName: categoryById.get(i.category_id)?.name ?? null,
      categoryIcon: categoryById.get(i.category_id)?.icon ?? null,
      installmentGroupId: i.installment_group_id ?? null,
      recurrenceId: i.recurrence_id ?? null,
    })),
  );
}

export function buildAdvisorCategoryBudgetsMap(
  categories: readonly Category[],
  budgets: readonly Budget[],
  refMonth: string,
): Map<string, number> {
  const limitsByCategory = budgetLimitsByCategory(budgets);
  const map = new Map<string, number>();
  for (const cat of categories) {
    const limitCents = resolveEffectiveLimit(limitsByCategory.get(cat.id) ?? [], refMonth);
    if (limitCents > 0) {
      map.set(cat.id, limitCents);
    }
  }
  return map;
}

export function computeMonthlyAdvisorTotalCents(
  preloadedItems: ReadonlyArray<{ month?: string; valueCents: number }> | undefined,
  refMonth: string,
  rawMonthItems: ReadonlyArray<{ value: number; report_weight?: number | null }> | undefined,
): number {
  if (preloadedItems) {
    return preloadedItems
      .filter((item) => item.month === refMonth)
      .reduce((sum, item) => sum + item.valueCents, 0);
  }
  return sumGrossCents(
    (rawMonthItems ?? []).map((item) => ({
      value: item.value,
      report_weight: item.report_weight ?? 1,
    })),
  );
}

export function computeEffectiveAdvisorSurplusCents(params: {
  savingsSurplusCents?: number;
  monthlyIncomeCents: number;
  monthlyExpensesCents: number;
  committedObligationsCents?: number;
  safeToSpendCents?: number;
  currentMonthAportesCents?: number;
}): number {
  if (params.savingsSurplusCents !== undefined) {
    return params.savingsSurplusCents;
  }
  return calculateSurplusCapacity({
    incomeCents: params.monthlyIncomeCents,
    expenseCents: params.monthlyExpensesCents,
    openInvoicesCents: params.committedObligationsCents,
    safeToSpendCents: params.safeToSpendCents,
    contributionsAlreadyMadeCents: params.currentMonthAportesCents,
  }).suggestedAporteCents;
}

export interface EvaluateSmartAdvisorParams {
  allExpenses: readonly ExpenseLike[];
  allIncomes: readonly IncomeLike[];
  refMonth: string;
  todayISO: string;
  monthlyIncomeCents: number;
  categoryBudgetsMap: ReadonlyMap<string, number>;
  feedbackMap: FeedbackMap;
  month0Incomes: ReadonlyArray<{ category_id: string; value: number; report_weight?: number }>;
  cards: readonly CardForAdvisorContext[];
  household: FamilyConsolidationResult | null;
  incomeGoals: readonly IncomeGoal[];
  currentUserId?: string;
  effectiveSurplusCents: number;
  plannedAporteCents?: number;
  currentMonthAportesCents?: number;
  effectiveSafeToSpendCents?: number;
  effectiveCommittedObligationsCents?: number;
  spendingHabits?: readonly SpendingHabit[];
  effectiveDismissals: Record<string, number>;
  effectiveLastDismissedDay?: string | null;
  nowMs: number;
}

export function evaluateSmartAdvisorInsights(params: EvaluateSmartAdvisorParams): {
  allCandidates: SmartAdvisorInsight[];
  eligibleInsights: SmartAdvisorInsight[];
} {
  const minRecentMonth = shiftMonth(params.refMonth, -3);
  const recentExpenses = params.allExpenses.filter((e) => {
    const m = e.date ? e.date.slice(0, 7) : e.month;
    return m >= minRecentMonth;
  });

  const occurrences = detectRecurrences(recentExpenses, {
    todayISO: params.todayISO,
    monthlyIncomeCents: params.monthlyIncomeCents,
    categoryBudgets: new Map(params.categoryBudgetsMap),
    feedbackMap: params.feedbackMap,
  });

  const incomeOccurrences = detectIncomeRecurrences(params.allIncomes, {
    todayISO: params.todayISO,
  });

  const realizedIncomeByCategory = realizedByCategoryMap(
    params.month0Incomes.map((i) => ({
      category_id: i.category_id,
      value: i.value,
      report_weight: i.report_weight ?? 1,
    })),
  );

  const candidates = generateSmartAdvisorInsights({
    occurrences,
    incomes: incomeOccurrences,
    feedbackMap: params.feedbackMap,
    todayISO: params.todayISO,
    savingsSurplusCents: params.effectiveSurplusCents,
    plannedAporteCents: params.plannedAporteCents,
    currentMonthAportesCents: params.currentMonthAportesCents,
    allExpenses: params.allExpenses,
    cards: params.cards,
    household: params.household,
    incomeGoals: params.incomeGoals,
    realizedIncomeByCategory,
    currentUserId: params.currentUserId,
    safeToSpendCents: params.effectiveSafeToSpendCents,
    committedObligationsCents: params.effectiveCommittedObligationsCents,
    spendingHabits: params.spendingHabits,
  });

  const eligible = filterAndRankAllAdvisorInsights(candidates, {
    dismissals: params.effectiveDismissals,
    lastDismissedDay: params.effectiveLastDismissedDay ?? undefined,
    currentDayISO: params.todayISO,
    nowMs: params.nowMs,
  });

  return { allCandidates: candidates, eligibleInsights: eligible };
}

export interface IgnoreRecurrenceFeedbackSpec {
  sensory: "success" | "action";
  title: string;
  description: string;
  variant: "success" | "info" | "default";
}

export function resolveIgnoreRecurrenceToast(
  reason: QualifiedDismissReason | "ignore",
): IgnoreRecurrenceFeedbackSpec {
  if (reason === "already_cancelled") {
    return {
      sensory: "success",
      title: "Assinatura cancelada celebrada",
      description: "Economia celebrada e removida dos custos fixos ativos.",
      variant: "success",
    };
  }
  if (reason === "not_subscription") {
    return {
      sensory: "action",
      title: "Despesa reclassificada",
      description: "Probabilidade de recorrência deste fornecedor rebaixada no motor.",
      variant: "info",
    };
  }
  if (reason === "one_off") {
    return {
      sensory: "action",
      title: "Despesa pontual silenciada",
      description: "Esta despesa foi silenciada neste ciclo.",
      variant: "default",
    };
  }
  return {
    sensory: "action",
    title: "Gasto ignorado",
    description: "Esta despesa não será mais sugerida como recorrente.",
    variant: "default",
  };
}

export function buildAdvisorConfirmIncomeInput(
  payload: { name: string; valueCents: number; categoryId: string; date?: string },
  todayISO: string,
) {
  return {
    description: payload.name,
    value: payload.valueCents / 100,
    category_id: payload.categoryId,
    date: payload.date ?? todayISO,
    receive_type: "pix" as const,
    report_weight: 1,
    source_ref: null,
  };
}

export function buildAdvisorConfirmExpenseInput(
  payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
  },
  todayISO: string,
) {
  const value = payload.valueCents / 100;
  const targetDate = payload.date ?? todayISO;
  return {
    value,
    date: targetDate,
    categoryId: payload.categoryId,
    paymentMethod: payload.forma ?? (payload.cardId ? "credit_card" : "pix"),
    cardId: payload.cardId ?? null,
    description: payload.name,
    reportWeight: 1,
    installments: [
      {
        date: targetDate,
        value,
        billCompetence: null,
      },
    ],
  };
}
