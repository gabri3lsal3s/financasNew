import { budgetLimitsByCategory, realizedByCategoryMap, resolveEffectiveLimit } from "@/domain/budgets";
import { numberToCents, sumGrossCents } from "@/domain/money";
import { calculateSurplusCapacity } from "@/domain/overview";
import { shiftMonth } from "@/lib/date";
import { formatCentsAsCurrency } from "@/services/masks/money";
import type { Budget, Category, ChargeKind, FamilyConsolidationResult, IncomeGoal } from "@/types";
import type { InsightThemeFamily, SmartDecayRecord } from "./attention-budget";
import type { UserFinancialContext } from "./financial-context";
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
  trip_id?: string | null;
  charge_kind?: ChargeKind | null;
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
  source_ref?: string | null;
}

export function mergeAndFilterValidDismissals(
  storeDismissals: Record<string, number>,
  cloudDismissals: Record<string, number> | undefined,
  nowMs: number,
  hasLocalOverride: boolean,
  localDismissals?: Record<string, number>,
): Record<string, number> {
  if (hasLocalOverride && localDismissals !== undefined) return localDismissals;
  const merged: Record<string, number> = {};
  for (const source of [storeDismissals, cloudDismissals ?? {}]) {
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "number" && v > nowMs) {
        merged[k] = merged[k] !== undefined ? Math.max(merged[k], v) : v;
      }
    }
  }
  return merged;
}

/**
 * Mescla o mapa persistido de dispensas do SmartAdvisor (`advisorDismissals`),
 * suportando limpeza total (`patch === {}`), revogação pontual (valor <= nowMs, ex.: 0)
 * e poda automática de cooldowns expirados.
 */
export function mergePersistedAdvisorDismissals(
  current: Record<string, number> | undefined,
  patch: Record<string, number> | undefined,
  nowMs: number = Date.now(),
): Record<string, number> | undefined {
  if (patch === undefined) {
    return current;
  }
  if (Object.keys(patch).length === 0) {
    return {};
  }
  const merged = { ...(current ?? {}), ...patch };
  const valid: Record<string, number> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "number" && Number.isFinite(v) && v > nowMs) {
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
      ...(e.trip_id != null ? { tripId: e.trip_id } : {}),
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
      ...(i.source_ref != null ? { sourceRef: i.source_ref } : {}),
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
  categories?: readonly Category[];
  suppressedThemeKeys?: readonly string[];
  financialContext?: UserFinancialContext;
  budgetedCategoryLimits?: ReadonlyMap<string, number>;
  isEmergencyFundComplete?: boolean;
  monthlySettledDividendsCents?: number;
  historicalVariableMedianCents?: number;
  oneOffExpenseIds?: ReadonlySet<string>;
  decayByFamily?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
}

export interface CardChargesDrainResult {
  hasDrain: boolean;
  totalInterestCents: number;
  totalFineCents: number;
  totalDrainCents: number;
  chargeCount: number;
  insight: SmartAdvisorInsight | null;
}

/**
 * Radar Anti-Juros (Fase 1 do Blueprint v2.1):
 * Identifica acúmulo de encargos financeiros (juros e multas de cartão) e gera alerta
 * acionável direcionando para liquidação integral da fatura.
 */
export type ChargeDrainExpenseCandidate = {
  value?: number;
  valueCents?: number;
  charge_kind?: string | null;
  chargeKind?: string | null;
};

export function detectCardChargesDrain(
  expenses: readonly ChargeDrainExpenseCandidate[],
  thresholdCents = 2000,
): CardChargesDrainResult {
  let totalInterestCents = 0;
  let totalFineCents = 0;
  let chargeCount = 0;

  for (const exp of expenses) {
    const cents =
      typeof exp.valueCents === "number"
        ? exp.valueCents
        : typeof exp.value === "number"
          ? numberToCents(exp.value)
          : 0;
    const kind = exp.charge_kind ?? exp.chargeKind;
    if (kind === "interest") {
      totalInterestCents += cents;
      chargeCount += 1;
    } else if (kind === "fine") {
      totalFineCents += cents;
      chargeCount += 1;
    }
  }

  const totalDrainCents = totalInterestCents + totalFineCents;
  const hasDrain = totalDrainCents >= thresholdCents;

  if (!hasDrain) {
    return {
      hasDrain: false,
      totalInterestCents,
      totalFineCents,
      totalDrainCents,
      chargeCount,
      insight: null,
    };
  }

  const formattedDrain = formatCentsAsCurrency(totalDrainCents);
  const insight: SmartAdvisorInsight = {
    id: "advisor-charges-drain",
    themeKey: "charges:drain",
    priority: totalDrainCents >= 10000 ? 1 : 3,
    category: totalDrainCents >= 10000 ? "critical" : "savings",
    title: "Dreno de Juros e Multas Detectado",
    description: `Foram identificados ${formattedDrain} em juros e multas de cartão. Quitar a fatura integralmente estanca o vazamento financeiro.`,
    iconName: totalDrainCents >= 10000 ? "alert-triangle" : "trending-down",
    primaryAction: {
      label: "Ver Faturas",
      kind: "navigate_cards",
    },
    secondaryAction: {
      label: "Ignorar",
      kind: "dismiss",
    },
    metadata: {
      valueCents: totalDrainCents,
      annualSavingsCents: totalDrainCents * 12,
    },
  };

  return {
    hasDrain: true,
    totalInterestCents,
    totalFineCents,
    totalDrainCents,
    chargeCount,
    insight,
  };
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
    merchantAliasMap: params.financialContext?.learning.merchantAliasMap,
    learnedServices: params.financialContext?.learning.learnedServices,
  });

  const incomeOccurrences = detectIncomeRecurrences(params.allIncomes, {
    todayISO: params.todayISO,
    merchantAliasMap: params.financialContext?.learning.merchantAliasMap,
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
    categories: params.categories,
    financialContext: params.financialContext,
    budgetedCategoryLimits: params.budgetedCategoryLimits ?? params.categoryBudgetsMap,
    isEmergencyFundComplete: params.isEmergencyFundComplete,
    monthlySettledDividendsCents: params.monthlySettledDividendsCents,
    historicalVariableMedianCents: params.historicalVariableMedianCents,
    oneOffExpenseIds: params.oneOffExpenseIds,
  });

  const chargesDrain = detectCardChargesDrain(params.allExpenses ?? []);
  if (chargesDrain.insight) {
    candidates.push(chargesDrain.insight);
  }

  const activeCandidates =
    params.suppressedThemeKeys && params.suppressedThemeKeys.length > 0
      ? candidates.filter(
          (c) =>
            !params.suppressedThemeKeys!.some(
              (k) => c.themeKey === k || c.themeKey.startsWith(`${k}:`),
            ),
        )
      : candidates;

  const eligible = filterAndRankAllAdvisorInsights(activeCandidates, {
    dismissals: params.effectiveDismissals,
    lastDismissedDay: params.effectiveLastDismissedDay ?? undefined,
    currentDayISO: params.todayISO,
    nowMs: params.nowMs,
    decayByFamily: params.decayByFamily ?? params.financialContext?.learning.decayByFamily,
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
