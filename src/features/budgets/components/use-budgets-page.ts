import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { budgetLimitsByCategory, realizedByCategoryMap, type CategoryKitId } from "@/domain/budgets";
import {
  filterCategoriesForScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { numberToCents, sumWeightedCents } from "@/domain/money";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { currentMonth } from "@/lib/date";
import {
  useAllCategories,
  useBudgets,
  useCategories,
  useCategoryUsage,
  useExpenses,
  useIncomeGoals,
  useIncomes,
  useMyPublicShares,
  usePermission,
  usePortfolioPosition,
  useRealCashBalance,
} from "@/state";
import { buildLiveGoalProgressMap } from "./budgets-goal-progress";
import { deriveBudgetsLimitsData } from "./budgets-limits-derived";
import { useBudgetsActions } from "./use-budgets-actions";
import { useBudgetsDialogs } from "./use-budgets-dialogs";

export type BudgetsTabKey = "limits" | "goals" | "categories";

export function useBudgetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { highlightId } = useHighlightTarget("q");
  const targetCategory = searchParams.get("categoria") ?? searchParams.get("category");
  const targetType = searchParams.get("type");
  const paramTab = searchParams.get("tab");
  const paramAba = searchParams.get("aba");
  const paramKit = searchParams.get("kit");

  const [month, setMonth] = useState(currentMonth());
  const [pickedTab, setPickedTab] = useState<BudgetsTabKey>("limits");
  const [showArchivedCampaigns, setShowArchivedCampaigns] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [spendMetric, setSpendMetric] = useState<"personal" | "household">("personal");
  const [nowMs] = useState(() => Date.now());

  const tab: BudgetsTabKey =
    targetType === "income" || paramTab === "goals" || paramAba === "metas"
      ? "goals"
      : targetType === "category" || paramTab === "categories" || paramAba === "categorias" || Boolean(paramKit)
        ? "categories"
        : paramTab === "limits" || paramAba === "limites" || Boolean(targetCategory)
          ? "limits"
          : pickedTab;

  const handleTabChange = (next: BudgetsTabKey) => {
    setPickedTab(next);
    if (paramTab || paramAba || targetType) {
      setSearchParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.delete("tab");
          updated.delete("aba");
          updated.delete("type");
          return updated;
        },
        { replace: true },
      );
    }
  };

  const permission = usePermission("budgets");
  const dialogs = useBudgetsDialogs(permission.isReadOnlyMode);
  const { setLimitFor } = dialogs;

  const budgetsQuery = useBudgets();
  const goalsQuery = useIncomeGoals();
  const goalSharesQuery = useMyPublicShares("goal_tracker");
  const allCategoriesQuery = useAllCategories();
  const expenseCategories = useCategories("expense");
  const incomeCategories = useCategories("income");
  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);
  const usageQuery = useCategoryUsage(dialogs.editingCategory ? dialogs.editingCategory.id : null);
  const realCashQuery = useRealCashBalance();
  const portfolioPositionQuery = usePortfolioPosition();

  const error =
    budgetsQuery.error ??
    goalsQuery.error ??
    expensesQuery.error ??
    incomesQuery.error ??
    allCategoriesQuery.error;

  const cashBalance = realCashQuery?.cashBalance;
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);

  const liveGoalProgress = useMemo(
    () =>
      buildLiveGoalProgressMap({
        currentBalanceCents: cashBalance?.currentBalanceCents ?? 0,
        positionRows,
        goalShares: goalSharesQuery.data ?? [],
      }),
    [cashBalance, positionRows, goalSharesQuery.data],
  );

  // Orçamentos e limites de gastos são estritamente pessoais da casa/família.
  // Gastos da empresa são geridos por DRE e Margem em /negocio e nunca estouram as metas domésticas.
  const categories = useMemo(() => {
    const raw = expenseCategories.data ?? [];
    return filterCategoriesForScope(raw, "personal", false);
  }, [expenseCategories.data]);
  const scopedExpenses = useMemo(
    () => filterExpensesByViewScope(expensesQuery.data ?? [], "personal", { mode: "dre" }),
    [expensesQuery.data],
  );
  const scopedIncomes = useMemo(
    () => filterIncomesByViewScope(incomesQuery.data ?? [], "personal", { mode: "dre" }),
    [incomesQuery.data],
  );
  const scopedIncomeCategories = useMemo(() => {
    const raw = incomeCategories.data ?? [];
    return filterCategoriesForScope(raw, "personal", false);
  }, [incomeCategories.data]);
  const allCategories = allCategoriesQuery.data ?? [];
  const siblings = allCategories.filter(
    (c) =>
      c.type === (dialogs.editingCategory?.type ?? (tab === "limits" ? "expense" : "income")) &&
      c.id !== dialogs.editingCategory?.id,
  );

  const matchedTargetCategory = useMemo(() => {
    if (!targetCategory || !expenseCategories.data) return null;
    const norm = targetCategory.toLowerCase().trim();
    return (
      expenseCategories.data.find(
        (c) => c.id === targetCategory || c.name.toLowerCase().trim() === norm,
      ) ?? null
    );
  }, [targetCategory, expenseCategories.data]);

  const effectiveHighlightId = highlightId ?? matchedTargetCategory?.id ?? targetCategory;

  useEffect(() => {
    if (
      matchedTargetCategory &&
      (searchParams.get("definirLimite") === "1" || searchParams.get("acao") === "definir-limite") &&
      !permission.isReadOnlyMode
    ) {
      const timer = setTimeout(() => {
        setLimitFor(matchedTargetCategory);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("definirLimite");
            next.delete("acao");
            return next;
          },
          { replace: true },
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [matchedTargetCategory, searchParams, permission.isReadOnlyMode, setSearchParams, setLimitFor]);

  const limitsByCategory = budgetLimitsByCategory(budgetsQuery.data ?? []);
  const limitsDerived = deriveBudgetsLimitsData({
    categories,
    limitsByCategory,
    expenses: scopedExpenses,
    month,
    spendMetric,
    showAllCategories,
    effectiveHighlightId,
  });

  const actions = useBudgetsActions({
    month,
    isReadOnlyMode: permission.isReadOnlyMode,
    suggestion: limitsDerived.suggestion,
    compositionShare: dialogs.compositionShare,
    setCompositionShare: dialogs.setCompositionShare,
    setReallocateOpen: dialogs.setReallocateOpen,
    setReallocateError: dialogs.setReallocateError,
    setUpgradeContext: dialogs.setUpgradeContext,
    setUpgradeOpen: dialogs.setUpgradeOpen,
  });

  const goalsByCategory = new Map<string, number>();
  for (const goal of goalsQuery.data ?? []) {
    if (goal.month === month) goalsByCategory.set(goal.category_id, numberToCents(goal.expected));
  }

  const allGoalShares = goalSharesQuery.data ?? [];
  const standaloneCampaigns = allGoalShares.filter((s) => !s.payload?.category_id);

  return {
    month,
    setMonth,
    tab,
    handleTabChange,
    spendMetric,
    setSpendMetric,
    error,
    permission,
    navigate,
    ...limitsDerived,
    categoriesCount: categories.length,
    totalIncomesCents: sumWeightedCents(scopedIncomes),
    limitsByCategory,
    isLimitsLoading: budgetsQuery.isLoading || expensesQuery.isLoading,
    effectiveHighlightId,
    showAllCategories,
    toggleShowAllCategories: () => setShowAllCategories((prev) => !prev),
    activeCampaigns: standaloneCampaigns.filter((s) => s.payload?.status !== "archived"),
    archivedCampaigns: standaloneCampaigns.filter((s) => s.payload?.status === "archived"),
    showArchivedCampaigns,
    toggleShowArchivedCampaigns: () => setShowArchivedCampaigns((prev) => !prev),
    liveGoalProgress,
    incomeCategories: scopedIncomeCategories,
    realizedByCategory: realizedByCategoryMap(scopedIncomes),
    goalsByCategory,
    goalShares: allGoalShares,
    nowMs,
    allCategories,
    siblings,
    categoryUsage: usageQuery.data ?? null,
    ...dialogs,
    ...actions,
    handleRetry: () => {
      void Promise.all([
        budgetsQuery.refetch(),
        goalsQuery.refetch(),
        expensesQuery.refetch(),
        incomesQuery.refetch(),
        goalSharesQuery.refetch(),
      ]);
    },
  };
}
