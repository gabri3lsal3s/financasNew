import { useState } from "react";
import { useNavigate } from "react-router";
import { Activity, ChevronRight, DollarSign, Inbox, PieChart, PiggyBank, ShieldCheck, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge, EmptyState, ErrorState, MoneyText, NumberTicker, Progress, SkeletonChart, SkeletonHeroCard, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
  CategoryIcon,
  DailyFlowChart,
  DashboardAlertsCarousel,
  type DashboardAlertItem,
  DeltaHint,
  KpiCard,
  MonthPicker,
  PaceAlertBanner,
  RealCashHeroCard,
  SurplusAporteBanner,
  CashGapAlert,
} from "@/components/modules";
import {
  BUDGET_STATUS_LABELS,
  budgetLimitsByCategory,
  budgetStatus,
  globalUsedPercent,
  isInheritedLimit,
  progressTone,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
} from "@/domain/budgets";
import { invoiceDueDate } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { analyzeCashGap, dailyBudget, endOfMonthProjection, spendingPace } from "@/domain/projection";
import {
  accountsNet,
  buildDailyFlow,
  calculateSurplusCapacity,
  computeOverview,
  openInvoicesTotal,
} from "@/domain/overview";
import { numberToCents } from "@/domain/money";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { formatPercent } from "@/services/masks";
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
  usePortfolioContributions,
  useRealCashBalance,
} from "@/state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";

