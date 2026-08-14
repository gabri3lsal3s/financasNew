import { useState } from "react";
import { Inbox, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Alert, EmptyState, MoneyText, Progress, SkeletonChart, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
  DailyFlowChart,
  KpiCard,
  MonthPicker,
  OnboardingCard,
} from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
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
  monthlySeries,
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

/** Visão Consolidada (§3.6) — Dashboard limpo e objetivo de finanças pessoais. */
export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth());
  const previousMonth = shiftMonth(month, -1);
  const today = todayISO();

  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(previousMonth);
  const prevExpensesQuery = useExpenses(previousMonth);
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  useCreditCards();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();

  // Série dos últimos meses para os micro-sparklines dos KPIs.
  const sparkStart = shiftMonth(month, -(SPARK_MONTHS - 1));
  const sparkRange = { start: `${sparkStart}-01`, end: `${shiftMonth(month, 1)}-01` };
  const sparkExpensesQuery = useExpensesByRange(sparkRange.start, sparkRange.end);
  const sparkIncomesQuery = useIncomesByRange(sparkRange.start, sparkRange.end);

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

  // Sparklines: totais mensais ponderados dos últimos 6 meses.
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
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Visão Geral</h1>
      </header>

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
              <KpiCard label="Investimentos" value={formatCentsAsBRL(totals.investmentCents)} tone="portfolio" hint="Carteira na Fase 4" />
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
              <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Wallet className="size-4 text-foreground" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Saldo líquido de contas</h2>
                </div>
                <MoneyText
                  cents={accountsBalance}
                  variant="hero"
                  tone="auto"
                  sign="auto"
                  className="text-3xl"
                />
                <p className="text-xs text-muted-foreground">
                  A receber <span className="privacy-mask">{formatCentsAsBRL(receivablePending)}</span> · A pagar{" "}
                  <span className="privacy-mask">{formatCentsAsBRL(payablePending)}</span> · Faturas em aberto{" "}
                  <span className="privacy-mask">{formatCentsAsBRL(openInvoices)}</span>
                </p>
              </article>

              <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <PiggyBank className="size-4 text-foreground" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Taxa de poupança</h2>
                </div>
                <p className={cn("num text-3xl font-semibold", totals.savingsRatePercent >= 20 ? "text-positive-strong" : totals.savingsRatePercent >= 0 ? "text-foreground" : "text-critical")}>
                  {formatPercent(totals.savingsRatePercent)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {totals.savingsRatePercent >= 20 ? "Poupança saudável (≥20% da renda)." : totals.savingsRatePercent >= 0 ? "Saldo positivo neste mês." : "Saldo negativo: revise os gastos."}
                </p>
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
                <section aria-label="Fluxo diário" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Fluxo diário</h2>
                    <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
                  </div>
                  <DailyFlowChart days={dailyFlow} />
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 rounded bg-positive-strong" /> Receitas
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 rounded bg-negative-strong" /> Despesas
                    </span>
                  </div>
                </section>
              )}
              {visual.dashboardWidgets.donut && donutSlices.length > 0 ? (
                <section aria-label="Distribuição por categoria" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <h2 className="text-sm font-semibold text-foreground">Distribuição por categoria</h2>
                  <CategoryDonut slices={donutSlices} />
                </section>
              ) : null}
            </section>
          )}

          {/* Orçamentos (§3.6): progresso e lista de atenção */}
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

