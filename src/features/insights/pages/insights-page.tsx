import { useState } from "react";
import { useSearchParams } from "react-router";
import { Activity, Calendar, LineChart, Repeat } from "lucide-react";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { criticalAlerts } from "@/domain/insights/alerts";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { partitionFeedback, type FeedbackDecision, type FeedbackMap } from "@/domain/insights/feedback";
import {
  calculateRecurringTotals,
  calculateWeekdayWeekendDailyAverages,
  essentialSpendingRatio,
  ESSENTIAL_CATEGORY_ICONS,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  weekendSpendingRatio,
} from "@/domain/insights";
import {
  buildChallengeOptions,
  discretionaryChallenge,
  pickTopChallenges,
  typicalMonthlySpendCents,
  type CategorySpend,
} from "@/domain/savings";
import { dailyBudget, endOfMonthProjection, pendingProjection, spendingPace } from "@/domain/projection";
import { budgetLimitsByCategory, budgetStatus, realizedByCategoryMap, resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets";
import { computeOverview } from "@/domain/overview";
import { aggregateByWeekday } from "@/domain/reports";
import { isCashAssetClass } from "@/domain/portfolio";
import { numberToCents, sumGrossCents } from "@/domain/money";

import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {
  useBudgets,
  useCategories,
  useCreditCards,
  useDebts,
  useExpenses,
  useFeedback,
  useIncomes,
  usePortfolioPosition,
  useRealCashBalance,
  useSetFeedback,
} from "@/state";
import { DiagnosticsTab, ProjectionTab, RecurrencesTab, type WarningItem } from "../components";

export type InsightFilter = "diagnostics" | "recurrences" | "occurrences" | "projection" | "all";

type ActiveTab = "diagnostics" | "recurrences" | "projection";

interface FilterItem {
  value: ActiveTab;
  label: string;
  icon: React.ReactNode;
}

const FILTER_ITEMS: FilterItem[] = [
  { value: "diagnostics", label: "Diagnósticos", icon: <Activity className="size-3.5" aria-hidden="true" /> },
  { value: "recurrences", label: "Recorrências", icon: <Repeat className="size-3.5" aria-hidden="true" /> },
  { value: "projection", label: "Projeção", icon: <LineChart className="size-3.5" aria-hidden="true" /> },
];

/**
 * Insights (§3.7) — Central Modular de Inteligência Financeira.
 * Estruturada exclusivamente em cards analíticos isolados:
 * - Diagnósticos de Hábitos & Alertas
 * - Bloco de Ocorrências e Gastos Frequentes (Radar de recorrências com aprendizado)
 * - Bloco de Projeção Financeira e Runway (Fechamento projetado, runway e cortes)
 * - Bloco de Planejamento FIRE & Reserva
 */
export function InsightsPage({
  showHeader = true,
  initialFilter = "diagnostics",
}: {
  showHeader?: boolean;
  initialFilter?: InsightFilter;
} = {}) {
  let searchParams: URLSearchParams | null = null;
  let setSearchParams: ReturnType<typeof useSearchParams>[1] | null = null;

  try {
    const routerParams = useSearchParams();
    searchParams = routerParams[0];
    setSearchParams = routerParams[1];
  } catch {
    // Permite renderização resiliente fora de Router (testes unitários isolados)
  }

  const rawTab = searchParams?.get("aba");
  const resolveTab = (val: string | null | undefined): ActiveTab => {
    if (val === "recurrences" || val === "occurrences") return "recurrences";
    if (val === "projection" || val === "planning") return "projection";
    return "diagnostics";
  };

  const [filter, setFilter] = useState<ActiveTab>(() =>
    rawTab ? resolveTab(rawTab) : resolveTab(initialFilter),
  );
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState(false);
  const month = currentMonth();

  const month0 = useExpenses(month);
  const month1 = useExpenses(shiftMonth(month, -1));
  const month2 = useExpenses(shiftMonth(month, -2));
  const month3 = useExpenses(shiftMonth(month, -3));
  const incomesQuery = useIncomes(month);
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards();
  const debtsQuery = useDebts();
  const feedbackQuery = useFeedback();
  const setFeedback = useSetFeedback();
  const position = usePortfolioPosition();
  const realCashQuery = useRealCashBalance();

  const loading =
    month0.isLoading ||
    month1.isLoading ||
    month2.isLoading ||
    month3.isLoading ||
    incomesQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    debtsQuery.isLoading ||
    feedbackQuery.isLoading ||
    position.isLoading ||
    realCashQuery.isLoading;

  const error =
    month0.error ??
    month1.error ??
    month2.error ??
    month3.error ??
    incomesQuery.error ??
    budgetsQuery.error ??
    categoriesQuery.error ??
    debtsQuery.error ??
    feedbackQuery.error ??
    position.error ??
    realCashQuery.error;

  // KPIs do mês: realidade de caixa bruto (entradas e saídas reais) + investimentos reais
  const investmentsCents = position.monthlyContributionCents;
  const grossIncomeCents = sumGrossCents(incomesQuery.data ?? []);
  const grossExpenseCents = sumGrossCents(month0.data ?? []);
  const totals = computeOverview(grossIncomeCents, grossExpenseCents, investmentsCents);
  const { incomeCents, expenseCents, balanceCents, savingsRatePercent: savingsRateRaw } = totals;

  const pastMonthlyExpenses = [month1, month2, month3]
    .map((m) => sumGrossCents(m.data ?? []))
    .filter((v) => v > 0);
  const averagePastExpensesCents = pastMonthlyExpenses.length > 0
    ? Math.round(pastMonthlyExpenses.reduce((a, b) => a + b, 0) / pastMonthlyExpenses.length)
    : 0;

  const savingsRate = savingsRateRaw ?? 0;
  const burnRate = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;

  // Ritmo de gastos: acumulado ÷ esperado (1 = no trilho).
  // Suavização da base de orçamento: se as receitas ainda não caíram no mês corrente (incomeCents < despesas passadas),
  // utiliza a média histórica de despesas como teto de referência para não disparar falso alarme prematuro.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const todayISOStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const effectiveMonthlyBudgetCents = incomeCents > 0
    ? Math.max(incomeCents, averagePastExpensesCents)
    : Math.max(1, averagePastExpensesCents);
  const pace = spendingPace({ spentCents: expenseCents, monthlyBudgetCents: effectiveMonthlyBudgetCents, dayOfMonth, daysInMonth });
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;

  // Orçamentos estourados no mês (com herança) — helpers compartilhados (F19).
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = budgetLimitsByCategory(budgets);
  const spentByCategory = spentByCategoryMap(month0.data ?? []);
  const spentByMonth = [month0, month1, month2, month3].map((q) => spentByCategoryMap(q.data ?? []));
  const overspentBudgets = (categoriesQuery.data ?? [])
    .filter((c) => c.type === "expense")
    .map((c) => ({
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month),
      spentCents: spentByCategory.get(c.id) ?? 0,
    }))
    .filter((row) => row.limitCents > 0 && budgetStatus(row.spentCents, row.limitCents) === "exceeded").length;

  // Déficit projetado (dia ≥ 10 e fora do trilho) — com investimentos reais.
  const projection = endOfMonthProjection({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });
  const projectedDeficit = dayOfMonth >= 10 && projection.onTrack === false;

  const alerts = criticalAlerts({
    balanceCents,
    incomeCents,
    expenseCents,
    paceRatio,
    overspentBudgets,
    burnRatePercent: burnRate,
    projectedDeficit,
    savingsRatePercent: savingsRate,
  });

  // Assinaturas e recorrências: despesas dos últimos 4 meses (sem parcelas).
  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
  const cardById = new Map((cardsQuery.data ?? []).map((c) => [c.id, c]));
  const allExpenses: ExpenseLike[] = [month0, month1, month2, month3]
    .flatMap((q, index) =>
      (q.data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: shiftMonth(month, -index),
        valueCents: numberToCents(e.value * e.report_weight),
        categoryId: e.category_id,
        categoryName: categoryById.get(e.category_id)?.name ?? null,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
        recurrenceId: e.recurrence_id,
        paymentMethod: e.payment_method,
        cardId: e.card_id,
        cardName: e.card_id ? cardById.get(e.card_id)?.name ?? null : null,
        rawExpense: e,
      })),
    );
  const occurrences = detectRecurrences(allExpenses, { todayISO: todayISOStr });
  const feedbackMap: FeedbackMap = (feedbackQuery.data ?? {}) as Record<string, FeedbackDecision>;
  const { active: activeOccurrences, ignored: ignoredOccurrences } = partitionFeedback(occurrences, feedbackMap);

  const {
    totalRecurringCents,
    totalAnnualRecurringCents,
    canCutRecurringCents,
    canCutAnnualCents,
  } = calculateRecurringTotals(activeOccurrences);


  // Projeção diária
  const daily = dailyBudget({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });

  // Pendências
  const rangeStart = `${month}-01`;
  const pending = (debtsQuery.data ?? [])
    .filter((d) => d.paid_at === null && d.due_date >= rangeStart)
    .map((d) => ({
      id: d.id,
      kind: d.type === "receivable" ? ("receivable" as const) : ("payable" as const),
      remainingCents: numberToCents(d.amount),
    }));
  const pendingSummary = pendingProjection(pending);

  // Desafios e sugestões de corte
  const categorySpends: CategorySpend[] = (categoriesQuery.data ?? [])
    .filter((c) => c.type === "expense")
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      monthlyAvgCents: typicalMonthlySpendCents(spentByMonth.map((m) => m.get(c.id) ?? 0)),
      essential: c.icon != null && ESSENTIAL_CATEGORY_ICONS.has(c.icon),
    }));
  const challenges = pickTopChallenges(buildChallengeOptions(categorySpends, incomeCents));
  const discretionary = discretionaryChallenge(categorySpends, incomeCents);
  const showDiscretionary = discretionary !== null && discretionary.categoryCount >= 2;

  // Diagnósticos
  const incomeEntries = incomesQuery.data ?? [];
  const incomeByCategory = realizedByCategoryMap(incomeEntries);
  // Se houver apenas 1 fonte e ela for a única cadastrada, não gerar alerta punitivo
  const isSingleSalarySource = incomeEntries.length === 1;
  const concentration = incomeConcentration([...incomeByCategory.values()], { isSingleSalarySource });
  const health = savingsHealth(savingsRate);

  // Contagem calibrada de dias decorridos de cada tipo no mês atual até hoje
  let elapsedWeekdaysCount = 0;
  let elapsedWeekendDaysCount = 0;
  const [yearStr, monthNumStr] = month.split("-");
  const yr = Number(yearStr ?? now.getFullYear());
  const mo = Number(monthNumStr ?? now.getMonth() + 1) - 1;
  const limitDay = month === currentMonth() ? Math.min(dayOfMonth, daysInMonth) : daysInMonth;

  for (let d = 1; d <= limitDay; d++) {
    const dayOfWeek = new Date(yr, mo, d).getDay(); // 0 = Dom, 6 = Sáb
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      elapsedWeekendDaysCount++;
    } else {
      elapsedWeekdaysCount++;
    }
  }

  const weekdayTotals = aggregateByWeekday(
    (month0.data ?? []).map((e) => ({
      id: e.id,
      date: e.date,
      kind: "expense" as const,
      categoryId: e.category_id,
      categoryName: "",
      baseCents: numberToCents(e.value),
      weight: e.report_weight,
    })),
  );
  const { weekdayDailyCents: weekdayDaily, weekendDailyCents: weekendDaily } =
    calculateWeekdayWeekendDailyAverages(weekdayTotals, {
      elapsedWeekdaysCount: Math.max(1, elapsedWeekdaysCount),
      elapsedWeekendDaysCount: Math.max(1, elapsedWeekendDaysCount),
    });
  const weekendRatio = weekendSpendingRatio(weekdayDaily, weekendDaily);
  const weekendComparable = weekdayDaily > 0;

  const prevExpenseCents = sumGrossCents(month1.data ?? []);
  const trendSignificant = isSignificantTrend(expenseCents, prevExpenseCents);
  const trendPercent = prevExpenseCents > 0 ? ((expenseCents - prevExpenseCents) / prevExpenseCents) * 100 : 0;

  // Comprometimento Essencial (Regra 50/30/20) baseado no total bruto real
  const essentialExpensesCents = (month0.data ?? [])
    .filter((e) => {
      const cat = categoryById.get(e.category_id);
      return cat?.icon != null && ESSENTIAL_CATEGORY_ICONS.has(cat.icon);
    })
    .reduce((acc, e) => acc + numberToCents(e.value), 0);
  const essentialSpending = essentialSpendingRatio(essentialExpensesCents, expenseCents);

  const handleFeedback = (occurrenceKey: string, decision: FeedbackDecision | null) => {
    setFeedback.mutate({ occurrenceKey, decision });
  };

  const warnings: WarningItem[] = [
    // Alertas críticos e acionáveis (saldo negativo, ritmo, estouros de limite, déficit projetado, etc.)
    ...alerts.map((a) => ({
      id: a.id,
      variant:
        a.severity === "critical"
          ? ("error" as const)
          : a.severity === "praise"
            ? ("success" as const)
            : ("warning" as const),
      message: `${a.title}: ${a.description}`,
    })),
    // Radar de Vencimentos & Inteligência Fiscal de Renda Fixa (Fase 63/72)
    ...(position.rows ?? [])
      .filter((r) => r.isMatured)
      .map((r) => ({
        id: `matured-${r.assetId}`,
        variant: "warning" as const,
        message: `Título Vencido: O ativo ${r.ticker} atingiu a data de vencimento (${r.maturityDate}). Realize o resgate para voltar a rentabilizar seu capital.`,
      })),
    ...(position.rows ?? [])
      .filter((r) => !r.isMatured && r.maturityDate)
      .filter((r) => {
        if (!r.maturityDate) return false;
        const diffMs = new Date(r.maturityDate).getTime() - new Date(todayISOStr).getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
      })
      .map((r) => {
        const diffMs = new Date(r.maturityDate!).getTime() - new Date(todayISOStr).getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return {
          id: `maturing-${r.assetId}`,
          variant: "warning" as const,
          message: `Vencimento Próximo: O ativo ${r.ticker} vencerá em ${diffDays} dia(s) (${r.maturityDate}). Planeje a reinvestimento do montante.`,
        };
      }),
    ...(position.rows ?? [])
      .filter((r) => r.fixedIncomeResult?.taxCountdown && r.fixedIncomeResult.taxCountdown.daysRemaining <= 30)
      .map((r) => ({
        id: `tax-opt-${r.assetId}`,
        variant: "success" as const,
        message: `Otimização Fiscal: A alíquota de IR de ${r.ticker} reduzirá para ${r.fixedIncomeResult!.taxCountdown!.nextRatePct}% em ${r.fixedIncomeResult!.taxCountdown!.daysRemaining} dia(s). Aguarde para resgatar com menor retenção.`,
      })),
  ];

  // Reserva de Emergência e Autonomia Financeira
  const portfolioCashCents = (position.rows ?? [])
    .filter((r) => r.isCash || isCashAssetClass(r.assetClass))
    .reduce((acc, r) => acc + Math.round((r.valueBRL ?? 0) * 100), 0);
  const realCashCents = Math.max(0, realCashQuery.cashBalance?.currentBalanceCents ?? 0);
  const detectedReserveCents = (realCashCents + portfolioCashCents) > 0
    ? (realCashCents + portfolioCashCents)
    : Math.max(0, balanceCents);

  const baselineMonthlyExpensesCents = averagePastExpensesCents > 0
    ? averagePastExpensesCents
    : (projection.projectedExpensesCents ?? expenseCents);

  const runwayMonths = baselineMonthlyExpensesCents > 0
    ? detectedReserveCents / baselineMonthlyExpensesCents
    : null;

  const handleFilterChange = (nextFilter: ActiveTab) => {
    triggerSensory("selection");
    setFilter(nextFilter);
    if (searchParams && setSearchParams) {
      if (nextFilter === "diagnostics") {
        searchParams.delete("aba");
      } else {
        searchParams.set("aba", nextFilter);
      }
      setSearchParams(searchParams, { replace: true });
    }
  };

  const diagnosticsContent = (
    <DiagnosticsTab
      warnings={warnings}
      expandedWarnings={expandedWarnings}
      setExpandedWarnings={setExpandedWarnings}
      health={health}
      savingsRate={savingsRate}
      burnRate={burnRate}
      concentration={concentration}
      weekendComparable={weekendComparable}
      weekendRatio={weekendRatio}
      trendSignificant={trendSignificant}
      trendPercent={trendPercent}
      overspentBudgets={overspentBudgets}
      essentialSpending={essentialSpending}
    />
  );

  const recurrencesContent = (
    <RecurrencesTab
      totalRecurringCents={totalRecurringCents}
      totalAnnualRecurringCents={totalAnnualRecurringCents}
      canCutRecurringCents={canCutRecurringCents}
      canCutAnnualCents={canCutAnnualCents}
      activeOccurrences={activeOccurrences}
      ignoredOccurrences={ignoredOccurrences}
      feedbackMap={feedbackMap}
      showIgnored={showIgnored}
      setShowIgnored={setShowIgnored}
      onFeedback={handleFeedback}
      cards={cardsQuery.data ?? []}
      initialSelectedKey={searchParams?.get("item") || undefined}
      monthlyIncomeCents={incomeCents}
    />
  );

  const projectionContent = (
    <ProjectionTab
      dailyCents={daily.dailyCents}
      projectedExpensesCents={projection.projectedExpensesCents}
      surplusCents={projection.surplusCents}
      onTrack={projection.onTrack}
      spentPercent={pace.spentPercent}
      elapsedPercent={pace.elapsedPercent}
      paceActive={pace.active}
      pendingSummary={pendingSummary}
      challenges={challenges}
      showDiscretionary={showDiscretionary}
      discretionary={discretionary}
      balanceCents={balanceCents}
      monthlyExpensesCents={expenseCents}
      runwayMonths={runwayMonths}
      liquidReserveCents={detectedReserveCents}
      baselineMonthlyExpensesCents={baselineMonthlyExpensesCents}
      monthlySavingsVelocityCents={Math.max(0, balanceCents)}
      referenceMonth={month}
    />
  );

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {showHeader ? (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Insights & Inteligência
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
              Diagnósticos preditivos, radar de recorrências, oportunidades de economia e saúde financeira
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs text-muted-foreground sm:self-auto shrink-0 shadow-xs">
            <Calendar className="size-3.5" aria-hidden="true" />
            <span>
              Referência: <strong className="font-medium text-foreground">{monthLabel(month)}</strong>
            </span>
          </div>
        </header>
      ) : null}

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {/* Barra de Filtro Rápido com Pills */}
      <div
        role="tablist"
        aria-label="Filtro de seções de insights"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 -mx-1 px-1"
      >
        {FILTER_ITEMS.map((item) => {
          const isSelected = filter === item.value;
          return (
            <Button
              key={item.value}
              role="tab"
              aria-selected={isSelected}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(item.value)}
              className={cn(
                "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
                isSelected
                  ? "shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-w-0">
          {filter === "diagnostics" && diagnosticsContent}
          {filter === "recurrences" && recurrencesContent}
          {filter === "projection" && projectionContent}
        </div>
      )}
    </div>
  );
}
