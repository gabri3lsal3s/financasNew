import { useState } from "react";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, Progress, Skeleton } from "@/components/ui";
import { KpiCard, MonthPicker } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import {
  BUDGET_STATUS_LABELS,
  budgetStatus,
  globalUsedPercent,
  isInheritedLimit,
  progressTone,
  reallocationSuggestion,
  resolveEffectiveLimit,
} from "@/domain/budgets";
import { accountsNet, buildDailyFlow, computeOverview, openInvoicesTotal, percentChange } from "@/domain/overview";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useDebts,
  useExpenses,
  useIncomes,
  useReallocateBudget,
} from "@/state";
import { cn } from "@/lib/utils";

const toCents = (value: number) => Math.round(value * 100);

const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
  items.reduce((acc, item) => acc + toCents(item.value * item.report_weight), 0);

const formatPercent = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function DeltaHint({ currentCents, previousCents, invert }: { currentCents: number; previousCents: number; invert?: boolean }) {
  const delta = percentChange(currentCents, previousCents);
  if (delta === null) return null;
  const up = delta >= 0;
  // Para despesas, subir é ruim (invert as cores).
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5", good ? "text-positive-strong" : "text-critical")}>
      <Icon className="size-3" aria-hidden="true" />
      {formatPercent(Math.abs(delta))}%
    </span>
  );
}

