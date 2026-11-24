import { useCallback, useMemo, useState } from "react";
import type { SpendingHabit } from "@/domain/insights";
import {
  DEFAULT_DISMISS_DAYS,
  type CardForAdvisorContext,
  type SmartAdvisorInsight,
} from "@/domain/insights/advisor";
import type { FeedbackMap, QualifiedDismissReason } from "@/domain/insights/feedback";
import type { ExpenseLike, IncomeLike } from "@/domain/insights/recurrences";
import {
  computeEffectiveAdvisorSurplusCents,
  evaluateSmartAdvisorInsights,
} from "@/domain/insights/smart-advisor-rules";
import type { InsightThemeFamily, SmartDecayRecord } from "@/domain/insights/attention-budget";
import type { UserFinancialContext } from "@/domain/insights/financial-context";
import { currentMonth, todayLocalIso } from "@/lib/date";
import * as stateSelectors from "@/state/selectors";
import type { Budget, Category } from "@/types";
import {
  type SmartAdvisorActionSensoryOptions,
  useSmartAdvisorActions,
} from "./use-smart-advisor-actions";
import {
  resetSmartAdvisorCooldowns,
  revokeSmartAdvisorDismissal,
  useSmartAdvisorCooldownController,
  useSmartAdvisorDismissals,
} from "./use-smart-advisor-dismissals";
import { useSmartAdvisorQueries } from "./use-smart-advisor-queries";

export { resetSmartAdvisorCooldowns, revokeSmartAdvisorDismissal, useSmartAdvisorDismissals };

export interface UseSmartAdvisorInsightsOptions {
  month?: string;
  todayISO?: string;
  nowMs?: number;
  expenses?: readonly ExpenseLike[];
  incomes?: readonly IncomeLike[];
  categories?: readonly Category[];
  budgets?: readonly Budget[];
  feedbackMap?: FeedbackMap;
  initialDismissals?: Record<string, number>;
  initialLastDismissedDay?: string;
  enabled?: boolean;
  savingsSurplusCents?: number;
  plannedAporteCents?: number;
  currentMonthAportesCents?: number;
  cards?: readonly CardForAdvisorContext[];
  safeToSpendCents?: number;
  committedObligationsCents?: number;
  spendingHabits?: readonly SpendingHabit[];
  suppressedThemeKeys?: readonly string[];
  financialContext?: UserFinancialContext;
  isFinancialContextLoading?: boolean;
}

export interface UseSmartAdvisorInsightsResult {
  insight: SmartAdvisorInsight | null;
  insights: SmartAdvisorInsight[];
  currentIndex: number;
  totalCount: number;
  nextInsight: () => void;
  prevInsight: () => void;
  goToInsight: (index: number) => void;
  allCandidates: SmartAdvisorInsight[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  dismiss: (themeKey?: string, days?: number, options?: { isResolution?: boolean }) => void;
  confirmRecurrence: (occurrenceKey: string) => Promise<void>;
  ignoreRecurrence: (
    occurrenceKey: string,
    reason?: QualifiedDismissReason | "ignore",
    options?: SmartAdvisorActionSensoryOptions,
  ) => Promise<void>;
  confirmIncome: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => Promise<void>;
  markAsEssential: (
    occurrenceKey: string,
    displayName?: string,
    options?: SmartAdvisorActionSensoryOptions,
  ) => Promise<void>;
  markTxOneOff: (occurrenceKey: string, displayName?: string) => Promise<void>;
  muteFamily: (themeKey: string) => void;
  decayByFamily: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
  confirmExpense: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
  }) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook unificado do Assistente Proativo de Insights (SmartAdvisor).
 */
