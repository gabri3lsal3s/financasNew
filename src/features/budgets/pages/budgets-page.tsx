import { useState } from "react";
import { ArrowRight, Pencil, PiggyBank, Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, MoneyInput, Progress, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon, MonthPicker } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import {
  BUDGET_STATUS_LABELS,
  budgetStatus,
  globalUsedPercent,
  incomeGoalStatus,
  INCOME_GOAL_LABELS,
  isInheritedLimit,
  progressTone,
  reallocationSuggestion,
  resolveEffectiveLimit,
} from "@/domain/budgets";
import { currentMonth } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";
import { useBudgets, useCategories, useExpenses, useIncomeGoals, useIncomes, useReallocateBudget, useSetIncomeGoal, useRemoveIncomeGoal } from "@/state";
import { LimitDialog } from "@/features/budgets/components/limit-dialog";
import type { Category } from "@/types";

const toCents = (value: number) => Math.round(value * 100);

/** Orçamentos (§3.5.2) e metas de renda (§3.5.3). */
export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<"limits" | "goals">("limits");
  const [limitFor, setLimitFor] = useState<Category | null>(null);
  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);

  const budgetsQuery = useBudgets();
  const goalsQuery = useIncomeGoals();
  const expenseCategories = useCategories("expense");
  const incomeCategories = useCategories("income");
  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);

  const reallocate = useReallocateBudget();

  const error = budgetsQuery.error ?? goalsQuery.error ?? expensesQuery.error ?? incomesQuery.error;

  const budgets = budgetsQuery.data ?? [];

  // Limites agrupados por categoria: cada uma herda APENAS do próprio histórico.
  const limitsByCategory = new Map<string, { month: string; limitCents: number }[]>();
  for (const budget of budgets) {
    const list = limitsByCategory.get(budget.category_id) ?? [];
    list.push({ month: budget.month, limitCents: toCents(budget.limit) });
    limitsByCategory.set(budget.category_id, list);
  }

  const totalExpensesCents = (expensesQuery.data ?? []).reduce((acc, e) => acc + toCents(e.value * e.report_weight), 0);
  const totalIncomesCents = (incomesQuery.data ?? []).reduce((acc, i) => acc + toCents(i.value * i.report_weight), 0);

  const spentByCategory = new Map<string, number>();
  for (const expense of expensesQuery.data ?? []) {
    spentByCategory.set(expense.category_id, (spentByCategory.get(expense.category_id) ?? 0) + toCents(expense.value * expense.report_weight));
  }
  const realizedByCategory = new Map<string, number>();
  for (const income of incomesQuery.data ?? []) {
    realizedByCategory.set(income.category_id, (realizedByCategory.get(income.category_id) ?? 0) + toCents(income.value * income.report_weight));
  }

  const categories = expenseCategories.data ?? [];

  // Categorias de despesa visíveis: com limite efetivo (herdado ou próprio)
  // OU gasto no mês — sem limite definido, a linha aparece para o usuário
  // poder criar o orçamento ali mesmo.
  const rows = categories
    .map((category) => {
      const ownHistory = limitsByCategory.get(category.id) ?? [];
      return {
        category,
        limitCents: resolveEffectiveLimit(ownHistory, month),
        spentCents: spentByCategory.get(category.id) ?? 0,
        inherited: isInheritedLimit(ownHistory, month),
      };
    })
    .filter((row) => row.limitCents > 0 || row.spentCents > 0);

  const totalLimitsCents = rows.reduce((acc, row) => acc + row.limitCents, 0);
  const globalPercent = globalUsedPercent(totalExpensesCents, totalLimitsCents, totalIncomesCents);

  // Realocação opera sobre limites ARMAZENADOS no mês (o RPC lê do banco) —
  // categorias com limite só herdado ficam de fora (origem não teria valor a reduzir).
  const storedLimitsByCategory = new Map<string, number>();
  for (const budget of budgets) {
    if (budget.month === month) storedLimitsByCategory.set(budget.category_id, toCents(budget.limit));
  }
  const suggestion = reallocationSuggestion(
    rows.map((row) => ({
      categoryId: row.category.id,
      limitCents: storedLimitsByCategory.get(row.category.id) ?? 0,
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
    if (goal.month === month) goalsByCategory.set(goal.category_id, toCents(goal.expected));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: abas + seletor de mês direto; título apenas p/ leitores de tela. */}
      <h1 className="sr-only">Orçamentos</h1>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "limits" | "goals")}
        items={[
          { value: "limits", label: "Limites de despesa", content: null },
          { value: "goals", label: "Metas de renda", content: null },
        ]}
      />

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {tab === "limits" ? (
        <>
          <MonthPicker value={month} onValueChange={setMonth} />

          {/* KPIs (§3.5.2) */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total de limites do mês</p>
                <MoneyText cents={totalLimitsCents} variant="hero" className="mt-1" />
              </div>
              <p className="num text-sm font-medium text-muted-foreground">{Math.round(globalPercent)}% usado</p>
            </div>
            <Progress value={globalPercent} tone={progressTone(globalPercent)} aria-label={`Uso global: ${Math.round(globalPercent)}%`} />
          </div>

          {budgetsQuery.isLoading || expensesQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="size-6" aria-hidden="true" />}
              title="Nenhum orçamento"
              description="Defina um limite mensal por categoria de despesa para acompanhar os gastos."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row) => {
                const status = budgetStatus(row.spentCents, row.limitCents);
                return (
                  <div key={row.category.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <CategoryIcon icon={row.category.icon} color={row.category.color} />
                        <p className="truncate text-sm font-medium text-foreground min-w-0">{row.category.name}</p>
                        {row.inherited ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">herdado</span>
                        ) : null}
                        {row.limitCents > 0 ? (
                          <span className={`shrink-0 text-[10px] font-medium ${status === "exceeded" ? "text-critical" : "text-muted-foreground"}`}>
                            {BUDGET_STATUS_LABELS[status]}
                          </span>
                        ) : null}
                      </div>
                      <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      aria-label={`Editar limite de ${row.category.name}`}
                      onClick={() => setLimitFor(row.category)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recomendação de realocação (§3.5.2) */}
          {suggestion && fromCategory && toCategory ? (
            <div className="flex flex-col gap-3 rounded-xl border border-attention/40 bg-attention/5 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Realocação sugerida</p>
                  <p className="mt-0.5 text-muted-foreground">
                    <span className="font-medium text-critical">{fromCategory.name}</span> excedeu o limite. Transfira{" "}
                    <MoneyText cents={suggestion.amountCents} tone="default" /> de limite para{" "}
                    <span className="font-medium text-positive-strong">{toCategory.name}</span>, que tem folga.
                  </p>
                </div>
              </div>
              <div>
                <Button size="sm" variant="outline" onClick={() => setReallocateOpen(true)}>
                  <ArrowRight aria-hidden="true" />
                  Aplicar realocação
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        /* Aba Metas de renda (§3.5.3) */
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Defina a expectativa mensal por categoria de renda para comparar o realizado.
          </p>
          {(incomeCategories.data ?? []).length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="size-6" aria-hidden="true" />}
              title="Sem categorias de renda"
              description="Crie categorias de renda para definir metas."
            />
          ) : (
            (incomeCategories.data ?? []).map((category) => {
              const realizedCents = realizedByCategory.get(category.id) ?? 0;
              const expectedCents = goalsByCategory.get(category.id) ?? 0;
              const status = incomeGoalStatus(realizedCents, expectedCents);
              return (
                <IncomeGoalRow
                  key={category.id}
                  category={category}
                  month={month}
                  realizedCents={realizedCents}
                  expectedCents={expectedCents}
                  statusLabel={expectedCents > 0 ? INCOME_GOAL_LABELS[status] : "Sem meta"}
                  deficit={status === "deficit"}
                />
              );
            })
          )}
        </div>
      )}

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
        />
      ) : null}

      <ConfirmDialog
        open={reallocateOpen}
        onOpenChange={setReallocateOpen}
        title="Aplicar realocação?"
        description={
          suggestion && fromCategory && toCategory
            ? `Transferir ${formatCentsAsBRL(suggestion.amountCents)} do limite de ${fromCategory.name} para ${toCategory.name} (mês ${month}).`
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

function IncomeGoalRow({
  category,
  month,
  realizedCents,
  expectedCents,
  statusLabel,
  deficit,
}: {
  category: Category;
  month: string;
  realizedCents: number;
  expectedCents: number;
  statusLabel: string;
  deficit: boolean;
}) {
  const [cents, setCents] = useState(0);
  const [saved, setSaved] = useState(false);
  const setGoal = useSetIncomeGoal();
  const removeGoal = useRemoveIncomeGoal();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryIcon icon={category.icon} color={category.color} />
          <p className="truncate text-sm font-medium text-foreground min-w-0">{category.name}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${deficit ? "text-critical" : expectedCents > 0 ? "text-positive-strong" : "text-muted-foreground"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 min-w-0">
        <p className="num text-sm text-muted-foreground min-w-0">
          Realizado: <MoneyText cents={realizedCents} tone="default" />
          {expectedCents > 0 ? (
            <>
              {" "}· Meta: <MoneyText cents={expectedCents} tone="default" />
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <MoneyInput
            className="w-full sm:w-40"
            cents={cents}
            onCentsChange={setCents}
            aria-label={`Meta de renda de ${category.name}`}
            placeholder="Definir meta"
          />
          <Button
            type="button"
            size="sm"
            disabled={cents <= 0 || setGoal.isPending}
            onClick={() =>
              void (async () => {
                await setGoal.mutateAsync({ categoryId: category.id, month, expected: cents / 100 });
                setCents(0);
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2000);
              })()
            }
          >
            {saved ? "Salva" : "Salvar"}
          </Button>
          {expectedCents > 0 ? (
            <Button type="button" size="icon" variant="ghost" aria-label={`Remover meta de ${category.name}`} onClick={() => void removeGoal.mutateAsync({ categoryId: category.id, month })}>
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
