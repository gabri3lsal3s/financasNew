import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { FeedFilter } from "@/domain/expenses";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { currentMonth, isValidMonth, shiftMonth } from "@/lib/date";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import {
  useCategories,
  useCreditCards,
  useExpenses,
  useFamilyMode,
  useIncomes,
  usePermission,
  useRecurrences,
} from "@/state";
import type { Expense, Income } from "@/types";
import {
  TRANSACTIONS_PAGE_SIZE,
  buildPriceEvolutionMap,
  computePagedFeed,
  computeTransactionTotals,
  exportTransactionsToCsv,
  resolveInitialFeedFilter,
} from "./transaction-list-helpers";

export function useTransactionList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const { highlightId } = useHighlightTarget("q");

  const paramMonth = searchParams.get("month");
  const validParamMonth = paramMonth && isValidMonth(paramMonth) ? paramMonth : null;
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = validParamMonth ?? pickedMonth ?? currentMonth();

  const handleMonthChange = (next: string) => {
    setPickedMonth(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("month");
        return updated;
      },
      { replace: true },
    );
  };

  const { isFamilyModeEnabled } = useFamilyMode();
  const expensesQuery = useExpenses(month);
  const prevMonth1Query = useExpenses(shiftMonth(month, -1));
  const prevMonth2Query = useExpenses(shiftMonth(month, -2));
  const prevMonth3Query = useExpenses(shiftMonth(month, -3));
  const incomesQuery = useIncomes(month);
  const categoriesQuery = useCategories();
  const recurrencesQuery = useRecurrences();
  const cardsQuery = useCreditCards();

  const loading =
    expensesQuery.isLoading ||
    incomesQuery.isLoading ||
    categoriesQuery.isLoading ||
    recurrencesQuery.isLoading;
  const error =
    expensesQuery.error ?? incomesQuery.error ?? categoriesQuery.error ?? recurrencesQuery.error;

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );
  const cardById = useMemo(
    () => new Map((cardsQuery.data ?? []).map((c) => [c.id, c.name])),
    [cardsQuery.data],
  );

  const expenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const allHistoryExpenses = useMemo(
    () => [
      ...(expensesQuery.data ?? []),
      ...(prevMonth1Query.data ?? []),
      ...(prevMonth2Query.data ?? []),
      ...(prevMonth3Query.data ?? []),
    ],
    [expensesQuery.data, prevMonth1Query.data, prevMonth2Query.data, prevMonth3Query.data],
  );
  const incomes = useMemo(() => incomesQuery.data ?? [], [incomesQuery.data]);

  const totals = useMemo(() => computeTransactionTotals(expenses, incomes), [expenses, incomes]);

  const paramFilter = searchParams.get("tipo") ?? searchParams.get("filter");
  const initialFilter = useMemo(() => resolveInitialFeedFilter(paramFilter), [paramFilter]);
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [prevInitialFilter, setPrevInitialFilter] = useState<FeedFilter>(initialFilter);
  if (prevInitialFilter !== initialFilter) {
    setPrevInitialFilter(initialFilter);
    setFilter(initialFilter);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PAGE_SIZE);
  const [prevFilterKey, setPrevFilterKey] = useState(() => `${month}-${filter}-${searchQuery}`);
  const currentFilterKey = `${month}-${filter}-${searchQuery}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setVisibleCount(TRANSACTIONS_PAGE_SIZE);
  }

  const priceEvolutionByExpenseId = useMemo(
    () => buildPriceEvolutionMap(expenses, allHistoryExpenses),
    [expenses, allHistoryExpenses],
  );

  const feed = useMemo(
    () =>
      computePagedFeed({
        expenses,
        incomes,
        filter,
        searchQuery,
        categoryById,
        highlightId,
        visibleCount,
      }),
    [expenses, incomes, filter, searchQuery, categoryById, highlightId, visibleCount],
  );

  const frequencyById = useMemo(
    () => new Map((recurrencesQuery.data ?? []).map((r) => [r.id, r.frequency])),
    [recurrencesQuery.data],
  );
  const recurrenceLabel = useCallback(
    (recurrenceId: string | null | undefined): string | undefined => {
      const frequency = recurrenceId ? frequencyById.get(recurrenceId) : undefined;
      return frequency ? RECURRENCE_FREQUENCY_LABELS[frequency] : undefined;
    },
    [frequencyById],
  );

  const { setOpen: setWizardOpen } = useCreateDeepLink("transacao");
  const permission = usePermission("transactions");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const handleNewTransaction = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Criar Lançamentos e Despesas");
      setUpgradeOpen(true);
      return;
    }
    setWizardOpen(true);
  };

  const handleExportCsv = () => {
    exportTransactionsToCsv({
      items: feed.filteredFeedItems,
      month,
      filter,
      categoryById,
      cardById,
      recurrenceLabel,
    });
  };

  const handleRetry = () => {
    void Promise.all([
      expensesQuery.refetch(),
      incomesQuery.refetch(),
      categoriesQuery.refetch(),
      recurrencesQuery.refetch(),
    ]);
  };

  const clearRachaParams = () => {
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("racha_modal");
        updated.delete("racha_preview");
        updated.delete("link");
        return updated;
      },
      { replace: true },
    );
  };

  return {
    month,
    handleMonthChange,
    isFamilyModeEnabled: Boolean(isFamilyModeEnabled),
    loading,
    error,
    categoryById,
    ...totals,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    priceEvolutionByExpenseId,
    filteredFeedItemsCount: feed.filteredFeedItems.length,
    effectiveVisibleCount: feed.effectiveVisibleCount,
    hasMore: feed.hasMore,
    isSearching: searchQuery.trim().length > 0,
    feedGroups: feed.feedGroups,
    recurrenceLabel,
    highlightId,
    selectedExpense,
    setSelectedExpense,
    selectedIncome,
    setSelectedIncome,
    activeExpense: selectedExpense ? (expenses.find((e) => e.id === selectedExpense.id) ?? selectedExpense) : null,
    activeIncome: selectedIncome ? (incomes.find((i) => i.id === selectedIncome.id) ?? selectedIncome) : null,
    permission,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    setUpgradeContext,
    showRachaPreview:
      searchParams.get("racha_preview") === "1" ||
      (searchParams.get("racha_modal") === "1" && searchParams.get("link") === "1"),
    showRachaSimulation:
      searchParams.get("racha_modal") === "1" && searchParams.get("link") !== "1",
    clearRachaParams,
    handleNewTransaction,
    handleExportCsv,
    handleRetry,
    loadMore: () => setVisibleCount((prev) => prev + TRANSACTIONS_PAGE_SIZE),
    navigate,
  };
}
