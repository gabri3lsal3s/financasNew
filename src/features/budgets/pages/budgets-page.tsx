import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Edit3, HelpCircle, Info, PiggyBank, Plus, SlidersHorizontal, Sparkles, Target, TrendingDown, User, Users } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Popover, PopoverContent, PopoverTrigger, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon, MonthPicker, ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import { HighlightRow } from "@/components/modules/highlight-row";
import { useCreateDeepLink } from "@/hooks";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import {
  budgetLimitsByCategory,
  incomeGoalStatus,
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
  CategoryFormDialog,
  IncomeGoalDialog,
  LimitDialog,
  type BudgetAdjustCategoryItem,
} from "@/features/budgets/components";
import {
  AddContributionDialog,
  CampaignCard,
  GoalCard,
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

  const renderLimitsContent = () => (
    <div className="flex flex-col gap-6">
      {/* Linha do seletor de mês — full-width, padrão das outras páginas */}
      <MonthPicker value={month} onValueChange={setMonth} />

      {/* Linha de controles: descrição + alternador de métrica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
          Acompanhe os gastos por categoria e defina o teto mensal.
        </p>

        {/* Alternância de Métrica estilo pills (padrão Insights) */}
        <div role="group" aria-label="Modo de cálculo dos gastos" className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant={spendMetric === "personal" ? "default" : "outline"}
            onClick={() => setSpendMetric("personal")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
              spendMetric === "personal" ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={spendMetric === "personal"}
            title="Considera apenas a sua participação pessoal efetiva nas compras (com rateios e reembolsos)"
            sensoryIntent="selection"
          >
            <User className="size-3.5" aria-hidden="true" />
            <span>Minha Parte</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={spendMetric === "household" ? "default" : "outline"}
            onClick={() => setSpendMetric("household")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
              spendMetric === "household" ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={spendMetric === "household"}
            title="Considera o valor bruto total nominal das compras (100% de cada despesa, sem rateios)"
            sensoryIntent="selection"
          >
            <Users className="size-3.5" aria-hidden="true" />
            <span>Total Bruto</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="Informações sobre os modos de visualização"
                title="Informações sobre os modos de visualização"
              >
                <HelpCircle className="size-3.5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 text-xs">
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-foreground">Modos de Visualização do Orçamento</p>
                <div className="flex flex-col gap-1.5 text-muted-foreground text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-foreground font-medium">Minha Parte (Ponderado):</strong> Considera exclusivamente a sua cota ou responsabilidade pessoal nos gastos compartilhados (despesas com taxa de rateio menor que 100% ou reembolsos). Ideal para o controle do seu consumo individual.
                  </p>
                  <p>
                    <strong className="text-foreground font-medium">Total Bruto (Nominal):</strong> Considera 100% do valor nominal de cada compra, mesmo quando rateada com terceiros. Ideal para o controle do orçamento global de todas as despesas.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Resumo do Orçamento Geral (§3.5.2) — Régua de 3 Métricas */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border" data-tour="budgets-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Total Gasto</p>
              <Badge variant="muted" size="xs">
                {spendMetric === "personal" ? "Minha Parte" : "Total Bruto"}
              </Badge>
              {totalExpensesGrossCents !== totalExpensesWeightedCents && (
                <span
                  className="text-muted-foreground/80 hover:text-foreground cursor-help"
                  title={
                    spendMetric === "personal"
                      ? `Total nominal bruto das despesas: ${formatCentsAsBRL(totalExpensesGrossCents)}`
                      : `Sua parte proporcional líquida: ${formatCentsAsBRL(totalExpensesWeightedCents)}`
                  }
                >
                  <Info className="size-3 inline" aria-hidden="true" />
                </span>
              )}
            </div>
            <MoneyText
              cents={hasBudgetLimits ? totalBudgetedExpensesCents : totalExpensesCents}
              tone="default"
              animated
              className="text-base sm:text-lg font-bold text-foreground whitespace-nowrap tabular-nums block mt-0.5"
            />
            {hasPartialBudgets && (
              <span className="text-[10px] text-muted-foreground truncate block">
                de {formatCentsAsBRL(totalExpensesCents)} gastos no total do mês
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Teto Planejado</p>
              {!hasBudgetLimits && (
                <Badge variant="muted" size="xs">
                  Sem limites
                </Badge>
              )}
            </div>
            {hasBudgetLimits ? (
              <MoneyText
                cents={totalLimitsCents}
                tone="default"
                animated
                className="text-base sm:text-lg font-semibold text-muted-foreground whitespace-nowrap tabular-nums block mt-0.5"
              />
            ) : (
              <span className="text-base sm:text-lg font-semibold text-muted-foreground tabular-nums block mt-0.5">
                —
              </span>
            )}
            {!hasBudgetLimits && (
              <span className="text-[10px] text-muted-foreground truncate block">
                Nenhum limite ativo no mês
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              {hasBudgetLimits
                ? totalLimitsCents >= totalBudgetedExpensesCents
                  ? "Disponível no Teto"
                  : "Excedido no Teto"
                : "Status do Mês"}
            </p>
            {hasBudgetLimits ? (
              <MoneyText
                cents={Math.abs(totalLimitsCents - totalBudgetedExpensesCents)}
                tone={totalLimitsCents >= totalBudgetedExpensesCents ? "positive" : "negative"}
                animated
                className="text-base sm:text-lg font-bold whitespace-nowrap tabular-nums block mt-0.5"
              />
            ) : (
              <span className="text-base sm:text-lg font-semibold text-muted-foreground whitespace-nowrap block mt-0.5">
                Livre de teto
              </span>
            )}
            {hasBudgetLimits && hasPartialBudgets && (
              <span className="text-[10px] text-muted-foreground truncate block">
                {budgetedRows.length} de {categories.length} categorias orçadas
              </span>
            )}
          </div>
        </div>

        {hasBudgetLimits ? (
          <div className="mt-3.5 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Consumo do Teto ({spendMetric === "personal" ? "Minha Parte" : "Total Bruto"})</span>
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round((totalBudgetedExpensesCents / totalLimitsCents) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                className={
                  totalBudgetedExpensesCents > totalLimitsCents
                    ? "h-full rounded-full transition-all duration-300 bg-critical"
                    : totalBudgetedExpensesCents / totalLimitsCents >= 0.85
                      ? "h-full rounded-full transition-all duration-300 bg-warning"
                      : "h-full rounded-full transition-all duration-300 bg-primary"
                }
                style={{ width: `${Math.min(100, (totalBudgetedExpensesCents / totalLimitsCents) * 100)}%` }}
              />
            </div>
            {hasPartialBudgets && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Despesas em categorias livres (sem teto): <MoneyText cents={totalUnbudgetedExpensesCents} tone="default" className="font-medium text-foreground" />
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
            <span>Você não possui tetos de gastos configurados para este mês. Todas as suas categorias estão livres de limites.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAdjustBudget}
              className="text-xs shrink-0 self-start sm:self-auto h-8 gap-1.5"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span>Definir limites</span>
            </Button>
          </div>
        )}
      </div>


      {/* Recomendação de realocação inteligente (§3.5.2) */}
      {suggestion && fromCategory && toCategory ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </span>
            <div className="text-sm min-w-0">
              <p className="font-semibold text-foreground">Sugestão de Realocação de Limite</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                <span className="font-medium text-positive-strong">{fromCategory.name}</span> possui folga.
                Transfira <MoneyText cents={suggestion.amountCents} tone="default" className="font-semibold text-foreground" /> de
                limite para cobrir os gastos de <span className="font-medium text-critical">{toCategory.name}</span>.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenReallocate}
            className="shrink-0 self-start sm:self-auto gap-1.5 border-primary/30 hover:bg-primary/10"
          >
            <span>Aplicar realocação</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {budgetsQuery.isLoading || expensesQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" aria-hidden="true" />}
          title="Nenhum orçamento configurado"
          description={
            categories.length > 0
              ? "Você já possui categorias criadas. Ative a visualização de categorias para definir o teto mensal de cada uma."
              : "Defina um limite mensal por categoria de despesa para acompanhar os gastos ou crie uma nova categoria."
          }
          action={
            categories.length > 0 ? (
              <Button
                size="sm"
                onClick={() => setShowAllCategories(true)}
                className="gap-1.5 cursor-pointer"
              >
                <Target className="size-4" aria-hidden="true" />
                Definir limites por categoria
              </Button>
            ) : (
              <Button size="sm" onClick={handleOpenCreateCategory} className="gap-1.5 cursor-pointer">
                <Plus className="size-4" aria-hidden="true" />
                Nova categoria
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            return (
              <HighlightRow
                key={row.category.id}
                highlightId={effectiveHighlightId}
                id={row.category.id}
                className="rounded-xl"
              >
                <div
                  className="group flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Editar limite de ${row.category.name}`}
                      onClick={() => {
                        triggerSensory("action");
                        handleOpenLimit(row.category);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          triggerSensory("action");
                          handleOpenLimit(row.category);
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
                    >
                      <CategoryIcon icon={row.category.icon} color={row.category.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {row.category.name}
                          </p>
                          {row.inherited ? (
                            <Badge variant="muted" size="xs">
                              herdado
                            </Badge>
                          ) : null}
                          {row.hasSplitDifference ? (
                            <Badge
                              variant="muted"
                              size="xs"
                              className="text-muted-foreground font-normal"
                              title={
                                spendMetric === "personal"
                                  ? `Total bruto das despesas: ${formatCentsAsBRL(row.spentGrossCents)}`
                                  : `Sua parte proporcional: ${formatCentsAsBRL(row.spentWeightedCents)}`
                              }
                            >
                              {spendMetric === "personal" ? (
                                <span>Total bruto: <MoneyText cents={row.spentGrossCents} tone="default" /></span>
                              ) : (
                                <span>Sua parte: <MoneyText cents={row.spentWeightedCents} tone="default" /></span>
                              )}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Editar cadastro de ${row.category.name}`}
                        title={`Editar cadastro de ${row.category.name}`}
                        onClick={() => handleEditCategory(row.category)}
                      >
                        <Edit3 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar limite de ${row.category.name}`}
                    onClick={() => {
                      triggerSensory("action");
                      handleOpenLimit(row.category);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        triggerSensory("action");
                        handleOpenLimit(row.category);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
                  </div>
                </div>
              </HighlightRow>
            );
          })}

          {unbudgetedRows.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllCategories((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllCategories
                  ? "Ocultar categorias sem limite ou gasto no mês"
                  : `Ver outras ${unbudgetedRows.length} categorias cadastradas`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderGoalsContent = () => {
    const allGoalShares = goalSharesQuery.data ?? [];
    const standaloneCampaigns = allGoalShares.filter((s) => !s.payload?.category_id);
    const activeCampaigns = standaloneCampaigns.filter((s) => s.payload?.status !== "archived");
    const archivedCampaigns = standaloneCampaigns.filter((s) => s.payload?.status === "archived");

    return (
      <div className="flex flex-col gap-6">
        <MonthPicker value={month} onValueChange={setMonth} />

        {/* Banner de Metas & Campanhas Coletivas */}
        <div
          data-tour="shared-goals-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
              <Target className="size-4.5" aria-hidden="true" />
            </span>
            <div className="text-sm min-w-0">
              <p className="font-semibold text-foreground">Metas Financeiras & Termômetro Coletivo</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Crie metas de economia pessoais ou vaquinhas coletivas com link público transparente e chave Pix opcional.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              triggerSensory("action");
              setSharingGoalFor(null);
              setEditingShare(null);
              setEditingShareInitialEdit(false);
              setCreateStandaloneCampaignOpen(true);
            }}
            className="shrink-0 self-start sm:self-auto gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Nova Meta</span>
          </Button>
        </div>

        {/* Seção de Campanhas & Vaquinhas Ativas */}
        {activeCampaigns.length > 0 && (
          <div data-tour="shared-goals-card" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Metas Financeiras</h2>
                <Badge variant="portfolio" size="xs">
                  {activeCampaigns.length} ativa{activeCampaigns.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {activeCampaigns.map((share) => (
                <CampaignCard
                  key={share.id}
                  share={share}
                  liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
                  onOpenDeposit={(s) => setDepositShare(s)}
                  onManageShare={(s) => {
                    setEditingShare(s);
                    setEditingShareInitialEdit(false);
                  }}
                  onEditShare={(s) => {
                    setEditingShare(s);
                    setEditingShareInitialEdit(true);
                  }}
                  onManageContributions={(s) => setManageContributionsShare(s)}
                  onOpenComposition={(s) => setCompositionShare(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Seção de Campanhas Concluídas/Arquivadas */}
        {archivedCampaigns.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowArchivedCampaigns((prev) => !prev)}
              className="self-center text-xs text-muted-foreground hover:text-foreground"
            >
              {showArchivedCampaigns
                ? "Ocultar metas arquivadas"
                : `Ver ${archivedCampaigns.length} meta${archivedCampaigns.length > 1 ? "s" : ""} arquivada${archivedCampaigns.length > 1 ? "s" : ""}`}
            </Button>
            {showArchivedCampaigns && (
              <div className="flex flex-col gap-2.5 opacity-80">
                {archivedCampaigns.map((share) => (
                  <CampaignCard
                    key={share.id}
                    share={share}
                    liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
                    onOpenDeposit={(s) => setDepositShare(s)}
                    onManageShare={(s) => {
                      setEditingShare(s);
                      setEditingShareInitialEdit(false);
                    }}
                    onEditShare={(s) => {
                      setEditingShare(s);
                      setEditingShareInitialEdit(true);
                    }}
                    onManageContributions={(s) => setManageContributionsShare(s)}
                    onOpenComposition={(s) => setCompositionShare(s)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seção de Metas Mensais por Categoria de Renda */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Metas Mensais por Categoria de Renda</h2>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Expectativa mensal por categoria para comparar com recebimentos.
            </p>
          </div>

          {(incomeCategories.data ?? []).length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="size-6" aria-hidden="true" />}
              title="Sem categorias de renda"
              description="Crie categorias de renda para definir metas mensais ou crie uma Meta Coletiva acima."
              action={
                <Button size="sm" onClick={handleOpenCreateCategory}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nova categoria
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {(incomeCategories.data ?? []).map((category) => {
                const realizedCents = realizedByCategory.get(category.id) ?? 0;
                const expectedCents = goalsByCategory.get(category.id) ?? 0;
                const status = incomeGoalStatus(realizedCents, expectedCents);
                const percent = expectedCents > 0 ? Math.min(100, (realizedCents / expectedCents) * 100) : 0;
                const activeShare = (goalSharesQuery.data ?? []).find(
                  (s) =>
                    !s.is_revoked &&
                    (!s.expires_at || new Date(s.expires_at).getTime() > nowMs) &&
                    s.payload?.category_id === category.id,
                );

                return (
                  <GoalCard
                    key={category.id}
                    category={category}
                    month={month}
                    realizedCents={realizedCents}
                    expectedCents={expectedCents}
                    status={status}
                    percent={percent}
                    highlightId={effectiveHighlightId}
                    activeShare={activeShare}
                    onOpenGoal={handleOpenGoal}
                    onEditCategory={handleEditCategory}
                    onShareGoal={(cat) => setSharingGoalFor(cat)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCategoriesContent = () => {
    const userCategories = allCategories.filter((c) => !c.is_reserved);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Catálogo com todas as categorias do sistema e personalizadas.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedCategories}
              disabled={seedCategoriesMutation.isPending}
              className="gap-1.5"
              title="Carrega ou completa as 11 categorias padrão brasileiras sem duplicar as existentes"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              <span>{seedCategoriesMutation.isPending ? "Carregando..." : "Restaurar padrões"}</span>
            </Button>
            <Button size="sm" onClick={handleOpenCreateCategory} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              <span>Nova categoria</span>
            </Button>
          </div>
        </div>

        {seedFeedback && (
          <Alert variant={seedCategoriesMutation.isError ? "error" : "info"}>
            {seedFeedback}
          </Alert>
        )}

        {userCategories.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6 text-muted-foreground" aria-hidden="true" />}
            title="Nenhuma categoria pronta encontrada"
            description="Sua conta ainda não possui categorias de receitas e despesas. Carregue o catálogo pré-pronto oficial com as 11 categorias brasileiras para começar imediatamente."
            action={
              <Button
                size="sm"
                onClick={handleSeedCategories}
                disabled={seedCategoriesMutation.isPending}
                className="gap-1.5"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                <span>{seedCategoriesMutation.isPending ? "Carregando..." : "Carregar categorias pré-prontas"}</span>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allCategories.map((category) => (
              <div
                key={category.id}
                role={category.is_reserved ? undefined : "button"}
                tabIndex={category.is_reserved ? undefined : 0}
                aria-label={category.is_reserved ? undefined : `Editar cadastro de ${category.name}`}
                onClick={() => {
                  if (!category.is_reserved) {
                    triggerSensory("action");
                    handleEditCategory(category);
                  }
                }}
                onKeyDown={(e) => {
                  if (!category.is_reserved && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    triggerSensory("action");
                    handleEditCategory(category);
                  }
                }}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0",
                  !category.is_reserved && "cursor-pointer hover:border-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {category.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {category.type === "income" ? "Receita" : "Despesa"}
                      {category.is_reserved ? " · Sistema" : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Orçamentos
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
            Tetos de gastos mensais, metas de renda e controle de categorias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
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
        </div>
      </header>

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
            content: renderLimitsContent(),
          },
          {
            value: "goals",
            label: "Metas & Campanhas",
            icon: <Target className="size-4" aria-hidden="true" />,
            content: renderGoalsContent(),
          },
          {
            value: "categories",
            label: "Categorias",
            icon: <PiggyBank className="size-4" aria-hidden="true" />,
            content: renderCategoriesContent(),
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
          navigate(`/assinatura?plano=${p}`);
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

