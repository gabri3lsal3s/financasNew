import { useCallback, useEffect, useMemo } from "react";
import type { CardForAdvisorContext } from "@/domain/insights/advisor";
import type { FeedbackMap } from "@/domain/insights/feedback";
import type { ExpenseLike, IncomeLike } from "@/domain/insights/recurrences";
import {
  buildAdvisorCategoryBudgetsMap,
  computeMonthlyAdvisorTotalCents,
  mapRawExpensesToAdvisorLikes,
  mapRawIncomesToAdvisorLikes,
} from "@/domain/insights/smart-advisor-rules";
import { currentMonth, shiftMonth } from "@/lib/date";
import { subscribeInsightsReevaluation } from "@/services/merchant-learning";
import {
  useBudgets,
  useCategories,
  useCreditCards,
  useExpenses,
  useFamilyConsolidation,
  useFamilyMode,
  useFeedback,
  useIncomeGoals,
  useIncomes,
  useMyFamily,
  useRealCashBalance,
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import type { Budget, Category } from "@/types";

interface UseSmartAdvisorQueriesParams {
  refMonth: string;
  todayISOStr: string;
  queryEnabled: boolean;
  preloadedExpenses?: readonly ExpenseLike[];
  preloadedIncomes?: readonly IncomeLike[];
  preloadedCategories?: readonly Category[];
  preloadedBudgets?: readonly Budget[];
  preloadedFeedbackMap?: FeedbackMap;
  preloadedCards?: readonly CardForAdvisorContext[];
  safeToSpendCents?: number;
  committedObligationsCents?: number;
}

/**
 * Orquestra consultas TanStack, mapeamentos históricos e estados de carregamento
 * consumidos pelo SmartAdvisor.
 */
export function useSmartAdvisorQueries({
  refMonth,
  todayISOStr,
  queryEnabled,
  preloadedExpenses,
  preloadedIncomes,
  preloadedCategories,
  preloadedBudgets,
  preloadedFeedbackMap,
  preloadedCards,
  safeToSpendCents,
  committedObligationsCents,
}: UseSmartAdvisorQueriesParams) {
  const month0Expenses = useExpenses(refMonth, { enabled: queryEnabled });
  const month1Expenses = useExpenses(shiftMonth(refMonth, -1), { enabled: queryEnabled });
  const month2Expenses = useExpenses(shiftMonth(refMonth, -2), { enabled: queryEnabled });
  const month3Expenses = useExpenses(shiftMonth(refMonth, -3), { enabled: queryEnabled });
  const month11Expenses = useExpenses(shiftMonth(refMonth, -11), { enabled: queryEnabled });
  const month12Expenses = useExpenses(shiftMonth(refMonth, -12), { enabled: queryEnabled });
  const month0Incomes = useIncomes(refMonth, { enabled: queryEnabled });
  const month1Incomes = useIncomes(shiftMonth(refMonth, -1), { enabled: queryEnabled });
  const month2Incomes = useIncomes(shiftMonth(refMonth, -2), { enabled: queryEnabled });
  const month3Incomes = useIncomes(shiftMonth(refMonth, -3), { enabled: queryEnabled });

  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const feedbackQuery = useFeedback();
  const creditCardsQuery = useCreditCards({ enabled: queryEnabled });
  const isCurrentMonth = refMonth === currentMonth();
  const realCashData = useRealCashBalance(isCurrentMonth ? todayISOStr : `${refMonth}-01`);

  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily();
  const hasFamily = Boolean(isFamilyModeEnabled && myFamilyQuery.data?.family);
  const familyConsolidationQuery = useFamilyConsolidation(refMonth, { enabled: hasFamily });
  const incomeGoalsQuery = useIncomeGoals();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const categories = useMemo(
    () => preloadedCategories ?? categoriesQuery.data ?? [],
    [preloadedCategories, categoriesQuery.data],
  );
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cards = useMemo<readonly CardForAdvisorContext[]>(
    () => preloadedCards ?? creditCardsQuery.data ?? [],
    [preloadedCards, creditCardsQuery.data],
  );

  const m0Exp = month0Expenses.data;
  const m1Exp = month1Expenses.data;
  const m2Exp = month2Expenses.data;
  const m3Exp = month3Expenses.data;
  const m11Exp = month11Expenses.data;
  const m12Exp = month12Expenses.data;
  const allExpenses = useMemo<readonly ExpenseLike[]>(
    () =>
      preloadedExpenses ??
      mapRawExpensesToAdvisorLikes(
        [
          { data: m0Exp, month: refMonth },
          { data: m1Exp, month: shiftMonth(refMonth, -1) },
          { data: m2Exp, month: shiftMonth(refMonth, -2) },
          { data: m3Exp, month: shiftMonth(refMonth, -3) },
          { data: m11Exp, month: shiftMonth(refMonth, -11) },
          { data: m12Exp, month: shiftMonth(refMonth, -12) },
        ],
        categoryById,
      ),
    [preloadedExpenses, m0Exp, m1Exp, m2Exp, m3Exp, m11Exp, m12Exp, refMonth, categoryById],
  );

  const m0Inc = month0Incomes.data;
  const m1Inc = month1Incomes.data;
  const m2Inc = month2Incomes.data;
  const m3Inc = month3Incomes.data;
  const allIncomes = useMemo<readonly IncomeLike[]>(
    () =>
      preloadedIncomes ??
      mapRawIncomesToAdvisorLikes([m0Inc, m1Inc, m2Inc, m3Inc], refMonth, categoryById),
    [preloadedIncomes, m0Inc, m1Inc, m2Inc, m3Inc, refMonth, categoryById],
  );

  const budgets = useMemo(
    () => preloadedBudgets ?? budgetsQuery.data ?? [],
    [preloadedBudgets, budgetsQuery.data],
  );
  const categoryBudgetsMap = useMemo(
    () => buildAdvisorCategoryBudgetsMap(categories, budgets, refMonth),
    [budgets, categories, refMonth],
  );
  const monthlyIncomeCents = useMemo(
    () => computeMonthlyAdvisorTotalCents(preloadedIncomes, refMonth, m0Inc),
    [preloadedIncomes, refMonth, m0Inc],
  );
  const monthlyExpensesCents = useMemo(
    () => computeMonthlyAdvisorTotalCents(preloadedExpenses, refMonth, m0Exp),
    [preloadedExpenses, refMonth, m0Exp],
  );

  const feedbackMap: FeedbackMap = useMemo(
    () => preloadedFeedbackMap ?? ((feedbackQuery.data ?? {}) as FeedbackMap),
    [preloadedFeedbackMap, feedbackQuery.data],
  );

  const isWaitingQueries =
    queryEnabled &&
    (feedbackQuery.isLoading ||
      categoriesQuery.isLoading ||
      month0Expenses.isLoading ||
      (isCurrentMonth && realCashData.isLoading));

  const isLoading =
    queryEnabled &&
    (month0Expenses.isLoading || month1Expenses.isLoading || month2Expenses.isLoading ||
      month3Expenses.isLoading || month11Expenses.isLoading || month12Expenses.isLoading ||
      month0Incomes.isLoading || month1Incomes.isLoading || month2Incomes.isLoading ||
      month3Incomes.isLoading || budgetsQuery.isLoading || categoriesQuery.isLoading ||
      feedbackQuery.isLoading);

  const isError =
    queryEnabled &&
    (month0Expenses.isError || month1Expenses.isError || month2Expenses.isError ||
      month3Expenses.isError || month11Expenses.isError || month12Expenses.isError ||
      month0Incomes.isError || month1Incomes.isError || month2Incomes.isError ||
      month3Incomes.isError || budgetsQuery.isError || categoriesQuery.isError ||
      feedbackQuery.isError);

  const error =
    month0Expenses.error ?? month1Expenses.error ?? month2Expenses.error ?? month3Expenses.error ??
    month0Incomes.error ?? month1Incomes.error ?? month2Incomes.error ?? month3Incomes.error ??
    budgetsQuery.error ?? categoriesQuery.error ?? feedbackQuery.error ?? null;

  const refetch = useCallback(async () => {
    await Promise.all([
      month0Expenses.refetch(), month1Expenses.refetch(), month2Expenses.refetch(),
      month3Expenses.refetch(), month0Incomes.refetch(), month1Incomes.refetch(),
      month2Incomes.refetch(), month3Incomes.refetch(), budgetsQuery.refetch(),
      categoriesQuery.refetch(), feedbackQuery.refetch(),
    ]);
  }, [
    month0Expenses, month1Expenses, month2Expenses, month3Expenses,
    month0Incomes, month1Incomes, month2Incomes, month3Incomes,
    budgetsQuery, categoriesQuery, feedbackQuery,
  ]);

  useEffect(() => subscribeInsightsReevaluation(() => void refetch()), [refetch]);

  return {
    effectiveSafeToSpendCents:
      safeToSpendCents ?? (queryEnabled ? realCashData.safeToSpend.safeToSpendCents : undefined),
    effectiveCommittedObligationsCents:
      committedObligationsCents ??
      (queryEnabled ? realCashData.safeToSpend.committedObligationsCents : undefined),
    cloudDismissals: userPreferencesQuery.data?.custom_settings?.advisorDismissals,
    cloudLastDismissedDay: userPreferencesQuery.data?.custom_settings?.advisorLastDismissedDay,
    updateCustomSettingsMutation,
    allExpenses,
    allIncomes,
    categoryBudgetsMap,
    monthlyIncomeCents,
    monthlyExpensesCents,
    feedbackMap,
    month0Incomes: m0Inc ?? [],
    cards,
    categories,
    household: hasFamily ? familyConsolidationQuery.data ?? null : null,
    incomeGoals: (incomeGoalsQuery.data ?? []).filter((g) => g.month === refMonth),
    currentUserId: myFamilyQuery.data?.currentMember?.user_id,
    isWaitingQueries,
    isLoading,
    isError,
    error,
    refetch,
  };
}