const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
  items.reduce((acc, item) => acc + numberToCents(item.value * item.report_weight), 0);

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth);
  const visual = useVisualCustomization();
  const navigate = useNavigate();

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
  const contributionsQuery = usePortfolioContributions();
  const realCashData = useRealCashBalance(today);

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    prevIncomesQuery.isLoading ||
    prevExpensesQuery.isLoading ||
    incomesRangeQuery.isLoading ||
    expensesRangeQuery.isLoading ||
    debtsQuery.isLoading ||
    cardsQuery.isLoading ||
    budgetsQuery.isLoading ||
    expenseCategories.isLoading ||
    cardExpensesQuery.isLoading ||
    cardPaymentsQuery.isLoading ||
    contributionsQuery.isLoading ||
    realCashData.isLoading;

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    prevIncomesQuery.error ??
    prevExpensesQuery.error ??
    incomesRangeQuery.error ??
    expensesRangeQuery.error ??
    debtsQuery.error ??
    cardsQuery.error ??
    budgetsQuery.error ??
    expenseCategories.error ??
    cardExpensesQuery.error ??
    cardPaymentsQuery.error ??
    contributionsQuery.error ??
    realCashData.error;

  // Computação pura dos totais do mês (§3.6). Padrão do app: BRUTO como métrica principal, informando ponderado quando houver.
  const incomeCents = weightedSum(incomesQuery.data ?? []);
  const expenseCents = weightedSum(expensesQuery.data ?? []);
  const grossIncomeCents = (incomesQuery.data ?? []).reduce((acc, i) => acc + Math.round(i.value * 100), 0);
  const grossExpenseCents = (expensesQuery.data ?? []).reduce((acc, e) => acc + Math.round(e.value * 100), 0);
  const prevGrossIncomeCents = (prevIncomesQuery.data ?? []).reduce((acc, i) => acc + Math.round(i.value * 100), 0);
  const prevGrossExpenseCents = (prevExpensesQuery.data ?? []).reduce((acc, e) => acc + Math.round(e.value * 100), 0);

  // Investimentos/Aportes no mês a partir de portfolio_contributions
  const contributions = contributionsQuery.data ?? [];
  const computeMonthInvestments = (targetMonth: string) =>
    contributions
      .filter((c) => c.date.startsWith(targetMonth))
      .reduce((acc, c) => acc + numberToCents(c.amount), 0);

  const investmentCents = Math.max(0, computeMonthInvestments(month));
  const prevInvestmentCents = Math.max(0, computeMonthInvestments(prevMonth));
  const investmentSpark = rangeMonths.map((m) => Math.max(0, computeMonthInvestments(m)));

  const totals = computeOverview(grossIncomeCents, grossExpenseCents, investmentCents);
  const prevTotals = computeOverview(prevGrossIncomeCents, prevGrossExpenseCents, prevInvestmentCents);

  // Sparklines com a série dos últimos 6 meses (bruto).
  const incomeSpark = rangeMonths.map((m) =>
    (incomesRangeQuery.data ?? []).filter((i) => i.date.startsWith(m)).reduce((acc, i) => acc + Math.round(i.value * 100), 0),
  );
  const expenseSpark = rangeMonths.map((m) =>
    (expensesRangeQuery.data ?? []).filter((e) => e.date.startsWith(m)).reduce((acc, e) => acc + Math.round(e.value * 100), 0),
  );

  // Resumo de contas e faturas.
  const debts = debtsQuery.data ?? [];
  const receivablePending = debts
    .filter((d) => d.type === "receivable" && d.paid_at === null && d.due_date >= rangeStart && d.due_date < rangeEnd)
    .reduce((acc, d) => acc + numberToCents(d.amount), 0);
  const payablePending = debts
    .filter((d) => d.type === "payable" && d.paid_at === null && d.due_date >= rangeStart && d.due_date < rangeEnd)
    .reduce((acc, d) => acc + numberToCents(d.amount), 0);
  const openInvoices = openInvoicesTotal(cardExpensesQuery.data ?? [], cardPaymentsQuery.data ?? [], today);
  const accountsBalance = accountsNet(receivablePending, payablePending, openInvoices);

  // Fluxo diário (barras empilhadas) + curva de saldo acumulado.
  const dailyItems = [
    ...(incomesQuery.data ?? []).map((i) => ({ date: i.date, kind: "income" as const, amountCents: numberToCents(i.value) })),
    ...(expensesQuery.data ?? []).map((e) => ({ date: e.date, kind: "expense" as const, amountCents: numberToCents(e.value) })),
    ...contributions
      .filter((c) => c.date.startsWith(month))
      .map((c) => ({ date: c.date, kind: "investment" as const, amountCents: numberToCents(c.amount) })),
  ];
  const dailyFlow = buildDailyFlow(month, dailyItems);

  // Orçamentos compactos (§3.6): progresso e lista de atenção.
  // Padrão do app: valor BRUTO como métrica principal, informando ponderado quando houver diferença.
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = budgetLimitsByCategory(budgets);
  const spentWeightedByCategory = spentByCategoryMap(expensesQuery.data ?? []);
  const spentGrossByCategory = spentGrossByCategoryMap(expensesQuery.data ?? []);
  const budgetRows = (expenseCategories.data ?? [])
    .map((category) => {
      const spentGrossCents = spentGrossByCategory.get(category.id) ?? 0;
      const spentWeightedCents = spentWeightedByCategory.get(category.id) ?? 0;
      return {
        category,
        limitCents: resolveEffectiveLimit(limitsByCategory.get(category.id) ?? [], month),
        spentGrossCents,
        spentWeightedCents,
        spentCents: spentGrossCents,
        hasWeighting: spentGrossCents !== spentWeightedCents,
        inherited: isInheritedLimit(limitsByCategory.get(category.id) ?? [], month),
      };
    })
    .filter((row) => row.limitCents > 0);
  const totalLimitsCents = budgetRows.reduce((acc, row) => acc + row.limitCents, 0);
  const globalPercent = globalUsedPercent(grossExpenseCents, totalLimitsCents, grossIncomeCents);
  const attentionRows = budgetRows
    .map((row) => ({ ...row, status: budgetStatus(row.spentGrossCents, row.limitCents) }))
    .filter((row) => row.status !== "ok")
    .sort((a, b) => b.spentGrossCents / b.limitCents - a.spentGrossCents / a.limitCents);

  // Donut de categorias: principais despesas do mês (bruto).
  const donutSlices = (expenseCategories.data ?? [])
    .map((category) => ({
      label: category.name,
      valueCents: spentGrossByCategory.get(category.id) ?? 0,
      icon: category.icon,
      color: category.color,
    }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents)
    .slice(0, 5);

  // Projeção e ritmo de gastos (§3.8) para o mês atual.
  const isCurrentMonth = month === currentMonth();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const pace = isCurrentMonth
    ? spendingPace({
        spentCents: expenseCents,
        monthlyBudgetCents: Math.max(1, incomeCents),
        dayOfMonth,
        daysInMonth,
      })
    : { active: false, spentPercent: 0, elapsedPercent: 0, gapPoints: 0, ahead: false };

  const daily = isCurrentMonth
    ? dailyBudget({
        phase: "current",
        incomesCents: incomeCents,
        investmentsCents: investmentCents,
        expensesCents: expenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { dailyCents: null, monthlyNetCents: 0, daysRemaining: null };

  const projection = isCurrentMonth
    ? endOfMonthProjection({
        phase: "current",
        incomesCents: incomeCents,
        investmentsCents: investmentCents,
        expensesCents: expenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { projectedExpensesCents: null, surplusCents: null, onTrack: null, burnRateCents: null };

  const showPaceAlert =
    isCurrentMonth &&
    pace.active &&
    (pace.ahead || projection.onTrack === false || (projection.surplusCents !== null && projection.surplusCents < 0));

  const surplusCapacity = calculateSurplusCapacity({
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    openInvoicesCents: realCashData.safeToSpend.committedObligationsCents,
  });

  const cashGapResult = analyzeCashGap({
    currentBalanceCents: realCashData.cashBalance.currentBalanceCents,
    today,
    obligations: [
      ...(cardsQuery.data ?? []).flatMap((card) => {
        const cardExpenses = (cardExpensesQuery.data ?? []).filter(
          (e) => e.card_id === card.id && e.bill_competence === month,
        );
        const cardPayments = (cardPaymentsQuery.data ?? []).filter(
          (p) => p.card_id === card.id && p.competence_month === month,
        );
        const expTotal = cardExpenses.reduce(
          (acc, e) => acc + Math.round(e.value * 100 * (e.report_weight ?? 1)),
          0,
        );
        const payTotal = cardPayments.reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
        const balance = Math.max(0, expTotal - payTotal);
        if (balance <= 0) return [];
        const dueDate = invoiceDueDate(month, card.due_day);
        return [
          {
            id: `invoice-${card.id}-${month}`,
            name: `Fatura ${card.name}`,
            dueDate,
            amountCents: balance,
            kind: "invoice" as const,
          },
        ];
      }),
      ...(debtsQuery.data ?? [])
        .filter((d) => d.type === "payable" && !d.paid_at && d.due_date && d.due_date >= today)
        .map((d) => ({
          id: `debt-${d.id}`,
          name: d.name,
          dueDate: d.due_date,
          amountCents: numberToCents(d.amount),
          kind: "debt" as const,
        })),
    ],
    inflows: [
      ...(debtsQuery.data ?? [])
        .filter((d) => d.type === "receivable" && !d.paid_at && d.due_date && d.due_date >= today)
        .map((d) => ({
          id: `recv-${d.id}`,
          name: d.name,
          expectedDate: d.due_date,
          amountCents: numberToCents(d.amount),
        })),
      ...(incomesQuery.data ?? [])
        .filter((i) => i.date >= today)
        .map((i) => ({
          id: `income-${i.id}`,
          name: "Renda prevista",
          expectedDate: i.date,
          amountCents: Math.round(i.value * 100 * (i.report_weight ?? 1)),
        })),
    ],
  });

  const alertItems: (DashboardAlertItem | null | undefined | false)[] = [
    isCurrentMonth && cashGapResult.isCashGapDetected && {
      id: "cash-gap-alert",
      priority: cashGapResult.severity === "critical" ? 1 : 3,
      content: <CashGapAlert result={cashGapResult} />,
    },
    visual.dashboardWidgets.contextBanners && showPaceAlert && {
      id: "pace-alert-banner",
      priority: projection.surplusCents !== null && projection.surplusCents < 0 ? 2 : 3,
      content: (
        <PaceAlertBanner
          spentPercent={pace.spentPercent}
          elapsedPercent={pace.elapsedPercent}
          dailyCents={daily.dailyCents}
          daysRemaining={daily.daysRemaining}
          surplusCents={projection.surplusCents}
          onNavigateInsights={() => navigate("/insights")}
        />
      ),
    },
    surplusCapacity.hasSurplus && isCurrentMonth && {
      id: "surplus-aporte-banner",
      priority: 4,
      content: <SurplusAporteBanner surplusCents={surplusCapacity.suggestedAporteCents} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* F12 — sem header visual: o app mostra direto o seletor de mês.
          Título mantido apenas para leitores de tela (ordem de heading). */}
      <h1 className="sr-only">Visão Geral</h1>

      <MonthPicker value={month} onValueChange={setMonth} />

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {!loading && !error && <DashboardAlertsCarousel items={alertItems} />}

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <SkeletonHeroCard />
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
          <RealCashHeroCard realCashData={realCashData} />

          {/* KPIs fundamentais (§3.6) com sparkline */}
          {visual.dashboardWidgets.kpis && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 min-w-0">
              <KpiCard
                label="Receitas"
                cents={totals.incomeCents}
                tone="positive"
                icon={<TrendingUp className="size-4" aria-hidden="true" />}
                hint={
                  <div className="flex flex-col gap-0.5">
                    <DeltaHint currentCents={totals.incomeCents} previousCents={prevTotals.incomeCents} />
                    {grossIncomeCents !== incomeCents ? (
                      <span className="text-[10px] text-muted-foreground truncate">
                        Ponderada: <MoneyText cents={incomeCents} tone="default" className="text-[10px]" />
                      </span>
                    ) : null}
                  </div>
                }
                spark={incomeSpark}
              />
              <KpiCard
                label="Despesas"
                cents={totals.expenseCents}
                tone="negative"
                icon={<TrendingDown className="size-4" aria-hidden="true" />}
                hint={
                  <div className="flex flex-col gap-0.5">
                    <DeltaHint currentCents={totals.expenseCents} previousCents={prevTotals.expenseCents} invert />
                    {grossExpenseCents !== expenseCents ? (
                      <span className="text-[10px] text-muted-foreground truncate">
                        Ponderada: <MoneyText cents={expenseCents} tone="default" className="text-[10px]" />
                      </span>
                    ) : null}
                  </div>
                }
                spark={expenseSpark}
              />
              <KpiCard
                label="Investimentos"
                cents={totals.investmentCents}
                tone="portfolio"
                icon={<TrendingUp className="size-4" aria-hidden="true" />}
                hint={<DeltaHint currentCents={totals.investmentCents} previousCents={prevTotals.investmentCents} />}
                spark={investmentSpark}
              />
              <KpiCard
                label="Resultado do mês"
                cents={totals.operatingBalanceCents}
                tone={totals.operatingBalanceCents >= 0 ? "positive" : "negative"}
                icon={<DollarSign className="size-4" aria-hidden="true" />}
                hint={
                  totals.investmentCents > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <span className="hidden sm:inline">Caixa pós-aportes:</span>
                      <span className="sm:hidden">Pós-aportes:</span>
                      <MoneyText
                        cents={totals.cashFlowBalanceCents}
                        tone={totals.cashFlowBalanceCents >= 0 ? "default" : "negative"}
                        className="text-[10px]"
                      />
                    </span>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Análises do período: fluxo diário + distribuição por categoria */}
          {(visual.dashboardWidgets.flow || (visual.dashboardWidgets.donut && donutSlices.length > 0)) && (
            <section
              aria-label="Análises do período"
              className={cn("grid gap-3 min-w-0", visual.dashboardWidgets.flow && visual.dashboardWidgets.donut && donutSlices.length > 0 ? "lg:grid-cols-2" : "")}
            >
              {visual.dashboardWidgets.flow && (
                <section aria-label="Fluxo diário" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover border border-border/60 text-muted-foreground">
                        <Activity className="size-3.5" aria-hidden="true" />
                      </span>
                      <h2 className="text-sm font-semibold text-foreground truncate min-w-0">Fluxo diário</h2>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 text-[11px] shrink-0">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-positive-strong shrink-0" /> Receitas
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-negative-strong shrink-0" /> Despesas
                      </span>
                      {totals.investmentCents > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-portfolio shrink-0" /> Investimentos
                        </span>
                      )}
                    </div>
                  </div>

                  <DailyFlowChart days={dailyFlow} />
                </section>
              )}
              {visual.dashboardWidgets.donut && donutSlices.length > 0 ? (
                <section aria-label="Distribuição por categoria" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover border border-border/60 text-muted-foreground">
                        <PieChart className="size-3.5" aria-hidden="true" />
                      </span>
                      <h2 className="text-sm font-semibold text-foreground truncate min-w-0">Distribuição por categoria</h2>
                    </div>
                    <Badge variant="muted" size="xs">{donutSlices.length} categorias</Badge>
                  </div>
                  <CategoryDonut slices={donutSlices} />
                </section>
              ) : null}
            </section>
          )}

          {/* Resumo financeiro (§3.6): saldo líquido de contas e taxa de poupança */}
          {visual.dashboardWidgets.summary && (
            <section aria-label="Resumo financeiro" className="grid gap-3 md:grid-cols-2 min-w-0">
              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        accountsBalance >= 0
                          ? "bg-primary/10 border-primary/20 text-primary-strong"
                          : "bg-critical/10 border-critical/20 text-critical-strong",
                      )}
                    >
                      <Wallet className="size-3.5" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground truncate min-w-0">Saldo líquido de contas</h2>
                  </div>
                  <Badge variant="muted" size="xs">Projeção</Badge>
                </div>
                <div>
                  <MoneyText
                    cents={accountsBalance}
                    variant="hero"
                    tone="auto"
                    sign="auto"
                    animated
                    className="text-2xl sm:text-3xl tracking-tight truncate"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 border-t border-border/50 pt-2.5 sm:pt-3 text-[11px] text-muted-foreground min-w-0">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate">A receber</p>
                    <MoneyText cents={receivablePending} tone="positive" className="privacy-mask text-[11px] whitespace-nowrap block font-medium" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate">A pagar</p>
                    <MoneyText cents={payablePending} tone="negative" className="privacy-mask text-[11px] whitespace-nowrap block font-medium" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate">Faturas</p>
                    <MoneyText cents={openInvoices} tone="default" className="privacy-mask text-[11px] whitespace-nowrap block font-medium" />
                  </div>
                </div>
              </article>

              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        totals.savingsRatePercent >= 20
                          ? "bg-positive/10 border-positive/20 text-positive-strong"
                          : totals.savingsRatePercent >= 0
                            ? "bg-primary/10 border-primary/20 text-primary-strong"
                            : "bg-critical/10 border-critical/20 text-critical-strong",
                      )}
                    >
                      <PiggyBank className="size-3.5" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground truncate min-w-0">Taxa de poupança</h2>
                  </div>
                  <Badge variant={totals.savingsRatePercent >= 20 ? "positive" : totals.savingsRatePercent >= 0 ? "muted" : "critical"} size="xs">
                    {totals.savingsRatePercent >= 20 ? "Meta atingida" : totals.savingsRatePercent >= 0 ? "Regular" : "Abaixo"}
                  </Badge>
                </div>
                <div>
                  <p className={cn("num text-2xl sm:text-3xl font-bold tracking-tight", totals.savingsRatePercent >= 20 ? "text-positive-strong" : totals.savingsRatePercent >= 0 ? "text-foreground" : "text-critical")}>
                    <NumberTicker value={totals.savingsRatePercent} format={(v: number) => `${formatPercent(v)}%`} />
                  </p>
                </div>
                <div className="border-t border-border/50 pt-2.5 sm:pt-3 text-xs text-muted-foreground">
                  {totals.savingsRatePercent >= 20 ? "Poupança saudável (≥20% da renda)." : totals.savingsRatePercent >= 0 ? "Saldo positivo neste mês." : "Saldo negativo: revise os gastos."}
                </div>
              </article>
            </section>
          )}

          {/* Orçamentos (§3.6): progresso e lista de atenção */}
          {visual.dashboardWidgets.budgets && (
            <section aria-label="Orçamentos" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover/80 border border-border/60 text-muted-foreground">
                    <Target className="size-3.5" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground truncate min-w-0">Orçamentos do mês</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/orcamentos")}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium shrink-0 cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              {budgetRows.length === 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-surface-hover/20 p-3.5 text-xs text-muted-foreground">
                  <span>Nenhum orçamento configurado para este mês.</span>
                  <button
                    type="button"
                    onClick={() => navigate("/orcamentos")}
                    className="font-medium text-primary hover:underline cursor-pointer"
                  >
                    Definir limites →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-2.5 rounded-xl bg-surface-hover/40 border border-border/50 p-3 sm:p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">Uso consolidado</span>
                      <Badge
                        variant={globalPercent > 100 ? "critical" : globalPercent >= 85 ? "warning" : "positive"}
                        size="xs"
                      >
                        {Math.round(globalPercent)}%
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 flex-wrap min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <MoneyText cents={grossExpenseCents} tone="default" className="text-base sm:text-lg font-bold text-foreground tracking-tight" />
                        <span className="text-xs text-muted-foreground font-normal">
                          de <MoneyText cents={totalLimitsCents} tone="default" className="text-muted-foreground" />
                        </span>
                      </div>
                      {grossExpenseCents !== expenseCents ? (
                        <span className="text-[11px] text-muted-foreground">
                          Ponderado: <MoneyText cents={expenseCents} tone="default" className="font-medium text-foreground text-[11px]" />
                        </span>
                      ) : null}
                    </div>

                    <Progress
                      value={globalPercent}
                      tone={progressTone(globalPercent)}
                      className="h-2"
                      aria-label={`Uso global de limites: ${Math.round(globalPercent)}%`}
                    />
                  </div>

                  {attentionRows.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-positive/20 bg-positive/5 px-3 py-2 text-xs text-positive-strong">
                      <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>Todos os limites sob controle neste mês.</span>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    {(attentionRows.length > 0
                      ? attentionRows.slice(0, 4)
                      : [...budgetRows]
                          .sort((a, b) => (b.limitCents > 0 ? b.spentGrossCents / b.limitCents : 0) - (a.limitCents > 0 ? a.spentGrossCents / a.limitCents : 0))
                          .slice(0, 4)
                    ).map((row) => {
                      const percent = row.limitCents > 0 ? (row.spentGrossCents / row.limitCents) * 100 : 0;
                      const status = budgetStatus(row.spentGrossCents, row.limitCents);
                      const isOver = status === "exceeded";
                      const isAttention = status !== "ok";

                      return (
                        <div
                          key={row.category.id}
                          onClick={() => navigate("/orcamentos")}
                          className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-hover/20 p-2.5 sm:p-3 hover:border-border hover:bg-surface-hover/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <CategoryIcon icon={row.category.icon} color={row.category.color} className="size-4 sm:size-4.5 shrink-0" />
                              <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-xs">
                                {row.category.name}
                              </span>
                            </div>
                            {isAttention ? (
                              <Badge variant={isOver ? "critical" : "warning"} size="xs">
                                {BUDGET_STATUS_LABELS[status]}
                              </Badge>
                            ) : (
                              <span className="num text-[11px] font-medium text-muted-foreground">{Math.round(percent)}%</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] min-w-0">
                            <div className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
                              <MoneyText cents={row.spentGrossCents} tone="default" className="font-medium text-foreground" />
                              <span>/</span>
                              <MoneyText cents={row.limitCents} tone="default" />
                            </div>
                            {row.hasWeighting ? (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                Pond: <MoneyText cents={row.spentWeightedCents} tone="default" className="text-[10px]" />
                              </span>
                            ) : null}
                          </div>

                          <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                percent >= 100 ? "bg-critical" : percent >= 85 ? "bg-warning" : "bg-positive",
                              )}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {attentionRows.length > 4 ? (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      +{attentionRows.length - 4} outra(s) categoria(s) em atenção no mês.
                    </p>
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
