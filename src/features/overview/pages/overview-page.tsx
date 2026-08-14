import { useState } from "react";
import { ArrowRight, Inbox, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, Progress, Skeleton } from "@/components/ui";
import {
  CategoryDonut,
  DailyFlowChart,
  KpiCard,
  MonthPicker,
  OnboardingCard,
  SavingsHealthCard,
  SmartAnomaliesCard,
  SmartInvoiceProjectionCard,
  SmartSpendingPaceCard,
} from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import { isOnboardingComplete } from "@/domain/onboarding";
import {
  BUDGET_STATUS_LABELS,
  budgetStatus,
  globalUsedPercent,
  isInheritedLimit,
  progressTone,
  reallocationSuggestion,
  resolveEffectiveLimit,
} from "@/domain/budgets";
import { autoSelectBillMonth, buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { criticalAlerts } from "@/domain/insights/alerts";
import {
  accountsNet,
  buildDailyFlow,
  computeOverview,
  monthlySeries,
  openInvoicesTotal,
  percentChange,
} from "@/domain/overview";
import { dailyBudget, endOfMonthProjection, spendingPace } from "@/domain/projection";
import type { MonthPhase } from "@/domain/projection";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useCreditCards,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useIncomes,
  useIncomesByRange,
  useOnboardingCounts,
  useReallocateBudget,
} from "@/state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";

const toCents = (value: number) => Math.round(value * 100);

const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
  items.reduce((acc, item) => acc + toCents(item.value * item.report_weight), 0);

const formatPercent = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Último dia do mês YYYY-MM. */
function daysInMonthOf(month: string): number {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year ?? 0, monthNum ?? 1, 0).getDate();
}

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

/** Janela dos últimos N meses (antigo → atual) para os sparklines dos KPIs. */
const SPARK_MONTHS = 6;

