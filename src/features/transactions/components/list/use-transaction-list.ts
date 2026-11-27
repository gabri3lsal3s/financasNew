import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { filterExpensesByViewScope, filterIncomesByViewScope } from "@/domain/business";
import type { BusinessSubFilter, FeedFilter } from "@/domain/expenses";
import { parseStructuredSearchQuery } from "@/domain/search";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useSafeBusinessMode, useSafeViewScope } from "@/hooks/use-safe-business-scope";
import { currentMonth, isValidMonth, shiftMonth, todayLocalIso } from "@/lib/date";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { useMerchantLearning } from "@/services/merchant-learning";
import {
  useCategories,
  useCreditCards,
  useDebts,
  useExpenses,
  useFamilyMode,
  useIncomes,
  useMyPublicShares,
  usePermission,
  useRecurrences,
} from "@/state";
import type { Expense, Income, ViewScope } from "@/types";
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

  const paramMonth = searchParams.get("mes") ?? searchParams.get("month");
  const validParamMonth = paramMonth && isValidMonth(paramMonth) ? paramMonth : null;
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = validParamMonth ?? pickedMonth ?? currentMonth();

  const handleMonthChange = (next: string) => {
    setPickedMonth(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("mes");
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
  const splitSharesQuery = useMyPublicShares("split");
  const debtsQuery = useDebts();

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

  const { isBusinessModeEnabled } = useSafeBusinessMode();
  const [businessSubFilter, setBusinessSubFilter] = useState<BusinessSubFilter>("all");

  const paramFilter = searchParams.get("tipo") ?? searchParams.get("filter");
  const initialFilter = useMemo(() => resolveInitialFeedFilter(paramFilter), [paramFilter]);
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [prevInitialFilter, setPrevInitialFilter] = useState<FeedFilter>(initialFilter);
  if (prevInitialFilter !== initialFilter) {
    setPrevInitialFilter(initialFilter);
    setFilter(initialFilter);
  }

  const { effectiveViewScope } = useSafeViewScope();
  const targetScope: ViewScope = filter === "business" ? "business" : effectiveViewScope;
  const { memory: merchantLearning } = useMerchantLearning();
  const expenses = useMemo(
    () => filterExpensesByViewScope(expensesQuery.data ?? [], targetScope, { mode: "cashflow" }),
    [expensesQuery.data, targetScope],
  );
  const deduplicatedCashflowHistory = useMemo(() => {
    const merged = [
      ...(expensesQuery.data ?? []),
      ...(prevMonth1Query.data ?? []),
      ...(prevMonth2Query.data ?? []),
      ...(prevMonth3Query.data ?? []),
    ];
    const unique = Array.from(new Map(merged.map((e) => [e.id, e])).values());
    return filterExpensesByViewScope(unique, targetScope, { mode: "cashflow" });
  }, [
    expensesQuery.data,
    prevMonth1Query.data,
    prevMonth2Query.data,
    prevMonth3Query.data,
    targetScope,
  ]);
  const allHistoryExpenses = useMemo(
    () =>
      filterExpensesByViewScope(
        [
          ...(expensesQuery.data ?? []),
          ...(prevMonth1Query.data ?? []),
          ...(prevMonth2Query.data ?? []),
          ...(prevMonth3Query.data ?? []),
        ],
        targetScope,
        { mode: "dre" },
      ),
    [expensesQuery.data, prevMonth1Query.data, prevMonth2Query.data, prevMonth3Query.data, targetScope],
  );
  const incomes = useMemo(
    () => filterIncomesByViewScope(incomesQuery.data ?? [], targetScope, { mode: "cashflow" }),
    [incomesQuery.data, targetScope],
  );

  const totals = useMemo(() => computeTransactionTotals(expenses, incomes), [expenses, incomes]);

  const paramBusca = searchParams.get("busca") ?? "";
  const paramIds = searchParams.get("ids") ?? "";
  const filterIds = useMemo(() => {
    const raw = paramIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return raw.length > 0 ? new Set(raw) : null;
  }, [paramIds]);
  const [searchQuery, setSearchQueryState] = useState(paramBusca);
  const [prevParamBusca, setPrevParamBusca] = useState(paramBusca);
  if (prevParamBusca !== paramBusca) {
    setPrevParamBusca(paramBusca);
    if (paramBusca) {
      setSearchQueryState(paramBusca);
    }
  }

  const clearIdsFilter = useCallback(() => {
    if (!searchParams.has("ids")) return;
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("ids");
        return updated;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const setSearchQuery = useCallback(
    (nextQuery: string) => {
      setSearchQueryState(nextQuery);
      if (!nextQuery && (searchParams.has("busca") || searchParams.has("ids"))) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            updated.delete("busca");
            updated.delete("ids");
            return updated;
          },
          { replace: true },
        );
      }
    },
    [searchParams, setSearchParams],
  );

  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PAGE_SIZE);
  const [prevFilterKey, setPrevFilterKey] = useState(
    () => `${month}-${filter}-${searchQuery}-${paramIds}`,
  );
  const currentFilterKey = `${month}-${filter}-${searchQuery}-${paramIds}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setVisibleCount(TRANSACTIONS_PAGE_SIZE);
  }

  const priceEvolutionByExpenseId = useMemo(
    () => buildPriceEvolutionMap(expenses, allHistoryExpenses),
    [expenses, allHistoryExpenses],
  );

  const todayISOStr = todayLocalIso();
  const usesMultiMonthScope = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return false;
    const parsed = parseStructuredSearchQuery(trimmed, {
      todayISO: todayISOStr,
      referenceMonth: month,
      merchantLearning,
    });
    if (!parsed.monthScope) return false;
    if (parsed.monthScope.kind === "last_3_months" || parsed.monthScope.kind === "previous_month") {
      return true;
    }
    if (parsed.monthScope.kind === "specific_month" && parsed.monthScope.month !== month) {
      return true;
    }
    return false;
  }, [searchQuery, todayISOStr, month, merchantLearning]);

  const feed = useMemo(
    () =>
      computePagedFeed({
        expenses: usesMultiMonthScope ? deduplicatedCashflowHistory : expenses,
        incomes,
        filter,
        businessSubFilter,
        searchQuery,
        filterIds,
        categoryById,
        cardById,
        merchantLearning,
        referenceMonth: month,
        todayISO: todayISOStr,
        highlightId,
        visibleCount,
      }),
    [
      usesMultiMonthScope,
      deduplicatedCashflowHistory,
      expenses,
      incomes,
      filter,
      businessSubFilter,
      searchQuery,
      filterIds,
      categoryById,
      cardById,
      merchantLearning,
      month,
      todayISOStr,
      highlightId,
      visibleCount,
    ],
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

  const { splitExpenseIds, splitGroupIds } = useMemo(() => {
    const expenseIds = new Set<string>();
    const groupIds = new Set<string>();
    for (const share of splitSharesQuery.data ?? []) {
      const p = (share.payload ?? {}) as Record<string, unknown>;
      const expId = share.expense_id || (typeof p.expense_id === "string" ? p.expense_id : null);
      const grpId =
        share.installment_group_id ||
        (typeof p.installment_group_id === "string" ? p.installment_group_id : null);
      if (expId) expenseIds.add(expId);
      if (grpId) groupIds.add(grpId);
    }
    for (const debt of debtsQuery.data ?? []) {
      if (debt.type === "receivable" && debt.name.toLowerCase().includes("racha")) {
        if (debt.expense_id) expenseIds.add(debt.expense_id);
        if (debt.installment_group_id) groupIds.add(debt.installment_group_id);
      }
    }
    return { splitExpenseIds: expenseIds, splitGroupIds: groupIds };
  }, [splitSharesQuery.data, debtsQuery.data]);

  const isExpenseSplit = useCallback(
    (expense: Expense) =>
      splitExpenseIds.has(expense.id) ||
      Boolean(expense.installment_group_id && splitGroupIds.has(expense.installment_group_id)),
    [splitExpenseIds, splitGroupIds],
  );

  const gerenciarRachaId = searchParams.get("gerenciar_racha");
  const managedSplitShare = useMemo(() => {
    if (!gerenciarRachaId || !splitSharesQuery.data) return null;
    return splitSharesQuery.data.find((s) => s.id === gerenciarRachaId) ?? null;
  }, [gerenciarRachaId, splitSharesQuery.data]);

  const managedSplitDebt = useMemo(() => {
    if (!managedSplitShare || !debtsQuery.data) return null;
    const p = (managedSplitShare.payload ?? {}) as Record<string, unknown>;
    const debtId = managedSplitShare.debt_id || (typeof p.debt_id === "string" ? p.debt_id : null);
    const expId = managedSplitShare.expense_id || (typeof p.expense_id === "string" ? p.expense_id : null);
    const grpId =
      managedSplitShare.installment_group_id ||
      (typeof p.installment_group_id === "string" ? p.installment_group_id : null);
    return (
      debtsQuery.data.find(
        (d) =>
          (debtId && d.id === debtId) ||
          (d.type === "receivable" &&
            ((expId && d.expense_id === expId) || (grpId && d.installment_group_id === grpId))),
      ) ?? null
    );
  }, [managedSplitShare, debtsQuery.data]);

  const clearManagedSplitParam = () => {
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("gerenciar_racha");
        return updated;
      },
      { replace: true },
    );
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
    isBusinessModeEnabled,
    businessSubFilter,
    setBusinessSubFilter,
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
    isSearching: searchQuery.trim().length > 0 || Boolean(filterIds && filterIds.size > 0),
    activeIdsFilterCount: filterIds?.size ?? 0,
    clearIdsFilter,
    structuredFilterBadges: feed.structuredFilterBadges,
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
    isExpenseSplit,
    managedSplitShare,
    managedSplitDebt,
    clearManagedSplitParam,
    handleNewTransaction,
    handleExportCsv,
    handleRetry,
    loadMore: () => setVisibleCount((prev) => prev + TRANSACTIONS_PAGE_SIZE),
    navigate,
  };
}