/** Visão Consolidada (§3.6) — KPIs, saldo líquido de contas, fluxo diário, orçamentos. */
export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth());
  const previousMonth = shiftMonth(month, -1);

  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(previousMonth);
  const prevExpensesQuery = useExpenses(previousMonth);
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();

  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);
  const reallocate = useReallocateBudget();

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    prevIncomesQuery.isLoading ||
    prevExpensesQuery.isLoading ||
    budgetsQuery.isLoading ||
    debtsQuery.isLoading;
  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    prevIncomesQuery.error ??
    prevExpensesQuery.error ??
    budgetsQuery.error ??
    debtsQuery.error ??
    cardExpensesQuery.error ??
    cardPaymentsQuery.error;

  const incomeCents = weightedSum(incomesQuery.data ?? []);
  const expenseCents = weightedSum(expensesQuery.data ?? []);
  const prevIncomeCents = weightedSum(prevIncomesQuery.data ?? []);
  const prevExpenseCents = weightedSum(prevExpensesQuery.data ?? []);
  const investmentCents = 0; // Carteira na Fase 4.

  const totals = computeOverview(incomeCents, expenseCents, investmentCents);
  const prevTotals = computeOverview(prevIncomeCents, prevExpenseCents, investmentCents);

  // Saldo líquido de Contas (§3.6): pendentes do mês − faturas em aberto.
  const range = { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
  const debts = debtsQuery.data ?? [];
  const receivablePending = debts
    .filter((d) => d.type === "receivable" && d.paid_at === null && d.due_date >= range.start && d.due_date < range.end)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const payablePending = debts
    .filter((d) => d.type === "payable" && d.paid_at === null && d.due_date >= range.start && d.due_date < range.end)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const openInvoices = openInvoicesTotal(cardExpensesQuery.data ?? [], cardPaymentsQuery.data ?? []);
  const accountsBalance = accountsNet(receivablePending, payablePending, openInvoices);

  // Fluxo diário (barras empilhadas).
  const dailyItems = [
    ...(incomesQuery.data ?? []).map((i) => ({ date: i.date, kind: "income" as const, amountCents: toCents(i.value * i.report_weight) })),
    ...(expensesQuery.data ?? []).map((e) => ({ date: e.date, kind: "expense" as const, amountCents: toCents(e.value * e.report_weight) })),
  ];
  const dailyFlow = buildDailyFlow(month, dailyItems);

  // Orçamentos compactos (§3.6): progresso, lista de atenção e realocação.
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = new Map<string, { month: string; limitCents: number }[]>();
  for (const budget of budgets) {
    const list = limitsByCategory.get(budget.category_id) ?? [];
    list.push({ month: budget.month, limitCents: toCents(budget.limit) });
    limitsByCategory.set(budget.category_id, list);
  }
  const spentByCategory = new Map<string, number>();
  for (const expense of expensesQuery.data ?? []) {
    spentByCategory.set(expense.category_id, (spentByCategory.get(expense.category_id) ?? 0) + toCents(expense.value * expense.report_weight));
  }
  const budgetRows = (expenseCategories.data ?? [])
    .map((category) => ({
      category,
      limitCents: resolveEffectiveLimit(limitsByCategory.get(category.id) ?? [], month),
      spentCents: spentByCategory.get(category.id) ?? 0,
      inherited: isInheritedLimit(limitsByCategory.get(category.id) ?? [], month),
    }))
    .filter((row) => row.limitCents > 0);
  const totalLimitsCents = budgetRows.reduce((acc, row) => acc + row.limitCents, 0);
  const globalPercent = globalUsedPercent(expenseCents, totalLimitsCents, incomeCents);
  const attentionRows = budgetRows
    .map((row) => ({ ...row, status: budgetStatus(row.spentCents, row.limitCents) }))
    .filter((row) => row.status !== "ok")
    .sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents);

  const storedLimitsByCategory = new Map<string, number>();
  for (const budget of budgets) {
    if (budget.month === month) storedLimitsByCategory.set(budget.category_id, toCents(budget.limit));
  }
  const suggestion = reallocationSuggestion(
    budgetRows.map((row) => ({
      categoryId: row.category.id,
      limitCents: storedLimitsByCategory.get(row.category.id) ?? 0,
      spentCents: row.spentCents,
    })),
  );
  const suggestionFrom = suggestion ? (expenseCategories.data ?? []).find((c) => c.id === suggestion.fromCategoryId) : undefined;
  const suggestionTo = suggestion ? (expenseCategories.data ?? []).find((c) => c.id === suggestion.toCategoryId) : undefined;

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Visão Geral</h1>
      </header>

      <MonthPicker value={month} onValueChange={setMonth} />

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs fundamentais (§3.6) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Receitas"
              value={formatCentsAsBRL(totals.incomeCents)}
              tone="positive"
              hint={<DeltaHint currentCents={totals.incomeCents} previousCents={prevTotals.incomeCents} />}
            />
            <KpiCard
              label="Despesas"
              value={formatCentsAsBRL(totals.expenseCents)}
              tone="negative"
              hint={<DeltaHint currentCents={totals.expenseCents} previousCents={prevTotals.expenseCents} invert />}
            />
            <KpiCard label="Investimentos" value={formatCentsAsBRL(totals.investmentCents)} tone="portfolio" hint="Carteira na Fase 4" />
            <KpiCard
              label="Saldo do mês"
              value={formatCentsAsBRL(totals.balanceCents)}
              tone={totals.balanceCents >= 0 ? "positive" : "negative"}
            />
          </div>

          {/* Taxa de poupança */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Taxa de poupança</p>
              <p className={cn("num mt-1 text-2xl font-semibold", totals.savingsRatePercent >= 20 ? "text-positive-strong" : totals.savingsRatePercent >= 0 ? "text-foreground" : "text-critical")}>
                {formatPercent(totals.savingsRatePercent)}%
              </p>
            </div>
            <p className="max-w-[12rem] text-right text-xs text-muted-foreground">
              {totals.savingsRatePercent >= 20 ? "Poupança saudável (≥20% da renda) 🎉" : totals.savingsRatePercent >= 0 ? "Saldo positivo neste mês." : "Saldo negativo: revise os gastos."}
            </p>
          </div>

          {/* Saldo líquido de Contas (§3.6) */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Saldo líquido de contas</p>
              <p className={cn("num text-xl font-semibold", accountsBalance >= 0 ? "text-positive-strong" : "text-critical")}>
                {formatCentsAsBRL(accountsBalance)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              A receber {formatCentsAsBRL(receivablePending)} · A pagar {formatCentsAsBRL(payablePending)} · Faturas em aberto{" "}
              {formatCentsAsBRL(openInvoices)}
            </p>
          </div>

          {/* Fluxo diário (§3.6) — barras empilhadas */}
          <section aria-label="Fluxo diário" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Fluxo diário</h2>
              <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
            </div>
            <div className="flex h-24 items-end gap-px overflow-x-auto">
              {dailyFlow.map((day) => {
                const dayTotal = day.incomeCents + day.expenseCents + day.investmentCents;
                if (dayTotal === 0) {
                  return <div key={day.day} className="h-full flex-1 rounded-t bg-muted/40" title={day.day} />;
                }
                const scale = day.maxCents > 0 ? day.maxCents : 1;
                return (
                  <div key={day.day} className="flex h-full flex-1 flex-col justify-end gap-px" title={`${day.day} — ${formatCentsAsBRL(dayTotal)}`}>
                    {day.expenseCents > 0 ? (
                      <div className="w-full rounded-t-sm bg-negative-strong/80" style={{ height: `${Math.max(8, (day.expenseCents / scale) * 100)}%` }} />
                    ) : null}
                    {day.incomeCents > 0 ? (
                      <div className="w-full rounded-t-sm bg-positive-strong/80" style={{ height: `${Math.max(8, (day.incomeCents / scale) * 100)}%` }} />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>1</span>
              <span>{Math.floor((dailyFlow.length + 1) / 2)}</span>
              <span>{dailyFlow.length}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-positive-strong/80" /> Receitas
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-negative-strong/80" /> Despesas
              </span>
            </div>
          </section>

          {/* Orçamentos (§3.6): progresso + atenção + realocação */}
          <section aria-label="Orçamentos" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Orçamentos</h2>
              <p className="num text-xs text-muted-foreground">
                {Math.round(globalPercent)}% de {formatCentsAsBRL(totalLimitsCents)}
              </p>
            </div>
            <Progress value={globalPercent} tone={progressTone(globalPercent)} aria-label={`Uso global de limites: ${Math.round(globalPercent)}%`} />

            {attentionRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma categoria excedeu o limite. 👍</p>
            ) : (
              <div className="flex flex-col gap-3">
                {attentionRows.slice(0, 3).map((row) => (
                  <div key={row.category.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{row.category.name}</span>
                      <span className="text-critical">{BUDGET_STATUS_LABELS[row.status]}</span>
                    </div>
                    <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
                  </div>
                ))}
                {attentionRows.length > 3 ? (
                  <p className="text-xs text-muted-foreground">+{attentionRows.length - 3} outra(s) na atenção.</p>
                ) : null}
              </div>
            )}

            {suggestion && suggestionFrom && suggestionTo ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-attention/40 bg-attention/5 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="size-4 shrink-0 text-attention" aria-hidden="true" />
                  <span className="text-muted-foreground">
                    Transfira <span className="num font-semibold text-foreground">{formatCentsAsBRL(suggestion.amountCents)}</span> de{" "}
                    <span className="font-medium text-critical">{suggestionFrom.name}</span> para{" "}
                    <span className="font-medium text-positive-strong">{suggestionTo.name}</span>.
                  </span>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setReallocateOpen(true)}>
                  <ArrowRight aria-hidden="true" />
                  Aplicar
                </Button>
              </div>
            ) : null}
          </section>

          {(incomesQuery.data ?? []).length === 0 && (expensesQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="Sem lançamentos neste mês"
              description={`Registre receitas e despesas de ${monthLabel(month)} para ver os KPIs aqui.`}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={reallocateOpen}
        onOpenChange={setReallocateOpen}
        title="Aplicar realocação?"
        description={
          suggestion && suggestionFrom && suggestionTo
            ? `Transferir ${formatCentsAsBRL(suggestion.amountCents)} do limite de ${suggestionFrom.name} para ${suggestionTo.name} (mês ${month}).`
            : undefined
        }
        confirmLabel={reallocate.isPending ? "Aplicando…" : "Aplicar realocação"}
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
