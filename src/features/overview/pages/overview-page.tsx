import { useState } from "react";
import { useNavigate } from "react-router";
import { Activity, ChevronRight, DollarSign, Inbox, PieChart, PiggyBank, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, MoneyText, NumberTicker, SkeletonChart, SkeletonHeroCard, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
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
  budgetLimitsByCategory,
  isInheritedLimit,
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
import { CategoryBreakdownDialog, OtherBudgetsDialog } from "../components";

const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
  items.reduce((acc, item) => acc + numberToCents(item.value * item.report_weight), 0);

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isOthersBudgetOpen, setIsOthersBudgetOpen] = useState(false);
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
  const balanceSpark = rangeMonths.map((_, idx) => (incomeSpark[idx] ?? 0) - (expenseSpark[idx] ?? 0));

  // Resumo de contas e faturas.
  const debts = debtsQuery.data ?? [];
  const receivablePending = debts
    .filter((d) => d.type === "receivable" && d.paid_at === null && d.due_date < rangeEnd)
    .reduce((acc, d) => acc + numberToCents(d.amount), 0);
  const payablePending = debts
    .filter((d) => d.type === "payable" && d.paid_at === null && d.due_date < rangeEnd)
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

  // Orçamentos compactos (§3.6): barra segmentada consolidada e diagnóstico executivo.
  // Métrica principal: gasto efetivo ponderado (alinhado com Orçamentos e Categorias).
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = budgetLimitsByCategory(budgets);
  const spentWeightedByCategory = spentByCategoryMap(expensesQuery.data ?? []);
  const spentGrossByCategory = spentGrossByCategoryMap(expensesQuery.data ?? []);
  const budgetRows = (expenseCategories.data ?? [])
    .map((category) => {
      const spentWeightedCents = spentWeightedByCategory.get(category.id) ?? 0;
      const limitCents = resolveEffectiveLimit(limitsByCategory.get(category.id) ?? [], month);
      return {
        category,
        limitCents,
        spentCents: spentWeightedCents,
        remainingCents: limitCents - spentWeightedCents,
        percent: limitCents > 0 ? (spentWeightedCents / limitCents) * 100 : 0,
        inherited: isInheritedLimit(limitsByCategory.get(category.id) ?? [], month),
      };
    })
    .filter((row) => row.limitCents > 0);
  const totalLimitsCents = budgetRows.reduce((acc, row) => acc + row.limitCents, 0);
  const totalRemainingCents = totalLimitsCents - expenseCents;
  const globalPercent = totalLimitsCents > 0 ? (expenseCents / totalLimitsCents) * 100 : 0;

  // Segmentos da Barra Única:
  const segmentBaseCents = Math.max(1, totalLimitsCents, expenseCents);
  const activeBudgetSpentRows = [...budgetRows]
    .filter((r) => r.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);
  const topBudgetSegments = activeBudgetSpentRows.slice(0, 4);
  const otherBudgetRows = activeBudgetSpentRows.slice(4);
  const otherBudgetSpentCents = otherBudgetRows.reduce((acc, r) => acc + r.spentCents, 0);
  const budgetSegments = [
    ...topBudgetSegments.map((row) => ({
      id: row.category.id,
      label: row.category.name,
      color: row.category.color ?? undefined,
      spentCents: row.spentCents,
      percent: (row.spentCents / segmentBaseCents) * 100,
    })),
    ...(otherBudgetSpentCents > 0
      ? [
          {
            id: "others",
            label: "Outros",
            color: "#64748b",
            spentCents: otherBudgetSpentCents,
            percent: (otherBudgetSpentCents / segmentBaseCents) * 100,
          },
        ]
      : []),
  ];

  // Donut de categorias: principais despesas do mês (bruto) com suporte a clique.
  const donutSlices = (expenseCategories.data ?? [])
    .map((category) => ({
      key: category.id,
      label: category.name,
      valueCents: spentGrossByCategory.get(category.id) ?? 0,
      icon: category.icon,
      color: category.color,
      onClick: () => setSelectedCategoryId(category.id),
    }))
    .filter((slice) => slice.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents)
    .slice(0, 5);

  // Detalhes da Categoria Selecionada para o Diálogo de Raio-X
  const prevSpentWeightedByCategory = spentByCategoryMap(prevExpensesQuery.data ?? []);
  const selectedCategory = (expenseCategories.data ?? []).find((c) => c.id === selectedCategoryId) ?? null;
  const selectedLimitCents = selectedCategory
    ? resolveEffectiveLimit(limitsByCategory.get(selectedCategory.id) ?? [], month)
    : 0;
  const selectedSpentWeightedCents = selectedCategory ? (spentWeightedByCategory.get(selectedCategory.id) ?? 0) : 0;
  const selectedSpentGrossCents = selectedCategory ? (spentGrossByCategory.get(selectedCategory.id) ?? 0) : 0;
  const selectedPrevSpentWeightedCents = selectedCategory
    ? (prevSpentWeightedByCategory.get(selectedCategory.id) ?? 0)
    : 0;
  const selectedExpenses = (expensesQuery.data ?? []).filter((e) => e.category_id === selectedCategoryId);

  // Projeção e ritmo de gastos (§3.8) para o mês atual.
  const isCurrentMonth = month === currentMonth();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const pace = isCurrentMonth
    ? spendingPace({
        spentCents: grossExpenseCents,
        monthlyBudgetCents: Math.max(1, grossIncomeCents),
        dayOfMonth,
        daysInMonth,
      })
    : { active: false, spentPercent: 0, elapsedPercent: 0, gapPoints: 0, ahead: false };

  const daily = isCurrentMonth
    ? dailyBudget({
        phase: "current",
        incomesCents: grossIncomeCents,
        investmentsCents: investmentCents,
        expensesCents: grossExpenseCents,
        dayOfMonth,
        daysInMonth,
      })
    : { dailyCents: null, monthlyNetCents: 0, daysRemaining: null };

  const projection = isCurrentMonth
    ? endOfMonthProjection({
        phase: "current",
        incomesCents: grossIncomeCents,
        investmentsCents: investmentCents,
        expensesCents: grossExpenseCents,
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
    contributionsAlreadyMadeCents: totals.investmentCents,
    safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
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
        // O valor da fatura do cartão é pago pelo montante BRUTO nominal integral
        const expTotal = cardExpenses.reduce(
          (acc, e) => acc + Math.round(e.value * 100),
          0,
        );
        const payTotal = cardPayments.reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
        const balance = Math.max(0, expTotal - payTotal);
        if (balance <= 0) return [];
        const nominalDueDate = invoiceDueDate(month, card.due_day);
        // Fatura vencida em aberto no mês tem exigibilidade imediata (today)
        const dueDate = nominalDueDate < today ? today : nominalDueDate;
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
        .filter((d) => d.type === "payable" && !d.paid_at && d.due_date && d.due_date < rangeEnd)
        .map((d) => ({
          id: `debt-${d.id}`,
          name: d.name,
          dueDate: d.due_date < today ? today : d.due_date,
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
          amountCents: Math.round(i.value * 100),
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
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <DeltaHint currentCents={totals.incomeCents} previousCents={prevTotals.incomeCents} />
                    {grossIncomeCents !== incomeCents ? (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap min-w-0 block">
                        <span className="hidden sm:inline">Ponderada: </span>
                        <span className="sm:hidden">Pond: </span>
                        <MoneyText cents={incomeCents} tone="default" className="text-[10px] tabular-nums" />
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
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <DeltaHint currentCents={totals.expenseCents} previousCents={prevTotals.expenseCents} invert />
                    {grossExpenseCents !== expenseCents ? (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap min-w-0 block">
                        <span className="hidden sm:inline">Ponderada: </span>
                        <span className="sm:hidden">Pond: </span>
                        <MoneyText cents={expenseCents} tone="default" className="text-[10px] tabular-nums" />
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
                spark={investmentSpark}
              />
              <KpiCard
                label={
                  <>
                    <span className="hidden sm:inline">Resultado do mês</span>
                    <span className="sm:hidden">Resultado</span>
                  </>
                }
                cents={totals.operatingBalanceCents}
                tone={totals.operatingBalanceCents >= 0 ? "positive" : "negative"}
                icon={<DollarSign className="size-4" aria-hidden="true" />}
                spark={balanceSpark}
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
                  <CategoryDonut
                    slices={donutSlices}
                    onSliceClick={(slice) => {
                      if (slice.key) setSelectedCategoryId(slice.key);
                    }}
                  />
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

          {/* Orçamentos (§3.6): Layout Revolut / Apple Wallet (Compacto & Lado a Lado) */}
          {visual.dashboardWidgets.budgets && (
            <section aria-label="Orçamentos" className="flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
              {/* Header do Card: Título + Botão de Ação */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">Orçamentos do mês</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/orcamentos")}
                  aria-label="Ver todos os orçamentos"
                  className="h-7 gap-1 px-2 sm:px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80 shrink-0"
                >
                  <span className="hidden sm:inline">Ver todos</span>
                  <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </Button>
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
                <div className="flex flex-col gap-3 sm:gap-3.5">
                  {/* Bloco de Métricas: Saldo à esquerda e Badge de Consumo à direita */}
                  <div className="flex items-end justify-between gap-2 pt-0.5">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {totalRemainingCents >= 0 ? "Saldo disponível no teto" : "Orçamento ultrapassado em"}
                      </span>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <MoneyText
                          cents={Math.abs(totalRemainingCents)}
                          tone="default"
                          className={cn(
                            "text-2xl sm:text-3xl font-bold tracking-tight",
                            totalRemainingCents >= 0 ? "text-positive-strong" : "text-critical-strong",
                          )}
                        />
                        <span className="text-xs text-muted-foreground font-normal">
                          de <MoneyText cents={totalLimitsCents} tone="default" className="text-muted-foreground font-medium" /> planejado
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={globalPercent > 100 ? "critical" : globalPercent >= 85 ? "warning" : "positive"}
                      size="xs"
                      className="shrink-0 mb-1"
                    >
                      {Math.round(globalPercent)}% utilizado
                    </Badge>
                  </div>

                  {/* Barra Segmentada Única (Estilo Apple / Linear) com clique para Raio-X */}
                  <div className="w-full flex flex-col gap-2.5">
                    <div
                      className="flex w-full h-2.5 sm:h-3 rounded-full overflow-hidden bg-surface-hover/70 p-0.5 border border-border/40 gap-0.5"
                      role="group"
                      aria-label={`Uso do orçamento: ${Math.round(globalPercent)}%`}
                    >
                      {budgetSegments.map((seg) => (
                        <button
                          type="button"
                          key={seg.id}
                          style={{
                            width: `${Math.max(1.5, seg.percent)}%`,
                            backgroundColor: seg.color ?? undefined,
                          }}
                          className="h-full rounded-full transition-all duration-300 first:rounded-l-full last:rounded-r-full shrink-0 outline-none cursor-pointer hover:brightness-110 active:scale-95 focus-visible:ring-1 focus-visible:ring-ring"
                          title={`${seg.label}: ${(seg.spentCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — clique para ver detalhes`}
                          onClick={() => {
                            if (seg.id === "others") {
                              setIsOthersBudgetOpen(true);
                            } else {
                              setSelectedCategoryId(seg.id);
                            }
                          }}
                        />
                      ))}
                    </div>

                    {/* Legenda Estruturada em 2 Colunas Simétricas no Mobile e Flex no Desktop */}
                    {budgetSegments.length > 0 ? (
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-3 sm:gap-x-4 gap-y-2 text-xs pt-0.5 min-w-0">
                        {budgetSegments.map((seg) => (
                          <button
                            type="button"
                            key={seg.id}
                            onClick={() => {
                              if (seg.id === "others") {
                                setIsOthersBudgetOpen(true);
                              } else {
                                setSelectedCategoryId(seg.id);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 min-w-0 text-muted-foreground transition-all duration-150 rounded-lg p-1 -m-1 cursor-pointer hover:bg-surface-hover hover:text-foreground active:scale-95 text-left"
                          >
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: seg.color ?? undefined }}
                              aria-hidden="true"
                            />
                            <span className="font-medium text-foreground truncate min-w-0">{seg.label}</span>
                            <span className="hidden sm:inline font-medium text-foreground">:</span>
                            <MoneyText cents={seg.spentCents} tone="default" className="hidden sm:inline-block text-muted-foreground shrink-0 tabular-nums font-medium" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Diálogo Raio-X de Categoria (Responsivo / BottomSheet no mobile / Modal no desktop) */}
          <CategoryBreakdownDialog
            open={selectedCategoryId !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedCategoryId(null);
            }}
            category={selectedCategory}
            month={month}
            limitCents={selectedLimitCents}
            spentWeightedCents={selectedSpentWeightedCents}
            spentGrossCents={selectedSpentGrossCents}
            prevSpentWeightedCents={selectedPrevSpentWeightedCents}
            expenses={selectedExpenses}
            cards={cardsQuery.data ?? []}
          />

          {/* Diálogo Outros Orçamentos (Responsivo / BottomSheet no mobile / Modal no desktop) */}
          <OtherBudgetsDialog
            open={isOthersBudgetOpen}
            onOpenChange={setIsOthersBudgetOpen}
            month={month}
            rows={otherBudgetRows}
            onSelectCategory={(catId) => setSelectedCategoryId(catId)}
          />

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
