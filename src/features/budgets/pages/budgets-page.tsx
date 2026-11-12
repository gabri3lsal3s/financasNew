import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PiggyBank, Plus, SlidersHorizontal, Target, TrendingDown } from "lucide-react";
import { Alert, Button, ConfirmDialog, ErrorState, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { useCreateDeepLink } from "@/hooks";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import {
  budgetLimitsByCategory,
  isInheritedLimit,
  realizedByCategoryMap,
  reallocationSuggestion,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
} from "@/domain/budgets";
import { numberToCents, sumGrossCents, sumWeightedCents } from "@/domain/money";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";

import { currentMonth } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
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
  useReallocateBudget,
  useSeedDefaultCategories,
  useUpdatePublicShare,
} from "@/state";
import {
  BudgetAdjustDialog,
  BudgetsCategoriesTab,
  BudgetsGoalsTab,
  BudgetsLimitsTab,
  CategoryFormDialog,
  IncomeGoalDialog,
  LimitDialog,
  type BudgetAdjustCategoryItem,
} from "@/features/budgets/components";
import {
  AddContributionDialog,
  GoalCompositionDialog,
  ManageContributionsDialog,
  ShareGoalDialog,
} from "@/features/goals";
import type { Category, GoalCompositionConfig, PublicShare } from "@/types";

