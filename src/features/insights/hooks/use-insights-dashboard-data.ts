import { useCallback, useMemo } from "react";
import {
  filterCardsByViewScope,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { buildMonthlyClosingSummary, unmuteInsightFamily, type InsightThemeFamily } from "@/domain/insights";
import { buildInsightsDashboard } from "@/domain/insights/build-insights-dashboard";
import type { FeedbackDecision, FeedbackMap } from "@/domain/insights/feedback";
import { sumGrossCents } from "@/domain/money";
import { useSafeViewScope } from "@/hooks/use-safe-business-scope";
import { currentMonth, shiftMonth } from "@/lib/date";
import { pushToast } from "@/services/toast";
import * as stateHooks from "@/state";
import {
  useBudgets,
  useCategories,
  useCreditCards,
  useDebts,
  useEmergencyFundComposition,
  useExpenses,
  useFamilyConsolidation,
  useFamilyMode,
  useFeedback,
  useIncomes,
  useMyFamily,
  usePortfolioPosition,
  useRealCashBalance,
  useSetFeedback,
} from "@/state";

function getOptionalStateHook<T>(name: string, fallback: () => T): () => T {
  try {
    const fn = (stateHooks as Record<string, unknown>)[name];
    if (typeof fn === "function") return fn as () => T;
  } catch {
    // Suporta mocks parciais do Vitest
  }
  return fallback;
}

export function useInsightsDashboardData() {
  const month = currentMonth();
  const useRecurrencesSafe = getOptionalStateHook("useRecurrences", () => ({
    data: [] as ReturnType<typeof stateHooks.useRecurrences>["data"],
    isLoading: false,
    error: null,
  }));
  const useFeedbackEntriesSafe = getOptionalStateHook("useFeedbackEntries", () => ({
    data: undefined as ReturnType<typeof stateHooks.useFeedbackEntries>["data"],
    isLoading: false,
    error: null,
  }));
  const useUserPreferencesSafe = getOptionalStateHook("useUserPreferences", () => ({
    data: null as ReturnType<typeof stateHooks.useUserPreferences>["data"],
    isLoading: false,
    error: null,
  }));
  const useUpdateCustomSettingsSafe = getOptionalStateHook("useUpdateCustomSettings", () => ({
    mutate: (() => undefined) as ReturnType<typeof stateHooks.useUpdateCustomSettings>["mutate"],
    mutateAsync: (async () => ({})) as unknown as ReturnType<typeof stateHooks.useUpdateCustomSettings>["mutateAsync"],
  }));
  const useSetBudgetLimitSafe = getOptionalStateHook("useSetBudgetLimit", () => ({
    mutateAsync: (async () => ({})) as unknown as ReturnType<typeof stateHooks.useSetBudgetLimit>["mutateAsync"],
  }));

  const month0 = useExpenses(month);
  const month1 = useExpenses(shiftMonth(month, -1));
  const month2 = useExpenses(shiftMonth(month, -2));
  const month3 = useExpenses(shiftMonth(month, -3));
  const incomesQuery = useIncomes(month);
  const prevIncomesQuery = useIncomes(shiftMonth(month, -1));
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards();
  const debtsQuery = useDebts();
  const recurrencesQuery = useRecurrencesSafe();
  const feedbackQuery = useFeedback();
  const feedbackEntriesQuery = useFeedbackEntriesSafe();
  const preferencesQuery = useUserPreferencesSafe();
  const updateCustomSettings = useUpdateCustomSettingsSafe();
  const setBudgetLimit = useSetBudgetLimitSafe();
  const setFeedback = useSetFeedback();
  const position = usePortfolioPosition();
  const realCashQuery = useRealCashBalance();

  const { effectiveViewScope } = useSafeViewScope();
  const scopedMonth0 = useMemo(
    () => filterExpensesByViewScope(month0.data ?? [], effectiveViewScope, { mode: "dre" }),
    [month0.data, effectiveViewScope],
  );
  const scopedMonth1 = useMemo(
    () => filterExpensesByViewScope(month1.data ?? [], effectiveViewScope, { mode: "dre" }),
    [month1.data, effectiveViewScope],
  );
  const scopedMonth2 = useMemo(
    () => filterExpensesByViewScope(month2.data ?? [], effectiveViewScope, { mode: "dre" }),
    [month2.data, effectiveViewScope],
  );
  const scopedMonth3 = useMemo(
    () => filterExpensesByViewScope(month3.data ?? [], effectiveViewScope, { mode: "dre" }),
    [month3.data, effectiveViewScope],
  );
  const scopedIncomes = useMemo(
    () => filterIncomesByViewScope(incomesQuery.data ?? [], effectiveViewScope, { mode: "dre" }),
    [incomesQuery.data, effectiveViewScope],
  );
  const scopedPrevIncomes = useMemo(
    () => filterIncomesByViewScope(prevIncomesQuery.data ?? [], effectiveViewScope, { mode: "dre" }),
    [prevIncomesQuery.data, effectiveViewScope],
  );
  const scopedCards = useMemo(
    () => filterCardsByViewScope(cardsQuery.data ?? [], effectiveViewScope),
    [cardsQuery.data, effectiveViewScope],
  );
  const scopedDebts = useMemo(
    () => filterDebtsByViewScope(debtsQuery.data ?? [], effectiveViewScope),
    [debtsQuery.data, effectiveViewScope],
  );

  const estimatedMonthlyExpensesCents = useMemo(() => {
    const past = [scopedMonth1, scopedMonth2, scopedMonth3]
      .map((list) => sumGrossCents(list))
      .filter((v) => v > 0);
    if (past.length > 0) {
      return Math.round(past.reduce((a, b) => a + b, 0) / past.length);
    }
    return sumGrossCents(scopedMonth0);
  }, [scopedMonth0, scopedMonth1, scopedMonth2, scopedMonth3]);

  const emergencyFund = useEmergencyFundComposition({
    monthlyExpensesCents: estimatedMonthlyExpensesCents,
  });

  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily();
  const hasFamily = Boolean(isFamilyModeEnabled && myFamilyQuery.data?.family);
  const familyConsolidationQuery = useFamilyConsolidation(month, { enabled: hasFamily });
  const householdData = hasFamily ? familyConsolidationQuery.data : null;
  const currentUserId = myFamilyQuery.data?.currentMember?.user_id;

  const loading =
    month0.isLoading ||
    month1.isLoading ||
    month2.isLoading ||
    month3.isLoading ||
    incomesQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    debtsQuery.isLoading ||
    feedbackQuery.isLoading ||
    position.isLoading ||
    realCashQuery.isLoading;

  const error =
    month0.error ??
    month1.error ??
    month2.error ??
    month3.error ??
    incomesQuery.error ??
    budgetsQuery.error ??
    categoriesQuery.error ??
    debtsQuery.error ??
    feedbackQuery.error ??
    position.error ??
    realCashQuery.error;

  const feedbackMap: FeedbackMap = useMemo(
    () => (feedbackQuery.data ?? {}) as Record<string, FeedbackDecision>,
    [feedbackQuery.data],
  );

  const dashboard = useMemo(
    () =>
      buildInsightsDashboard({
        month,
        currentCalendarMonth: currentMonth(),
        now: new Date(),
        expensesByMonth: [scopedMonth0, scopedMonth1, scopedMonth2, scopedMonth3],
        incomes: scopedIncomes,
        historicalIncomes: scopedPrevIncomes,
        budgets: budgetsQuery.data ?? [],
        categories: categoriesQuery.data ?? [],
        cards: scopedCards,
        debts: scopedDebts,
        recurrences: recurrencesQuery.data ?? [],
        feedbackMap,
        feedbackEntries: feedbackEntriesQuery.data ?? [],
        customSettings: preferencesQuery.data?.custom_settings ?? null,
        portfolioRows: position.rows ?? [],
        monthlyContributionCents: position.monthlyContributionCents,
        committedObligationsCents: realCashQuery.safeToSpend.committedObligationsCents ?? 0,
        openInvoicesCents: realCashQuery.safeToSpend.openInvoicesCents ?? 0,
        nextCycleInvoicesCents: realCashQuery.cycleBreakdown?.nextCycleInvoicesCents ?? 0,
        nextCycleInvoicesCount: realCashQuery.cycleBreakdown?.nextCycleInvoices?.length ?? 0,
        futureInvoicesCents: realCashQuery.cycleBreakdown?.futureInvoicesCents ?? 0,
        futureInvoicesCount: realCashQuery.cycleBreakdown?.futureInvoices?.length ?? 0,
        emergencyComposition: emergencyFund.composition,
        householdData,
        currentUserId,
      }),
    [
      month,
      scopedMonth0,
      scopedMonth1,
      scopedMonth2,
      scopedMonth3,
      scopedIncomes,
      scopedPrevIncomes,
      budgetsQuery.data,
      categoriesQuery.data,
      scopedCards,
      scopedDebts,
      recurrencesQuery.data,
      feedbackMap,
      feedbackEntriesQuery.data,
      preferencesQuery.data?.custom_settings,
      position.rows,
      position.monthlyContributionCents,
      realCashQuery.safeToSpend.committedObligationsCents,
      realCashQuery.safeToSpend.openInvoicesCents,
      realCashQuery.cycleBreakdown?.nextCycleInvoicesCents,
      realCashQuery.cycleBreakdown?.nextCycleInvoices?.length,
      realCashQuery.cycleBreakdown?.futureInvoicesCents,
      realCashQuery.cycleBreakdown?.futureInvoices?.length,
      emergencyFund.composition,
      householdData,
      currentUserId,
    ],
  );

  const handleFeedback = useCallback(
    (occurrenceKey: string, decision: FeedbackDecision | null) => {
      setFeedback.mutate({ occurrenceKey, decision });
    },
    [setFeedback],
  );

  const monthlyClosing = useMemo(
    () =>
      buildMonthlyClosingSummary({
        currentMonth: month,
        dayOfMonth: new Date().getDate(),
        dismissedMonth: preferencesQuery.data?.custom_settings?.monthlyClosingDismissedMonth,
        closedMonthExpenses: month1.data ?? [],
        closedMonthIncomes: prevIncomesQuery.data ?? [],
        budgets: budgetsQuery.data ?? [],
        categories: categoriesQuery.data ?? [],
      }),
    [
      month,
      preferencesQuery.data?.custom_settings?.monthlyClosingDismissedMonth,
      month1.data,
      prevIncomesQuery.data,
      budgetsQuery.data,
      categoriesQuery.data,
    ],
  );

  const dismissMonthlyClosing = useCallback(
    (closedMonth: string) => {
      updateCustomSettings.mutate({ monthlyClosingDismissedMonth: closedMonth });
    },
    [updateCustomSettings],
  );

  const applyMonthlyClosingLimit = useCallback(
    async (categoryId: string, limitCents: number, categoryName: string) => {
      await setBudgetLimit.mutateAsync({
        categoryId,
        month,
        limit: limitCents / 100,
      });
      pushToast({
        title: "Orçamento atualizado",
        description: `Novo teto aplicado para ${categoryName}.`,
        variant: "success",
      });
    },
    [setBudgetLimit, month],
  );

  const unmuteFamily = useCallback(
    (family: InsightThemeFamily) => {
      const currentMeta = preferencesQuery.data?.custom_settings?.advisorDecayMeta ?? {};
      const updated = unmuteInsightFamily(currentMeta[family]);
      updateCustomSettings.mutate({
        advisorDecayMeta: {
          ...currentMeta,
          [family]: updated,
        },
      });
      pushToast({
        title: "Tema reativado",
        description: "O copiloto voltará a exibir sugestões deste tema.",
        variant: "success",
      });
    },
    [preferencesQuery.data?.custom_settings?.advisorDecayMeta, updateCustomSettings],
  );

  const forgetMerchant = useCallback(
    (merchantKey: string) => {
      const currentMerchants = { ...(preferencesQuery.data?.custom_settings?.merchantLearning ?? {}) };
      delete currentMerchants[merchantKey];
      updateCustomSettings.mutate({ merchantLearning: currentMerchants });
      pushToast({
        title: "Estabelecimento esquecido",
        description: "A associação automática foi removida da Memória do Copiloto.",
        variant: "info",
      });
    },
    [preferencesQuery.data?.custom_settings?.merchantLearning, updateCustomSettings],
  );

  return {
    month,
    loading,
    error,
    dashboard,
    feedbackMap,
    cards: cardsQuery.data ?? [],
    emergencyFund,
    realCashCents: Math.max(0, realCashQuery.cashBalance?.currentBalanceCents ?? 0),
    handleFeedback,
    monthlyClosing,
    dismissMonthlyClosing,
    applyMonthlyClosingLimit,
    unmuteFamily,
    forgetMerchant,
    merchantLearning: (preferencesQuery.data?.custom_settings?.merchantLearning ?? null) as Readonly<
      Record<string, { alias?: string; categoryName?: string; count?: number }>
    > | null,
  };
}
