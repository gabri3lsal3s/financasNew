import { useCallback, useMemo } from "react";
import { buildInsightsDashboard } from "@/domain/insights/build-insights-dashboard";
import type { FeedbackDecision, FeedbackMap } from "@/domain/insights/feedback";
import { currentMonth, shiftMonth } from "@/lib/date";
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

export function useInsightsDashboardData() {
  const month = currentMonth();
  const emergencyFund = useEmergencyFundComposition();

  const month0 = useExpenses(month);
  const month1 = useExpenses(shiftMonth(month, -1));
  const month2 = useExpenses(shiftMonth(month, -2));
  const month3 = useExpenses(shiftMonth(month, -3));
  const incomesQuery = useIncomes(month);
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards();
  const debtsQuery = useDebts();
  const feedbackQuery = useFeedback();
  const setFeedback = useSetFeedback();
  const position = usePortfolioPosition();
  const realCashQuery = useRealCashBalance();

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
        expensesByMonth: [month0.data ?? [], month1.data ?? [], month2.data ?? [], month3.data ?? []],
        incomes: incomesQuery.data ?? [],
        budgets: budgetsQuery.data ?? [],
        categories: categoriesQuery.data ?? [],
        cards: cardsQuery.data ?? [],
        debts: debtsQuery.data ?? [],
        feedbackMap,
        portfolioRows: position.rows ?? [],
        monthlyContributionCents: position.monthlyContributionCents,
        committedObligationsCents: realCashQuery.safeToSpend.committedObligationsCents ?? 0,
        openInvoicesCents: realCashQuery.safeToSpend.openInvoicesCents ?? 0,
        emergencyComposition: emergencyFund.composition,
        householdData,
        currentUserId,
      }),
    [
      month,
      month0.data,
      month1.data,
      month2.data,
      month3.data,
      incomesQuery.data,
      budgetsQuery.data,
      categoriesQuery.data,
      cardsQuery.data,
      debtsQuery.data,
      feedbackMap,
      position.rows,
      position.monthlyContributionCents,
      realCashQuery.safeToSpend.committedObligationsCents,
      realCashQuery.safeToSpend.openInvoicesCents,
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
  };
}