/** Categorias & Orçamentos (§3.5.2) e metas de renda (§3.5.3) — Opção C unificada. */
export function BudgetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");
  const targetCategory = searchParams.get("category");
  const targetType = searchParams.get("type");
  const effectiveHighlightId = highlightId ?? targetCategory;

  const [month, setMonth] = useState(currentMonth());
  const paramTab = searchParams.get("tab");
  const paramAba = searchParams.get("aba");

  const [pickedTab, setPickedTab] = useState<"limits" | "goals" | "categories">("limits");
  const tab: "limits" | "goals" | "categories" =
    targetType === "income" || paramTab === "goals" || paramAba === "metas"
      ? "goals"
      : targetType === "category" || paramTab === "categories" || paramAba === "categorias"
        ? "categories"
        : paramTab === "limits" || paramAba === "limites"
          ? "limits"
          : pickedTab;

  const handleTabChange = (next: "limits" | "goals" | "categories") => {
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
  const [limitFor, setLimitFor] = useState<Category | null>(null);
  const [goalFor, setGoalFor] = useState<Category | null>(null);
  const [sharingGoalFor, setSharingGoalFor] = useState<Category | null>(null);
  const [depositShare, setDepositShare] = useState<PublicShare | null>(null);
  const [manageContributionsShare, setManageContributionsShare] = useState<PublicShare | null>(null);
  const [compositionShare, setCompositionShare] = useState<PublicShare | null>(null);
  const [editingShare, setEditingShare] = useState<PublicShare | null>(null);
  const [editingShareInitialEdit, setEditingShareInitialEdit] = useState(false);
  const updatePublicShareMutation = useUpdatePublicShare();
  const [createStandaloneCampaignOpen, setCreateStandaloneCampaignOpen] = useState(false);
  const [showArchivedCampaigns, setShowArchivedCampaigns] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { open: categoryFormOpen, setOpen: setCategoryFormOpen } = useCreateDeepLink("categoria");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);
  const [spendMetric, setSpendMetric] = useState<"personal" | "household">("personal");
  const [nowMs] = useState(() => Date.now());

  const budgetsQuery = useBudgets();
  const goalsQuery = useIncomeGoals();
  const goalSharesQuery = useMyPublicShares("goal_tracker");
  const allCategoriesQuery = useAllCategories();
  const expenseCategories = useCategories("expense");
  const incomeCategories = useCategories("income");
  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);
  const usageQuery = useCategoryUsage(editingCategory ? editingCategory.id : null);

  const reallocate = useReallocateBudget();
  const seedCategoriesMutation = useSeedDefaultCategories();
  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);

  const error = budgetsQuery.error ?? goalsQuery.error ?? expensesQuery.error ?? incomesQuery.error ?? allCategoriesQuery.error;

  const realCashQuery = useRealCashBalance();
  const cashBalance = realCashQuery?.cashBalance;
  const portfolioPositionQuery = usePortfolioPosition();
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);



  // Cálculo reativo e instantâneo do progresso de metas patrimoniais (§Plano 12)
  const liveGoalProgress = useMemo(() => {
    const currentBalance = Math.max(0, cashBalance?.currentBalanceCents ?? 0);
    const accounts: AccountCompositionItem[] = [
      {
        id: "main_cash",
        name: "Saldo em Conta Corrente / Caixa Geral",
        balanceCents: currentBalance,
        pendingObligationsCents: 0,
      },
    ];

    const assets: PortfolioAssetCompositionItem[] = positionRows
      .filter((r) => r.quantity > 0 || r.valueBRL > 0)
      .map((r) => ({
        id: r.assetId,
        ticker: r.ticker,
        assetClass: r.assetClass,
        quantity: r.quantity > 0 ? r.quantity : 1,
        valueCents: Math.round(r.valueBRL * 100),
        totalCostCents: Math.round(r.totalCostBRL * 100),
      }));

    const map = new Map<string, { currentCents: number; percentage: number; isCompleted: boolean }>();
    const allShares = goalSharesQuery.data ?? [];

    for (const share of allShares) {
      const payload = share.payload ?? {};
      const config = payload.composition_config as GoalCompositionConfig | undefined;
      const targetCents = Number(payload.target_cents ?? 0);
      const isCompletedInDb = payload.status === "completed";

      if (config) {
        const resolved = resolveGoalComposition({
          config,
          targetCents,
          accounts,
          assets,
          previouslyLockedAsCompleted: isCompletedInDb && targetCents > 0 ? false : isCompletedInDb,
        });

        const isActuallyCompleted =
          targetCents > 0 ? resolved.currentCents >= targetCents : isCompletedInDb;

        map.set(share.id, {
          currentCents: resolved.currentCents,
          percentage: Math.round(resolved.progressPercent),
          isCompleted: isActuallyCompleted,
        });
      } else {
        const currentCents = Number(payload.current_cents ?? 0);
        const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
        const isActuallyCompleted =
          targetCents > 0 ? currentCents >= targetCents : isCompletedInDb;

        map.set(share.id, {
          currentCents,
          percentage,
          isCompleted: isActuallyCompleted,
        });
      }
    }

    return map;
  }, [cashBalance, positionRows, goalSharesQuery.data]);

  const budgets = budgetsQuery.data ?? [];

  // Limites agrupados por categoria: cada uma herda APENAS do próprio histórico.
  const limitsByCategory = budgetLimitsByCategory(budgets);

  const totalExpensesWeightedCents = sumWeightedCents(expensesQuery.data ?? []);
  const totalExpensesGrossCents = sumGrossCents(expensesQuery.data ?? []);
  const totalExpensesCents = spendMetric === "personal" ? totalExpensesWeightedCents : totalExpensesGrossCents;
  const totalIncomesCents = sumWeightedCents(incomesQuery.data ?? []);

  const spentWeightedByCategory = spentByCategoryMap(expensesQuery.data ?? []);
  const spentGrossByCategory = spentGrossByCategoryMap(expensesQuery.data ?? []);
  const realizedByCategory = realizedByCategoryMap(incomesQuery.data ?? []);

  const categories = expenseCategories.data ?? [];
  const allCategories = allCategoriesQuery.data ?? [];
  const siblings = allCategories.filter(
    (c) => c.type === (editingCategory?.type ?? (tab === "limits" ? "expense" : "income")) && c.id !== editingCategory?.id,
  );

  // Categorias de despesa com limite ou gasto
  const allExpenseRows = categories.map((category) => {
    const ownHistory = limitsByCategory.get(category.id) ?? [];
    const spentWeighted = spentWeightedByCategory.get(category.id) ?? 0;
    const spentGross = spentGrossByCategory.get(category.id) ?? 0;
    const effectiveSpentCents = spendMetric === "personal" ? spentWeighted : spentGross;
    return {
      category,
      limitCents: resolveEffectiveLimit(ownHistory, month),
      spentCents: effectiveSpentCents,
      spentWeightedCents: spentWeighted,
      spentGrossCents: spentGross,
      hasSplitDifference: spentGross !== spentWeighted,
      inherited: isInheritedLimit(ownHistory, month),
    };
  });

  const activeRows = allExpenseRows
    .filter((row) => row.limitCents > 0 || row.spentCents > 0)
    .sort((a, b) => {
      const pctA = a.limitCents > 0 ? a.spentCents / a.limitCents : a.spentCents > 0 ? 999 : 0;
      const pctB = b.limitCents > 0 ? b.spentCents / b.limitCents : b.spentCents > 0 ? 999 : 0;
      return pctB - pctA;
    });
  const unbudgetedRows = allExpenseRows.filter((row) => row.limitCents === 0 && row.spentCents === 0);

  const isHighlightedUnbudgeted = Boolean(
    effectiveHighlightId && unbudgetedRows.some((r) => r.category.id === effectiveHighlightId),
  );
  const shouldShowAll = showAllCategories || isHighlightedUnbudgeted;
  const rows = shouldShowAll ? allExpenseRows : activeRows;

  const budgetedRows = allExpenseRows.filter((row) => row.limitCents > 0);
  const totalLimitsCents = budgetedRows.reduce((acc, row) => acc + row.limitCents, 0);
  const totalBudgetedExpensesCents = budgetedRows.reduce((acc, row) => acc + row.spentCents, 0);
  const totalUnbudgetedExpensesCents = Math.max(0, totalExpensesCents - totalBudgetedExpensesCents);
  const hasBudgetLimits = totalLimitsCents > 0;
  const hasPartialBudgets = hasBudgetLimits && totalUnbudgetedExpensesCents > 0;

  // Realocação opera sobre limites efetivos no mês (com herança)
  const suggestion = reallocationSuggestion(
    activeRows.map((row) => ({
      categoryId: row.category.id,
      limitCents: row.limitCents,
      spentCents: row.spentCents,
    })),
  );

  const fromCategory = suggestion ? categories.find((c) => c.id === suggestion.fromCategoryId) : undefined;
  const toCategory = suggestion ? categories.find((c) => c.id === suggestion.toCategoryId) : undefined;

  const permission = usePermission("budgets");
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const handleOpenLimit = (category: Category) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Definir Limite de Orçamento");
      setUpgradeOpen(true);
      return;
    }
    setLimitFor(category);
  };

  const handleOpenGoal = (category: Category) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Definir Meta de Renda");
      setUpgradeOpen(true);
      return;
    }
    setGoalFor(category);
  };

  const [adjustOpen, setAdjustOpen] = useState(false);

  const adjustCategories: BudgetAdjustCategoryItem[] = allExpenseRows.map((r) => ({
    category: r.category,
    currentLimitCents: r.limitCents,
  }));

  const handleOpenAdjustBudget = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Ajustar Orçamento");
      setUpgradeOpen(true);
      return;
    }
    setAdjustOpen(true);
  };

  const handleOpenCreateCategory = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Cadastrar Nova Categoria");
      setUpgradeOpen(true);
      return;
    }
    setEditingCategory(null);
    setCategoryFormOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Editar Categoria");
      setUpgradeOpen(true);
      return;
    }
    setEditingCategory(category);
    setCategoryFormOpen(true);
  };

  const handleSeedCategories = async () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Carregar Categorias Padrão");
      setUpgradeOpen(true);
      return;
    }
    setSeedFeedback(null);
    try {
      triggerSensory("action");
      const count = await seedCategoriesMutation.mutateAsync();
      triggerSensory("success");
      setSeedFeedback(
        count > 0
          ? `${count} categorias padrão carregadas com sucesso.`
          : "Todas as categorias padrão já estão presentes no seu catálogo.",
      );
    } catch (err) {
      triggerSensory("error");
      setSeedFeedback(getErrorMessage(err));
    }
  };

  const handleOpenReallocate = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Remanejar Orçamento");
      setUpgradeOpen(true);
      return;
    }
    setReallocateOpen(true);
  };

  const applyReallocation = async () => {
    if (!suggestion) return;
    setReallocateError(null);
    try {
      await reallocate.mutateAsync({
        fromCategoryId: suggestion.fromCategoryId,
        toCategoryId: suggestion.toCategoryId,
        month,
        amount: suggestion.amountCents / 100,
      });
      setReallocateOpen(false);
    } catch (err) {
      setReallocateError(getErrorMessage(err));
    }
  };

  const goalsByCategory = new Map<string, number>();
  for (const goal of goalsQuery.data ?? []) {
    if (goal.month === month) goalsByCategory.set(goal.category_id, numberToCents(goal.expected));
  }

  const allGoalShares = goalSharesQuery.data ?? [];
  const standaloneCampaigns = allGoalShares.filter((s) => !s.payload?.category_id);
  const activeCampaigns = standaloneCampaigns.filter((s) => s.payload?.status !== "archived");
  const archivedCampaigns = standaloneCampaigns.filter((s) => s.payload?.status === "archived");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Orçamentos"
        description="Tetos de gastos mensais, metas de renda e controle de categorias"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-label="Ajustar orçamento"
              onClick={handleOpenAdjustBudget}
              className="gap-1.5"
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              <span>Ajustar orçamento</span>
            </Button>
            <Button
              size="sm"
              aria-label="Nova categoria"
              onClick={handleOpenCreateCategory}
              className="gap-1.5"
            >
              <Plus aria-hidden="true" className="size-4" />
              <span>Nova categoria</span>
            </Button>
          </>
        }
      />

      {permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            setUpgradeContext(undefined);
            setUpgradeOpen(true);
          }}
        />
      )}

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      <Tabs
        value={tab}
        onValueChange={(value) => handleTabChange(value as "limits" | "goals" | "categories")}
        variant="underline"
        swipeable
        items={[
          {
            value: "limits",
            label: "Despesas",
            icon: <TrendingDown className="size-4" aria-hidden="true" />,
            content: (
              <BudgetsLimitsTab
                month={month}
                onMonthChange={setMonth}
                spendMetric={spendMetric}
                onSpendMetricChange={setSpendMetric}
                totalExpensesGrossCents={totalExpensesGrossCents}
                totalExpensesWeightedCents={totalExpensesWeightedCents}
                hasBudgetLimits={hasBudgetLimits}
                totalBudgetedExpensesCents={totalBudgetedExpensesCents}
                totalExpensesCents={totalExpensesCents}
                hasPartialBudgets={hasPartialBudgets}
                totalLimitsCents={totalLimitsCents}
                totalUnbudgetedExpensesCents={totalUnbudgetedExpensesCents}
                budgetedRowsCount={budgetedRows.length}
                categoriesCount={categories.length}
                onOpenAdjustBudget={handleOpenAdjustBudget}
                suggestion={suggestion}
                fromCategory={fromCategory}
                toCategory={toCategory}
                onOpenReallocate={handleOpenReallocate}
                isLoading={budgetsQuery.isLoading || expensesQuery.isLoading}
                rows={rows}
                unbudgetedRows={unbudgetedRows}
                effectiveHighlightId={effectiveHighlightId}
                onOpenLimit={handleOpenLimit}
                onEditCategory={handleEditCategory}
                onOpenCreateCategory={handleOpenCreateCategory}
                showAllCategories={showAllCategories}
                onToggleShowAllCategories={() => setShowAllCategories((prev) => !prev)}
              />
            ),
          },
          {
            value: "goals",
            label: "Metas & Campanhas",
            icon: <Target className="size-4" aria-hidden="true" />,
            content: (
              <BudgetsGoalsTab
                month={month}
                onMonthChange={setMonth}
                activeCampaigns={activeCampaigns}
                archivedCampaigns={archivedCampaigns}
                showArchivedCampaigns={showArchivedCampaigns}
                onToggleShowArchivedCampaigns={() => setShowArchivedCampaigns((prev) => !prev)}
                liveGoalProgress={liveGoalProgress}
                incomeCategories={incomeCategories.data ?? []}
                realizedByCategory={realizedByCategory}
                goalsByCategory={goalsByCategory}
                goalShares={goalSharesQuery.data ?? []}
                nowMs={nowMs}
                effectiveHighlightId={effectiveHighlightId}
                onOpenNewStandaloneCampaign={() => {
                  setSharingGoalFor(null);
                  setEditingShare(null);
                  setEditingShareInitialEdit(false);
                  setCreateStandaloneCampaignOpen(true);
                }}
                onOpenDeposit={(s) => setDepositShare(s)}
                onManageShare={(s, initialEdit) => {
                  setEditingShare(s);
                  setEditingShareInitialEdit(initialEdit);
                }}
                onManageContributions={(s) => setManageContributionsShare(s)}
                onOpenComposition={(s) => setCompositionShare(s)}
                onOpenGoal={handleOpenGoal}
                onEditCategory={handleEditCategory}
                onShareGoal={(cat) => setSharingGoalFor(cat)}
                onOpenCreateCategory={handleOpenCreateCategory}
              />
            ),
          },
          {
            value: "categories",
            label: "Categorias",
            icon: <PiggyBank className="size-4" aria-hidden="true" />,
            content: (
              <BudgetsCategoriesTab
                allCategories={allCategories}
                onSeedCategories={handleSeedCategories}
                isSeeding={seedCategoriesMutation.isPending}
                isSeedError={seedCategoriesMutation.isError}
                seedFeedback={seedFeedback}
                onOpenCreateCategory={handleOpenCreateCategory}
                onEditCategory={handleEditCategory}
              />
            ),
          },
        ]}
      />

      {limitFor ? (
        <LimitDialog
          key={`${limitFor.id}:${month}`}
          category={limitFor}
          month={month}
          currentLimitCents={resolveEffectiveLimit(limitsByCategory.get(limitFor.id) ?? [], month)}
          inherited={isInheritedLimit(limitsByCategory.get(limitFor.id) ?? [], month)}
          monthlyIncomeCents={totalIncomesCents}
          open={limitFor !== null}
          onOpenChange={(next) => !next && setLimitFor(null)}
          onEditCategory={handleEditCategory}
        />
      ) : null}

      {goalFor ? (
        <IncomeGoalDialog
          key={`${goalFor.id}:${month}`}
          category={goalFor}
          month={month}
          currentExpectedCents={goalsByCategory.get(goalFor.id) ?? 0}
          open={goalFor !== null}
          onOpenChange={(next) => !next && setGoalFor(null)}
          onEditCategory={handleEditCategory}
        />
      ) : null}

      {sharingGoalFor ? (
        <ShareGoalDialog
          key={`share:${sharingGoalFor.id}:${month}`}
          category={sharingGoalFor}
          month={month}
          currentExpectedCents={goalsByCategory.get(sharingGoalFor.id) ?? 0}
          currentRealizedCents={realizedByCategory.get(sharingGoalFor.id) ?? 0}
          open={sharingGoalFor !== null}
          onOpenChange={(next) => !next && setSharingGoalFor(null)}
        />
      ) : null}

      {createStandaloneCampaignOpen ? (
        <ShareGoalDialog
          key="share:new-standalone"
          category={null}
          month={month}
          open={createStandaloneCampaignOpen}
          onOpenChange={setCreateStandaloneCampaignOpen}
        />
      ) : null}

      {editingShare ? (
        <ShareGoalDialog
          key={`share:edit:${editingShare.id}:${editingShareInitialEdit ? "edit" : "view"}`}
          category={null}
          existingShare={
            (goalSharesQuery.data ?? []).find((s) => s.id === editingShare.id) ?? editingShare
          }
          month={month}
          open={editingShare !== null}
          initialEditMode={editingShareInitialEdit}
          onOpenChange={(next) => {
            if (!next) {
              setEditingShare(null);
              setEditingShareInitialEdit(false);
            }
          }}
        />
      ) : null}

      {depositShare ? (
        <AddContributionDialog
          key={`deposit:${depositShare.id}`}
          share={depositShare}
          open={depositShare !== null}
          onOpenChange={(next) => !next && setDepositShare(null)}
        />
      ) : null}

      {manageContributionsShare ? (
        <ManageContributionsDialog
          key={`manage-contribs:${manageContributionsShare.id}`}
          share={manageContributionsShare}
          open={manageContributionsShare !== null}
          onOpenChange={(next) => !next && setManageContributionsShare(null)}
        />
      ) : null}

      {compositionShare ? (
        <GoalCompositionDialog
          open={compositionShare !== null}
          onOpenChange={(next) => !next && setCompositionShare(null)}
          config={
            (compositionShare.payload as Record<string, unknown> | undefined)
              ?.composition_config as never
          }
          targetCents={Number(
            (compositionShare.payload as Record<string, unknown> | undefined)?.target_cents ?? 0,
          )}
          goalTitle={
            (compositionShare.payload as Record<string, unknown> | undefined)?.title as string
          }
          isCompleted={
            (compositionShare.payload as Record<string, unknown> | undefined)?.status ===
            "completed"
          }
          onSave={(newConfig, previewResult) => {
            const currentPayload =
              (compositionShare.payload as Record<string, unknown>) ?? {};
            const isNowCompleted =
              previewResult.isReached ||
              (previewResult.targetCents > 0 &&
                previewResult.currentCents >= previewResult.targetCents);

            updatePublicShareMutation.mutate({
              id: compositionShare.id,
              payload: {
                ...currentPayload,
                composition_config: newConfig,
                current_cents: previewResult.currentCents,
                status: isNowCompleted
                  ? "completed"
                  : currentPayload.status === "completed"
                    ? "active"
                    : (currentPayload.status ?? "active"),
              },
            });
            pushToast({
              title: "Termômetro patrimonial sincronizado!",
              description: "O saldo em conta e os investimentos foram vinculados à meta com sucesso.",
              variant: "success",
            });
            setCompositionShare(null);
          }}
        />
      ) : null}

      <CategoryFormDialog
        category={editingCategory}
        defaultType={tab === "limits" ? "expense" : "income"}
        open={categoryFormOpen}
        onOpenChange={(next) => {
          setCategoryFormOpen(next);
          if (!next) setEditingCategory(null);
        }}
        siblings={editingCategory ? siblings : undefined}
        usage={editingCategory ? (usageQuery.data ?? null) : undefined}
      />

      <ConfirmDialog
        open={reallocateOpen}
        onOpenChange={setReallocateOpen}
        title="Aplicar realocação de limite?"
        description={
          suggestion && fromCategory && toCategory
            ? `Transferir ${formatCentsAsBRL(suggestion.amountCents)} da folga de ${fromCategory.name} para cobrir o limite de ${toCategory.name} (mês ${month}).`
            : undefined
        }
        confirmLabel={reallocate.isPending ? "Aplicando…" : "Aplicar"}
        confirmPending={reallocate.isPending}
        onConfirm={() => void applyReallocation()}
      >
        {reallocateError ? (
          <div className="mt-4">
            <Alert variant="error">{reallocateError}</Alert>
          </div>
        ) : null}
      </ConfirmDialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(p) => {
          setUpgradeOpen(false);
          navigate(buildCheckoutUrl({ plan: p }));
        }}
      />

      <BudgetAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        month={month}
        categories={adjustCategories}
      />
    </div>
  );
}