export function useSmartAdvisorInsights(
  options: UseSmartAdvisorInsightsOptions = {},
): UseSmartAdvisorInsightsResult {
  const refMonth = options.month ?? currentMonth();
  const todayISOStr = options.todayISO ?? todayLocalIso();
  const [defaultNowMs] = useState(() => Date.now());
  const nowMs = options.nowMs ?? defaultNowMs;
  const queryEnabled = options.enabled ?? (options.expenses == null || options.incomes == null);

  const queries = useSmartAdvisorQueries({
    refMonth,
    todayISOStr,
    queryEnabled,
    preloadedExpenses: options.expenses,
    preloadedIncomes: options.incomes,
    preloadedCategories: options.categories,
    preloadedBudgets: options.budgets,
    preloadedFeedbackMap: options.feedbackMap,
    preloadedCards: options.cards,
    safeToSpendCents: options.safeToSpendCents,
    committedObligationsCents: options.committedObligationsCents,
  });

  let useUserFinancialContextSafe: (
    opts: Parameters<typeof stateSelectors.useUserFinancialContext>[0],
  ) => ReturnType<typeof stateSelectors.useUserFinancialContext> | undefined = () => undefined;
  try {
    const candidate = (stateSelectors as Record<string, unknown>).useUserFinancialContext;
    if (typeof candidate === "function") {
      useUserFinancialContextSafe = candidate as typeof stateSelectors.useUserFinancialContext;
    }
  } catch {
    // Suporta mocks parciais do Vitest
  }
  const userFinancialContextResult = useUserFinancialContextSafe({
    month: refMonth,
    todayISO: todayISOStr,
    enabled: queryEnabled && options.financialContext === undefined,
  });
  const effectiveFinancialContext: UserFinancialContext | undefined =
    options.financialContext ?? (queryEnabled ? userFinancialContextResult?.context : undefined);
  const effectiveFinancialContextLoading =
    options.isFinancialContextLoading ??
    (queryEnabled && options.financialContext === undefined
      ? Boolean(userFinancialContextResult?.isLoading)
      : false);

  const cooldown = useSmartAdvisorCooldownController({
    initialDismissals: options.initialDismissals,
    initialLastDismissedDay: options.initialLastDismissedDay,
    cloudDismissals: queries.cloudDismissals,
    cloudLastDismissedDay: queries.cloudLastDismissedDay,
    cloudDecayMeta: queries.cloudDecayMeta,
    nowMs,
    todayISOStr,
    onPersistCloudDismissal: (payload) => queries.updateCustomSettingsMutation.mutate(payload),
  });

  const effectiveSurplusCents = useMemo(
    () =>
      computeEffectiveAdvisorSurplusCents({
        savingsSurplusCents: options.savingsSurplusCents,
        monthlyIncomeCents: queries.monthlyIncomeCents,
        monthlyExpensesCents: queries.monthlyExpensesCents,
        committedObligationsCents: queries.effectiveCommittedObligationsCents,
        safeToSpendCents: queries.effectiveSafeToSpendCents,
        currentMonthAportesCents: options.currentMonthAportesCents,
      }),
    [
      options.savingsSurplusCents,
      queries.monthlyIncomeCents,
      queries.monthlyExpensesCents,
      queries.effectiveCommittedObligationsCents,
      queries.effectiveSafeToSpendCents,
      options.currentMonthAportesCents,
    ],
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  const { allCandidates, eligibleInsights } = useMemo(() => {
    if (options.enabled === false) {
      return { allCandidates: [], eligibleInsights: [] };
    }
    if (queries.isWaitingQueries || effectiveFinancialContextLoading) {
      return { allCandidates: [], eligibleInsights: [] };
    }
    return evaluateSmartAdvisorInsights({
      allExpenses: queries.allExpenses,
      allIncomes: queries.allIncomes,
      refMonth,
      todayISO: todayISOStr,
      monthlyIncomeCents: queries.monthlyIncomeCents,
      categoryBudgetsMap: queries.categoryBudgetsMap,
      feedbackMap: queries.feedbackMap,
      month0Incomes: queries.month0Incomes,
      cards: queries.cards,
      household: queries.household,
      incomeGoals: queries.incomeGoals,
      currentUserId: queries.currentUserId,
      effectiveSurplusCents,
      plannedAporteCents: options.plannedAporteCents,
      currentMonthAportesCents: options.currentMonthAportesCents,
      effectiveSafeToSpendCents: queries.effectiveSafeToSpendCents,
      effectiveCommittedObligationsCents: queries.effectiveCommittedObligationsCents,
      spendingHabits: options.spendingHabits,
      effectiveDismissals: cooldown.effectiveDismissals,
      effectiveLastDismissedDay: cooldown.effectiveLastDismissedDay,
      nowMs,
      categories: queries.categories,
      suppressedThemeKeys: options.suppressedThemeKeys,
      financialContext: effectiveFinancialContext,
      decayByFamily: cooldown.effectiveDecayMeta,
    });
  }, [
    options.enabled,
    queries,
    effectiveFinancialContextLoading,
    refMonth,
    todayISOStr,
    effectiveSurplusCents,
    options.plannedAporteCents,
    options.currentMonthAportesCents,
    options.spendingHabits,
    options.suppressedThemeKeys,
    cooldown.effectiveDismissals,
    cooldown.effectiveLastDismissedDay,
    cooldown.effectiveDecayMeta,
    effectiveFinancialContext,
    nowMs,
  ]);

  const totalCount = eligibleInsights.length;
  const safeIndex = totalCount > 0 ? Math.min(currentIndex, totalCount - 1) : 0;
  const activeInsight = eligibleInsights[safeIndex] ?? null;

  const nextInsight = useCallback(() => {
    if (totalCount > 1) setCurrentIndex((prev) => (prev + 1) % totalCount);
  }, [totalCount]);
  const prevInsight = useCallback(() => {
    if (totalCount > 1) setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
  }, [totalCount]);
  const goToInsight = useCallback(
    (index: number) => {
      if (totalCount > 0) setCurrentIndex(Math.max(0, Math.min(index, totalCount - 1)));
    },
    [totalCount],
  );

  const dismiss = useCallback(
    (themeKey?: string, days = DEFAULT_DISMISS_DAYS, dismissOptions?: { isResolution?: boolean }) => {
      cooldown.dismissInsight(
        eligibleInsights,
        activeInsight?.themeKey,
        themeKey,
        days,
        dismissOptions,
      );
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
    },
    [cooldown, eligibleInsights, activeInsight?.themeKey],
  );

  const actions = useSmartAdvisorActions({
    todayISOStr,
    activeThemeKey: activeInsight?.themeKey,
    dismiss,
  });

  return {
    insight: activeInsight,
    insights: eligibleInsights,
    currentIndex: safeIndex,
    totalCount,
    nextInsight,
    prevInsight,
    goToInsight,
    allCandidates,
    isLoading:
      options.enabled === false ? false : queries.isWaitingQueries || effectiveFinancialContextLoading,
    isError: queries.isError,
    error: queries.error,
    dismiss,
    muteFamily: cooldown.muteFamily,
    decayByFamily: cooldown.effectiveDecayMeta,
    ...actions,
    refetch: queries.refetch,
  };
}
