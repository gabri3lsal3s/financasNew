import { useState } from "react";
import { Activity, Inbox, PieChart, PiggyBank, ShieldCheck, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Alert, Badge, EmptyState, MoneyText, Progress, SkeletonChart, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
  DailyFlowChart,
  KpiCard,
  MonthPicker,
  OnboardingCard,
} from "@/components/modules";
import { isOnboardingComplete } from "@/domain/onboarding";
import {
  BUDGET_STATUS_LABELS,
  budgetStatus,
  globalUsedPercent,
  isInheritedLimit,
  progressTone,
  resolveEffectiveLimit,
} from "@/domain/budgets";
import { todayISO } from "@/domain/debts";
import {
  accountsNet,
  buildDailyFlow,
  computeOverview,
  openInvoicesTotal,
  percentChange,
} from "@/domain/overview";
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
} from "@/state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
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
  const positive = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5", positive ? "text-positive-strong" : "text-negative-strong")}>
      <Icon className="size-3" aria-hidden="true" />
      <span>{formatPercent(Math.abs(delta))}%</span>
    </span>
  );
}

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth);
  const visual = useVisualCustomization();

  const prevMonth = shiftMonth(month, -1);
  const startRange = shiftMonth(month, -5);
  const rangeMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(startRange, i));
  const rangeStart = `${startRange}-01`;
  const rangeEnd = `${shiftMonth(month, 1)}-01`;
  const today = todayISO();

  // Queries TanStack (state).
  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(prevMonth);
  const prevExpensesQuery = useExpenses(prevMonth);

  const incomesRangeQuery = useIncomesByRange(rangeStart, rangeEnd);
  const expensesRangeQuery = useExpensesByRange(rangeStart, rangeEnd);

  const cardsQuery = useCreditCards();
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();
  const onboardingQuery = useOnboardingCounts();

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    prevIncomesQuery.isLoading ||
    prevExpensesQuery.isLoading ||
    debtsQuery.isLoading ||
    cardsQuery.isLoading;

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    prevIncomesQuery.error ??
    prevExpensesQuery.error ??
    debtsQuery.error ??
    cardsQuery.error ??
    budgetsQuery.error;

  const onboardingComplete = onboardingQuery.data ? isOnboardingComplete(onboardingQuery.data) : false;

  // Computação pura dos totais do mês (§3.6).
  const incomeCents = weightedSum(incomesQuery.data ?? []);
  const expenseCents = weightedSum(expensesQuery.data ?? []);
  const prevIncomeCents = weightedSum(prevIncomesQuery.data ?? []);
  const prevExpenseCents = weightedSum(prevExpensesQuery.data ?? []);

  const totals = computeOverview(incomeCents, expenseCents, 0);
  const prevTotals = computeOverview(prevIncomeCents, prevExpenseCents, 0);

  // Sparklines com a série dos últimos 6 meses.
  const incomeSpark = rangeMonths.map((m) =>
    weightedSum((incomesRangeQuery.data ?? []).filter((i) => i.date.startsWith(m))),
  );
  const expenseSpark = rangeMonths.map((m) =>
    weightedSum((expensesRangeQuery.data ?? []).filter((e) => e.date.startsWith(m))),
  );

  // Resumo de contas e faturas.
  const debts = debtsQuery.data ?? [];
  const receivablePending = debts
    .filter((d) => d.type === "receivable" && d.paid_at === null && d.due_date >= rangeStart && d.due_date < rangeEnd)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const payablePending = debts
    .filter((d) => d.type === "payable" && d.paid_at === null && d.due_date >= rangeStart && d.due_date < rangeEnd)
    .reduce((acc, d) => acc + toCents(d.amount), 0);
  const openInvoices = openInvoicesTotal(cardExpensesQuery.data ?? [], cardPaymentsQuery.data ?? [], today);
  const accountsBalance = accountsNet(receivablePending, payablePending, openInvoices);

  // Fluxo diário (barras empilhadas) + curva de saldo acumulado.
  const dailyItems = [
    ...(incomesQuery.data ?? []).map((i) => ({ date: i.date, kind: "income" as const, amountCents: toCents(i.value * i.report_weight) })),
    ...(expensesQuery.data ?? []).map((e) => ({ date: e.date, kind: "expense" as const, amountCents: toCents(e.value * e.report_weight) })),
  ];
  const dailyFlow = buildDailyFlow(month, dailyItems);

  // Orçamentos compactos (§3.6): progresso e lista de atenção.
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

  // Donut de categorias: principais despesas do mês.
  const donutSlices = (expenseCategories.data ?? [])
    .map((category) => ({ label: category.name, valueCents: spentByCategory.get(category.id) ?? 0 }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: o app mostra direto o seletor de mês.
          Título mantido apenas para leitores de tela (ordem de heading). */}
      <h1 className="sr-only">Visão Geral</h1>

      <MonthPicker value={month} onValueChange={setMonth} />

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {!loading && !error && !onboardingComplete && onboardingQuery.data ? (
        <OnboardingCard counts={onboardingQuery.data} />
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <SkeletonChart />
        </div>
      ) : (
        <>
          {/* KPIs fundamentais (§3.6) com sparkline */}
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
              <KpiCard label="Investimentos" cents={totals.investmentCents} tone="portfolio" hint="Carteira na Fase 4" />
              <KpiCard
                label="Saldo do mês"
                value={formatCentsAsBRL(totals.balanceCents)}
                valueCents={totals.balanceCents}
                tone={totals.balanceCents >= 0 ? "positive" : "negative"}
              />
            </div>
          )}

          {/* Resumo financeiro (§3.6): saldo líquido de contas e taxa de poupança */}
          {visual.dashboardWidgets.summary && (
            <section aria-label="Resumo financeiro" className="grid gap-3 md:grid-cols-2">
              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center text-primary">
                      <Wallet className="size-4" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">Saldo líquido de contas</h2>
                  </div>
                  <Badge variant="muted" className="text-[11px]">Projeção</Badge>
                </div>
                <div>
                  <MoneyText
                    cents={accountsBalance}
                    variant="hero"
                    tone="auto"
                    sign="auto"
                    className="text-3xl tracking-tight"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                  <div className="truncate">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">A receber</p>
                    <p className="privacy-mask num font-medium text-positive-strong">{formatCentsAsBRL(receivablePending)}</p>
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">A pagar</p>
                    <p className="privacy-mask num font-medium text-negative-strong">{formatCentsAsBRL(payablePending)}</p>
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Faturas</p>
                    <p className="privacy-mask num font-medium text-foreground">{formatCentsAsBRL(openInvoices)}</p>
                  </div>
                </div>
              </article>

              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center text-positive-strong">
                      <PiggyBank className="size-4" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">Taxa de poupança</h2>
                  </div>
                  <Badge variant={totals.savingsRatePercent >= 20 ? "positive" : totals.savingsRatePercent >= 0 ? "muted" : "critical"}>
                    {totals.savingsRatePercent >= 20 ? "Meta atingida" : totals.savingsRatePercent >= 0 ? "Regular" : "Abaixo"}
                  </Badge>
                </div>
                <div>
                  <p className={cn("num text-3xl font-bold tracking-tight", totals.savingsRatePercent >= 20 ? "text-positive-strong" : totals.savingsRatePercent >= 0 ? "text-foreground" : "text-critical")}>
                    {formatPercent(totals.savingsRatePercent)}%
                  </p>
                </div>
                <div className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  {totals.savingsRatePercent >= 20 ? "Poupança saudável (≥20% da renda)." : totals.savingsRatePercent >= 0 ? "Saldo positivo neste mês." : "Saldo negativo: revise os gastos."}
                </div>
              </article>
            </section>
          )}

          {/* Análises do período: fluxo diário + distribuição por categoria */}
          {(visual.dashboardWidgets.flow || (visual.dashboardWidgets.donut && donutSlices.length > 0)) && (
            <section
              aria-label="Análises do período"
              className={cn("grid gap-3", visual.dashboardWidgets.flow && visual.dashboardWidgets.donut && donutSlices.length > 0 ? "lg:grid-cols-2" : "")}
            >
              {visual.dashboardWidgets.flow && (
                <section aria-label="Fluxo diário" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                        <Activity className="size-3.5" aria-hidden="true" />
                      </span>
                      <h2 className="text-sm font-semibold text-foreground">Fluxo diário</h2>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <span className="size-2 rounded-full bg-positive-strong" /> Receitas
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <span className="size-2 rounded-full bg-negative-strong" /> Despesas
                      </span>
                    </div>
                  </div>
                  <DailyFlowChart days={dailyFlow} />
                </section>
              )}
              {visual.dashboardWidgets.donut && donutSlices.length > 0 ? (
                <section aria-label="Distribuição por categoria" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                        <PieChart className="size-3.5" aria-hidden="true" />
                      </span>
                      <h2 className="text-sm font-semibold text-foreground">Distribuição por categoria</h2>
                    </div>
                    <Badge variant="muted" className="text-[11px]">{donutSlices.length} categorias</Badge>
                  </div>
                  <CategoryDonut slices={donutSlices} />
                </section>
              ) : null}
            </section>
          )}

          {/* Orçamentos (§3.6): progresso e lista de atenção */}
          {visual.dashboardWidgets.budgets && (
            <section aria-label="Orçamentos" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                    <Target className="size-3.5" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Orçamentos do mês</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="num text-xs text-muted-foreground">
                    {formatCentsAsBRL(expenseCents)} de {formatCentsAsBRL(totalLimitsCents)}
                  </span>
                  <Badge variant={globalPercent > 100 ? "critical" : globalPercent >= 85 ? "warning" : "positive"} className="text-[11px]">
                    {Math.round(globalPercent)}% utilizado
                  </Badge>
                </div>
              </div>

              <Progress
                value={globalPercent}
                tone={progressTone(globalPercent)}
                className="h-2"
                aria-label={`Uso global de limites: ${Math.round(globalPercent)}%`}
              />

              {attentionRows.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-positive/20 bg-positive/5 px-3.5 py-3 text-xs text-positive-strong">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                  <span>Todos os orçamentos sob controle neste mês.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Categorias em atenção</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {attentionRows.slice(0, 4).map((row) => {
                      const percent = row.limitCents > 0 ? (row.spentCents / row.limitCents) * 100 : 0;
                      const isOver = row.spentCents > row.limitCents;
                      return (
                        <div
                          key={row.category.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-hover/30 p-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground truncate">{row.category.name}</span>
                            <Badge variant={isOver ? "critical" : "warning"} className="text-[10px] px-1.5 py-0">
                              {BUDGET_STATUS_LABELS[row.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="privacy-mask num font-medium text-foreground">
                              {formatCentsAsBRL(row.spentCents)}
                            </span>
                            <span className="num">de {formatCentsAsBRL(row.limitCents)}</span>
                          </div>
                          <Progress
                            value={percent}
                            tone={isOver ? "critical" : "warning"}
                            className="h-1.5"
                            aria-label={`Uso da categoria ${row.category.name}: ${Math.round(percent)}%`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {attentionRows.length > 4 ? (
                    <p className="text-xs text-muted-foreground text-center">+{attentionRows.length - 4} outra(s) categoria(s) em atenção.</p>
                  ) : null}
                </div>
              )}
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
    </div>
  );
}
