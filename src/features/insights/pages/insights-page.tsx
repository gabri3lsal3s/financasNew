import { useState } from "react";
import { Activity, Calendar, LineChart, Repeat } from "lucide-react";
import { ErrorState, Skeleton, Tabs } from "@/components/ui";
import { criticalAlerts } from "@/domain/insights/alerts";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { partitionFeedback, type FeedbackDecision, type FeedbackMap } from "@/domain/insights/feedback";
import {
  ESSENTIAL_CATEGORY_ICONS,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  weekendSpendingRatio,
  WEEKEND_RATIO_LIMIT,
} from "@/domain/insights";
import {
  buildChallengeOptions,
  buildLimitSuggestions,
  discretionaryChallenge,
  pickTopChallenges,
  typicalMonthlySpendCents,
  type CategorySpend,
  type BudgetUsage,
} from "@/domain/savings";
import { dailyBudget, endOfMonthProjection, pendingProjection, spendingPace } from "@/domain/projection";
import { budgetLimitsByCategory, budgetStatus, resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets";
import { computeOverview } from "@/domain/overview";
import { aggregateByWeekday } from "@/domain/reports";
import { numberToCents } from "@/domain/money";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {
  useBudgets,
  useCategories,
  useDebts,
  useExpenses,
  useFeedback,
  useIncomes,
  usePortfolioPosition,
  useSetFeedback,
} from "@/state";
import { DiagnosticsTab, ProjectionTab, RecurrencesTab, type WarningItem } from "../components";

/**
 * Insights (§3.7) — alertas críticos, assinaturas/recorrências com
 * aprendizado (ignorar/confirmar/restaurar), projeção & corte e diagnósticos.
 *
 * F19 — reuso de motores do domínio (computeOverview, aggregateByWeekday,
 * helpers compartilhados de budgets), fontes únicas de essencialidade e
 * investimentos reais da carteira nas projeções.
 */
export function InsightsPage() {
  const [tab, setTab] = useState("diagnostics");
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
  const debtsQuery = useDebts();
  const feedbackQuery = useFeedback();
  const setFeedback = useSetFeedback();
  const position = usePortfolioPosition();

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
    position.isLoading;

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
    position.error;

  const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
    items.reduce((acc, item) => acc + numberToCents(item.value * item.report_weight), 0);

  // KPIs do mês com peso de relatório + investimentos reais (F19 — entrega 6)
  const investmentsCents = position.monthlyContributionCents;
  const totals = computeOverview(weightedSum(incomesQuery.data ?? []), weightedSum(month0.data ?? []), investmentsCents);
  const { incomeCents, expenseCents, balanceCents, savingsRatePercent: savingsRateRaw } = totals;
  const savingsRate = savingsRateRaw ?? 0;
  const burnRate = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;

  // Ritmo de gastos: acumulado ÷ esperado (1 = no trilho).
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const todayISOStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const pace = spendingPace({ spentCents: expenseCents, monthlyBudgetCents: Math.max(1, incomeCents), dayOfMonth, daysInMonth });
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
    paceRatio,
    overspentBudgets,
    burnRatePercent: burnRate,
    projectedDeficit,
    savingsRatePercent: savingsRate,
  });

  // Assinaturas e recorrências: despesas dos últimos 4 meses (sem parcelas).
  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
  const allExpenses: ExpenseLike[] = [month0, month1, month2, month3]
    .flatMap((q, index) =>
      (q.data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: shiftMonth(month, -index),
        valueCents: numberToCents(e.value * e.report_weight),
        categoryId: e.category_id,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
        recurrenceId: e.recurrence_id,
      })),
    );
  const occurrences = detectRecurrences(allExpenses, { todayISO: todayISOStr });
  const feedbackMap: FeedbackMap = (feedbackQuery.data ?? {}) as Record<string, FeedbackDecision>;
  const { active: activeOccurrences, ignored: ignoredOccurrences } = partitionFeedback(occurrences, feedbackMap);

  const totalRecurringCents = activeOccurrences.reduce((acc, o) => acc + o.averageCents, 0);
  const totalAnnualRecurringCents = totalRecurringCents * 12;
  const canCutRecurringCents = activeOccurrences
    .filter((o) => o.tier === "can_cut")
    .reduce((acc, o) => acc + (o.savingsIfCutCents ?? o.averageCents), 0);
  const canCutAnnualCents = canCutRecurringCents * 12;

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

  const usages: BudgetUsage[] = (categoriesQuery.data ?? [])
    .filter((c) => c.type === "expense")
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month),
      spentCents: spentByCategory.get(c.id) ?? 0,
    }))
    .filter((u) => u.limitCents > 0);
  const limitSuggestions = buildLimitSuggestions(usages, incomeCents);

  // Diagnósticos
  const incomeByCategory = new Map<string, number>();
  for (const income of incomesQuery.data ?? []) {
    incomeByCategory.set(income.category_id, (incomeByCategory.get(income.category_id) ?? 0) + numberToCents(income.value * income.report_weight));
  }
  const concentration = incomeConcentration([...incomeByCategory.values()]);
  const health = savingsHealth(savingsRate);
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
  const weekdayDaily = weekdayTotals.slice(0, 5).reduce((acc, w) => acc + w.ponderadoCents, 0) / 5;
  const weekendDaily = weekdayTotals.slice(5).reduce((acc, w) => acc + w.ponderadoCents, 0) / 2;
  const weekendRatio = weekendSpendingRatio(weekdayDaily, weekendDaily);
  const weekendComparable = weekdayDaily > 0;

  const prevExpenseCents = weightedSum(month1.data ?? []);
  const trendSignificant = isSignificantTrend(expenseCents, prevExpenseCents);
  const trendPercent = prevExpenseCents > 0 ? ((expenseCents - prevExpenseCents) / prevExpenseCents) * 100 : 0;

  const handleFeedback = (occurrenceKey: string, decision: FeedbackDecision | null) => {
    setFeedback.mutate({ occurrenceKey, decision });
  };

  const warnings: WarningItem[] = [
    ...alerts.map((a) => ({
      id: a.id,
      variant: a.severity === "praise" ? ("success" as const) : ("warning" as const),
      message: `${a.title}: ${a.description}`,
    })),
    ...(concentration.alert
      ? [
          {
            id: "concentration",
            variant: "warning" as const,
            message:
              "Concentração de renda: uma única fonte representa mais de 60% da sua renda — diversifique suas fontes para maior segurança.",
          },
        ]
      : []),
    ...(weekendComparable && weekendRatio > WEEKEND_RATIO_LIMIT
      ? [
          {
            id: "weekend",
            variant: "warning" as const,
            message: `Gastos no fim de semana: seus gastos de fim de semana estão ${weekendRatio.toFixed(1)}× maiores que os de dias úteis.`,
          },
        ]
      : []),
    ...(trendSignificant
      ? [
          {
            id: "trend",
            variant: trendPercent > 0 ? ("warning" as const) : ("success" as const),
            message:
              trendPercent > 0
                ? `Tendência de alta: gastos ${trendPercent.toFixed(1)}% acima do mês anterior.`
                : `Tendência de redução: gastos ${Math.abs(trendPercent).toFixed(1)}% abaixo do mês anterior.`,
          },
        ]
      : []),
    // Radar de Vencimentos & Inteligência Fiscal de Renda Fixa (Fase 63/72)
    ...position.rows
      .filter((r) => r.isMatured)
      .map((r) => ({
        id: `matured-${r.assetId}`,
        variant: "warning" as const,
        message: `Título Vencido: O ativo ${r.ticker} atingiu a data de vencimento (${r.maturityDate}). Realize o resgate para voltar a rentabilizar seu capital.`,
      })),
    ...position.rows
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
    ...position.rows
      .filter((r) => r.fixedIncomeResult?.taxCountdown && r.fixedIncomeResult.taxCountdown.daysRemaining <= 30)
      .map((r) => ({
        id: `tax-opt-${r.assetId}`,
        variant: "success" as const,
        message: `Otimização Fiscal: A alíquota de IR de ${r.ticker} reduzirá para ${r.fixedIncomeResult!.taxCountdown!.nextRatePct}% em ${r.fixedIncomeResult!.taxCountdown!.daysRemaining} dia(s). Aguarde para resgatar com menor retenção.`,
      })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Insights
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Diagnósticos inteligentes, assinaturas recorrentes e projeções de gastos
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground sm:self-auto shrink-0">
          <Calendar className="size-3.5" aria-hidden="true" />
          <span>
            Referência: <strong className="font-medium text-foreground">{monthLabel(month)}</strong>
          </span>
        </div>
      </header>

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={setTab}
          swipeable
          items={[
            {
              value: "diagnostics",
              label: "Diagnósticos",
              icon: <Activity className="size-4" aria-hidden="true" />,
              content: (
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
                />
              ),
            },
            {
              value: "recurrences",
              label: "Recorrências",
              icon: <Repeat className="size-4" aria-hidden="true" />,
              content: (
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
                />
              ),
            },
            {
              value: "projection",
              label: "Projeção",
              icon: <LineChart className="size-4" aria-hidden="true" />,
              content: (
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
                  limitSuggestions={limitSuggestions}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
