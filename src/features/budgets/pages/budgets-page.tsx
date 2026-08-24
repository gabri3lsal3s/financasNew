import { useState } from "react";
import { ArrowRight, Edit3, PiggyBank, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon, MonthPicker } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import {
  budgetLimitsByCategory,
  incomeGoalStatus,
  INCOME_GOAL_LABELS,
  isInheritedLimit,
  reallocationSuggestion,
  resolveEffectiveLimit,
  spentByCategoryMap,
} from "@/domain/budgets";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { triggerHaptic } from "@/services/haptics";
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
  useReallocateBudget,
} from "@/state";
import { LimitDialog } from "@/features/budgets/components/limit-dialog";
import { IncomeGoalDialog } from "@/features/budgets/components/income-goal-dialog";
import { CategoryFormDialog } from "@/features/categories/components/category-form-dialog";
import type { Category } from "@/types";

/** Categorias & Orçamentos (§3.5.2) e metas de renda (§3.5.3) — Opção C unificada. */
export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<"limits" | "goals">("limits");
  const [limitFor, setLimitFor] = useState<Category | null>(null);
  const [goalFor, setGoalFor] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);

  const budgetsQuery = useBudgets();
  const goalsQuery = useIncomeGoals();
  const allCategoriesQuery = useAllCategories();
  const expenseCategories = useCategories("expense");
  const incomeCategories = useCategories("income");
  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);
  const usageQuery = useCategoryUsage(editingCategory ? editingCategory.id : null);

  const reallocate = useReallocateBudget();

  const error = budgetsQuery.error ?? goalsQuery.error ?? expensesQuery.error ?? incomesQuery.error ?? allCategoriesQuery.error;

  const budgets = budgetsQuery.data ?? [];

  // Limites agrupados por categoria: cada uma herda APENAS do próprio histórico.
  const limitsByCategory = budgetLimitsByCategory(budgets);

  const totalExpensesCents = (expensesQuery.data ?? []).reduce((acc, e) => acc + numberToCents(e.value * e.report_weight), 0);
  const totalIncomesCents = (incomesQuery.data ?? []).reduce((acc, i) => acc + numberToCents(i.value * i.report_weight), 0);

  const spentByCategory = spentByCategoryMap(expensesQuery.data ?? []);
  const realizedByCategory = new Map<string, number>();
  for (const income of incomesQuery.data ?? []) {
    realizedByCategory.set(income.category_id, (realizedByCategory.get(income.category_id) ?? 0) + numberToCents(income.value * income.report_weight));
  }

  const categories = expenseCategories.data ?? [];
  const allCategories = allCategoriesQuery.data ?? [];
  const siblings = allCategories.filter(
    (c) => c.type === (editingCategory?.type ?? (tab === "limits" ? "expense" : "income")) && c.id !== editingCategory?.id,
  );

  // Categorias de despesa com limite ou gasto
  const allExpenseRows = categories.map((category) => {
    const ownHistory = limitsByCategory.get(category.id) ?? [];
    return {
      category,
      limitCents: resolveEffectiveLimit(ownHistory, month),
      spentCents: spentByCategory.get(category.id) ?? 0,
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

  const rows = showAllCategories ? allExpenseRows : activeRows;

  const totalLimitsCents = activeRows.reduce((acc, row) => acc + row.limitCents, 0);

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

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormOpen(true);
  };

  const renderLimitsContent = () => (
    <div className="flex flex-col gap-6">
      <MonthPicker value={month} onValueChange={setMonth} />

      {/* Resumo do Orçamento Geral (§3.5.2) — Régua de 3 Métricas */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border">
        <div className="grid grid-cols-3 gap-2 text-left">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Total Gasto</p>
            <MoneyText
              cents={totalExpensesCents}
              tone="default"
              animated
              className="text-base sm:text-lg font-bold text-foreground truncate block mt-0.5"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">Teto Planejado</p>
            <MoneyText
              cents={totalLimitsCents}
              tone="default"
              animated
              className="text-base sm:text-lg font-semibold text-muted-foreground truncate block mt-0.5"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              {totalLimitsCents >= totalExpensesCents ? "Disponível" : "Excedido"}
            </p>
            <MoneyText
              cents={Math.abs(totalLimitsCents - totalExpensesCents)}
              tone={totalLimitsCents >= totalExpensesCents ? "positive" : "negative"}
              animated
              className="text-base sm:text-lg font-bold truncate block mt-0.5"
            />
          </div>
        </div>
      </div>

      {/* Recomendação de realocação inteligente (§3.5.2) */}
      {suggestion && fromCategory && toCategory ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary-strong">
              <Sparkles className="size-4" aria-hidden="true" />
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
            onClick={() => setReallocateOpen(true)}
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
          description="Defina um limite mensal por categoria de despesa para acompanhar os gastos ou crie uma nova categoria."
          action={
            <Button size="sm" onClick={handleOpenCreateCategory}>
              <Plus className="size-4" aria-hidden="true" />
              Nova categoria
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            return (
              <div
                key={row.category.id}
                className="group flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0"
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar limite de ${row.category.name}`}
                    onClick={() => {
                      triggerHaptic("light");
                      setLimitFor(row.category);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        triggerHaptic("light");
                        setLimitFor(row.category);
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
                  >
                    <CategoryIcon icon={row.category.icon} color={row.category.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {row.category.name}
                        </p>
                        {row.inherited ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            herdado
                          </span>
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
                    triggerHaptic("light");
                    setLimitFor(row.category);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      triggerHaptic("light");
                      setLimitFor(row.category);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
                </div>
              </div>
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

  const renderGoalsContent = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Defina a expectativa mensal por categoria de renda para comparar com os recebimentos realizados.
        </p>
      </div>

      {(incomeCategories.data ?? []).length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" aria-hidden="true" />}
          title="Sem categorias de renda"
          description="Crie categorias de renda para definir metas mensais."
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

            return (
              <div
                key={category.id}
                className="group flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-border hover:bg-surface min-w-0"
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar meta de renda de ${category.name}`}
                    onClick={() => {
                      triggerHaptic("light");
                      setGoalFor(category);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        triggerHaptic("light");
                        setGoalFor(category);
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
                  >
                    <CategoryIcon icon={category.icon} color={category.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {category.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={expectedCents === 0 ? "muted" : status === "deficit" ? "critical" : "positive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {expectedCents > 0 ? INCOME_GOAL_LABELS[status] : "Sem meta"}
                    </Badge>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label={`Editar cadastro de ${category.name}`}
                      title={`Editar cadastro de ${category.name}`}
                      onClick={() => handleEditCategory(category)}
                    >
                      <Edit3 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Editar meta de renda de ${category.name}`}
                  onClick={() => {
                    triggerHaptic("light");
                    setGoalFor(category);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      triggerHaptic("light");
                      setGoalFor(category);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>Realizado:</span>
                      <MoneyText cents={realizedCents} tone="default" className="font-semibold text-foreground" />
                      {expectedCents > 0 ? (
                        <>
                          <span>de</span>
                          <MoneyText cents={expectedCents} tone="default" />
                        </>
                      ) : null}
                    </span>
                    {expectedCents > 0 ? (
                      <span className="num font-medium">{Math.round(percent)}%</span>
                    ) : (
                      <span className="text-[11px] text-primary hover:underline">Toque para definir</span>
                    )}
                  </div>

                  <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/70">
                    <div
                      className={`h-full transition-all duration-300 ${
                        expectedCents === 0
                          ? "bg-muted"
                          : status === "on_track"
                            ? "bg-positive"
                            : status === "surplus"
                              ? "bg-positive-strong"
                              : "bg-warning"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Categorias
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gestão de categorias, limites de gastos e expectativas de renda
          </p>
        </div>
        <Button
          size="sm"
          aria-label="Nova categoria"
          onClick={handleOpenCreateCategory}
          className="shrink-0 self-start sm:self-auto gap-1.5"
        >
          <Plus aria-hidden="true" className="size-4" />
          <span>Nova categoria</span>
        </Button>
      </header>

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "limits" | "goals")}
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
            label: "Rendas",
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            content: renderGoalsContent(),
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
    </div>
  );
}