/** Visão Consolidada (§3.6) + Dashboard de Insights (F8). */
export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth());
  const previousMonth = shiftMonth(month, -1);
  const today = todayISO();
  const currentMonthKey = today.slice(0, 7);
  const phase: MonthPhase = month === currentMonthKey ? "current" : month < currentMonthKey ? "past" : "future";

  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(previousMonth);
  const prevExpensesQuery = useExpenses(previousMonth);
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  const cardsQuery = useCreditCards();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();

  // Série dos últimos meses para os micro-sparklines dos KPIs (F8).
  const sparkStart = shiftMonth(month, -(SPARK_MONTHS - 1));
  const sparkRange = { start: `${sparkStart}-01`, end: `${shiftMonth(month, 1)}-01` };
  const sparkExpensesQuery = useExpensesByRange(sparkRange.start, sparkRange.end);
  const sparkIncomesQuery = useIncomesByRange(sparkRange.start, sparkRange.end);

  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);
  const reallocate = useReallocateBudget();
  const onboardingQuery = useOnboardingCounts();
  const onboardingComplete = onboardingQuery.data ? isOnboardingComplete(onboardingQuery.data) : false;
  const visual = useVisualCustomization();

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

  // Sparklines: totais mensais ponderados dos últimos 6 meses (derivação
  // pura por render — mesmo padrão do restante da página).
  const sparkSeries = monthlySeries(
    [
      ...(sparkIncomesQuery.data ?? []).map((item) => ({
        date: item.date,
        kind: "income" as const,
        amountCents: toCents(item.value * item.report_weight),
      })),
      ...(sparkExpensesQuery.data ?? []).map((item) => ({
        date: item.date,
        kind: "expense" as const,
        amountCents: toCents(item.value * item.report_weight),
      })),
    ],
    sparkStart,
    SPARK_MONTHS,
  );
  const incomeSpark = sparkSeries.map((point) => point.incomeCents);
  const expenseSpark = sparkSeries.map((point) => point.expenseCents);

  // Saldo líquido de Contas (§3.6): pendentes do mês − faturas em aberto.
  const range = { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
  const debts = debtsQuery.data ?? [];
  const receivablePending = debts
    .filter((d) => d.type === "receivable" && d.paid_at === null && d.due_date >= range.start && d.due_date < range.end)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const payablePending = debts
    .filter((d) => d.type === "payable" && d.paid_at === null && d.due_date >= range.start && d.due_date < range.end)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const openInvoices = openInvoicesTotal(cardExpensesQuery.data ?? [], cardPaymentsQuery.data ?? [], today);
  const accountsBalance = accountsNet(receivablePending, payablePending, openInvoices);

  // Faturas em aberto por cartão (card inteligente F8): competência
  // auto-selecionada + vencimento (mesmo critério da Central de Lembretes).
  const openInvoiceRows = (cardsQuery.data ?? [])
    .filter((card) => card.is_active)
    .flatMap((card) => {
      const expenses = (cardExpensesQuery.data ?? []).filter((e) => e.card_id === card.id);
      const payments = (cardPaymentsQuery.data ?? []).filter((p) => p.card_id === card.id);
      const summaries = buildCompetenceSummaries(expenses, payments);
      const billMonth = autoSelectBillMonth(summaries, today);
      const summary = summaries.find((s) => s.month === billMonth);
      return summary && summary.saldoCents > 0
        ? [{ saldoCents: summary.saldoCents, dueDate: invoiceDueDate(billMonth, card.due_day) }]
        : [];
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  // Fluxo diário (barras empilhadas) + curva de saldo acumulado (F8).
  const dailyItems = [
    ...(incomesQuery.data ?? []).map((i) => ({ date: i.date, kind: "income" as const, amountCents: toCents(i.value * i.report_weight) })),
    ...(expensesQuery.data ?? []).map((e) => ({ date: e.date, kind: "expense" as const, amountCents: toCents(e.value * e.report_weight) })),
  ];
  const dailyFlow = buildDailyFlow(month, dailyItems);

  // Ritmo, gasto diário e projeção de fim de mês (domain/projection — F8).
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = daysInMonthOf(month);
  const pace = spendingPace({
    spentCents: expenseCents,
    monthlyBudgetCents: Math.max(1, incomeCents - investmentCents),
    dayOfMonth,
    daysInMonth,
  });
  const budget = dailyBudget({
    phase,
    incomesCents: incomeCents,
    investmentsCents: investmentCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });
  const endMonth = endOfMonthProjection({
    phase,
    incomesCents: incomeCents,
    investmentsCents: investmentCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });

  // Orçamentos compactos (§3.6): progresso, lista de atenção e realocação.
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = new Map<string, { month: string; limitCents: number }[]>();
  for (const budgetRow of budgets) {
    const list = limitsByCategory.get(budgetRow.category_id) ?? [];
    list.push({ month: budgetRow.month, limitCents: toCents(budgetRow.limit) });
    limitsByCategory.set(budgetRow.category_id, list);
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
  for (const budgetRow of budgets) {
    if (budgetRow.month === month) storedLimitsByCategory.set(budgetRow.category_id, toCents(budgetRow.limit));
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

  // Alertas críticos priorizados (domain/insights — F8): mesmos insumos da InsightsPage.
  const overspentBudgets = attentionRows.filter((row) => row.status === "exceeded").length;
  const burnRatePercent = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;
  const projectedDeficit = dayOfMonth >= 10 && endMonth.onTrack === false;
  const alerts = criticalAlerts({
    balanceCents: totals.balanceCents,
    incomeCents,
    paceRatio,
    overspentBudgets,
    burnRatePercent,
    projectedDeficit,
    savingsRatePercent: totals.savingsRatePercent,
  });

  // Donut de categorias (F8): principais despesas do mês.
  const donutSlices = (expenseCategories.data ?? [])
    .map((category) => ({ label: category.name, valueCents: spentByCategory.get(category.id) ?? 0 }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents)
    .slice(0, 5);

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
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Visão Geral</h1>
      </header>

      <MonthPicker value={month} onValueChange={setMonth} />

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {!loading && !error && !onboardingComplete && onboardingQuery.data ? (
        <OnboardingCard counts={onboardingQuery.data} />
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs fundamentais (§3.6) com NumberTicker + sparkline (F8) */}
          {visual.dashboardWidgets.kpis && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Receitas"
                value={formatCentsAsBRL(totals.incomeCents)}
                valueCents={totals.incomeCents}
                tone="positive"
                hint={<DeltaHint currentCents={totals.incomeCents} previousCents={prevTotals.incomeCents} />}
                spark={incomeSpark}
              />
              <KpiCard
                label="Despesas"
                value={formatCentsAsBRL(totals.expenseCents)}
                valueCents={totals.expenseCents}
                tone="negative"
                hint={<DeltaHint currentCents={totals.expenseCents} previousCents={prevTotals.expenseCents} invert />}
                spark={expenseSpark}
              />
              <KpiCard label="Investimentos" value={formatCentsAsBRL(totals.investmentCents)} tone="portfolio" hint="Carteira na Fase 4" />
              <KpiCard
                label="Saldo do mês"
                value={formatCentsAsBRL(totals.balanceCents)}
                valueCents={totals.balanceCents}
                tone={totals.balanceCents >= 0 ? "positive" : "negative"}
              />
            </div>
          )}

          {/* Cards inteligentes (F8): ritmo, faturas e anomalias */}
          {(visual.dashboardWidgets.pace || visual.dashboardWidgets.invoices || visual.dashboardWidgets.anomalies) &&
          (phase === "current" || openInvoiceRows.length > 0 || alerts.length > 0) ? (
            <section aria-label="Insights do período" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visual.dashboardWidgets.pace && (
                <SmartSpendingPaceCard pace={phase === "current" ? pace : null} dailyCents={phase === "current" ? budget.dailyCents : null} />
              )}
              {visual.dashboardWidgets.invoices && (
                <SmartInvoiceProjectionCard
                  openInvoicesCents={openInvoiceRows.reduce((acc, row) => acc + row.saldoCents, 0)}
                  openCount={openInvoiceRows.length}
                  nearestDueDate={openInvoiceRows[0]?.dueDate ?? null}
                />
              )}
              {visual.dashboardWidgets.anomalies && <SmartAnomaliesCard alerts={alerts} />}
            </section>
          ) : null}

          {/* Taxa de poupança + saúde (runway) — F8 */}
          {visual.dashboardWidgets.savingsHealth && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Taxa de poupança</p>
                  <p className={cn("num mt-1 text-2xl font-semibold", totals.savingsRatePercent >= 20 ? "text-positive-strong" : totals.savingsRatePercent >= 0 ? "text-foreground" : "text-critical")}>
                    {formatPercent(totals.savingsRatePercent)}%
                  </p>
                </div>
                <p className="max-w-[12rem] text-right text-xs text-muted-foreground">
                  {totals.savingsRatePercent >= 20 ? "Poupança saudável (≥20% da renda)." : totals.savingsRatePercent >= 0 ? "Saldo positivo neste mês." : "Saldo negativo: revise os gastos."}
                </p>
              </div>
              <SavingsHealthCard savingsRatePercent={totals.savingsRatePercent} incomeCents={incomeCents} expenseCents={expenseCents} />
            </div>
          )}

          {/* Saldo líquido de Contas (§3.6) */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Saldo líquido de contas</p>
              <p className={cn("num text-xl font-semibold", accountsBalance >= 0 ? "text-positive-strong" : "text-critical")}>
                {formatCentsAsBRL(accountsBalance)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              A receber <span className="privacy-mask">{formatCentsAsBRL(receivablePending)}</span> · A pagar{" "}
              <span className="privacy-mask">{formatCentsAsBRL(payablePending)}</span> · Faturas em aberto{" "}
              <span className="privacy-mask">{formatCentsAsBRL(openInvoices)}</span>
            </p>
          </div>

          {/* Fluxo diário avançado (§3.6 + F8): barras + saldo acumulado + meta */}
          {visual.dashboardWidgets.flow && (
            <section aria-label="Fluxo diário" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Fluxo diário</h2>
                <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
              </div>
              <DailyFlowChart days={dailyFlow} dailyGoalCents={phase === "current" ? budget.dailyCents : null} />
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-positive-strong/80" /> Receitas
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-negative-strong/80" /> Despesas
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-4 rounded bg-portfolio" /> Saldo acumulado
                </span>
              </div>
            </section>
          )}

          {/* Distribuição por categoria (F8 — donut) */}
          {visual.dashboardWidgets.donut && donutSlices.length > 0 ? (
            <section aria-label="Distribuição por categoria" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-foreground">Distribuição por categoria</h2>
              <CategoryDonut slices={donutSlices} />
            </section>
          ) : null}

          {/* Orçamentos (§3.6): progresso + atenção + realocação */}
          {visual.dashboardWidgets.budgets && (
            <section aria-label="Orçamentos" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Orçamentos</h2>
                <p className="num text-xs text-muted-foreground">
                  {Math.round(globalPercent)}% de {formatCentsAsBRL(totalLimitsCents)}
                </p>
              </div>
              <Progress value={globalPercent} tone={progressTone(globalPercent)} aria-label={`Uso global de limites: ${Math.round(globalPercent)}%`} />

              {attentionRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma categoria excedeu o limite.</p>
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
          )}

          {(incomesQuery.data ?? []).length === 0 && (expensesQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" aria-hidden="true" />}
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
