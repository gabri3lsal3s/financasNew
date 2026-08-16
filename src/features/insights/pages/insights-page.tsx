import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Flame,
  Lightbulb,
  PiggyBank,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Alert, Badge, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { AlertCard, InsightList, PlanningSection, ProjectionLine } from "@/components/modules";
import { criticalAlerts } from "@/domain/insights/alerts";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { applyFeedback, type FeedbackDecision } from "@/domain/insights/feedback";
import {
  ESSENTIAL_CATEGORY_ICONS,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  SAVINGS_HEALTH_LABELS,
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
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
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
import { cn } from "@/lib/utils";

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
    feedbackQuery.error;

  const weightedSum = (items: readonly { value: number; report_weight: number }[]) =>
    items.reduce((acc, item) => acc + numberToCents(item.value * item.report_weight), 0);

  // KPIs do mês com peso de relatório + investimentos reais (F19 — entrega 6):
  // o saldo considera a saída mensal de investimentos (aporte líquido da
  // carteira), alinhando Insights à Home pós-F16.
  const investmentsCents = position.monthlyContributionCents;
  const totals = computeOverview(weightedSum(incomesQuery.data ?? []), weightedSum(month0.data ?? []), investmentsCents);
  const { incomeCents, expenseCents, balanceCents, savingsRatePercent: savingsRate } = totals;
  const burnRate = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;

  // Ritmo de gastos: acumulado ÷ esperado (1 = no trilho).
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const pace = spendingPace({ spentCents: expenseCents, monthlyBudgetCents: Math.max(1, incomeCents), dayOfMonth, daysInMonth });
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;

  // Orçamentos estourados no mês (com herança) — helpers compartilhados (F19).
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = budgetLimitsByCategory(budgets);
  // F27 — mapa por mês (4 meses) para a média real dos desafios; o mapa do
  // mês atual segue sendo usado por estouros e sugestões de limite.
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

  // Assinaturas e recorrências: despesas dos últimos 3 meses (sem parcelas).
  // Map de categorias pré-computado — O(n²) → O(n) (F19).
  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
  const allExpenses: ExpenseLike[] = [month0, month1, month2, month3]
    .flatMap((q, index) =>
      (q.data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        month: shiftMonth(month, -index),
        valueCents: numberToCents(e.value * e.report_weight),
        categoryId: e.category_id,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
      })),
    );
  const occurrences = detectRecurrences(allExpenses);
  const feedbackMap = (feedbackQuery.data ?? {}) as Record<string, FeedbackDecision>;
  const visible = applyFeedback(occurrences, feedbackMap);

  // Totais das recorrências para o painel de resumo
  const activeOccurrences = visible.filter((o) => feedbackMap[o.key] !== "ignore");
  const totalRecurringCents = activeOccurrences.reduce((acc, o) => acc + o.averageCents, 0);
  const totalAnnualRecurringCents = totalRecurringCents * 12;
  const canCutRecurringCents = activeOccurrences
    .filter((o) => o.tier === "can_cut")
    .reduce((acc, o) => acc + (o.savingsIfCutCents ?? o.averageCents), 0);
  const canCutAnnualCents = canCutRecurringCents * 12;
  const confirmedCount = visible.filter((o) => feedbackMap[o.key] === "confirm").length;
  const pendingCount = visible.filter((o) => !feedbackMap[o.key]).length;

  // Projeção & corte.
  const daily = dailyBudget({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents,
    expensesCents: expenseCents,
    dayOfMonth,
    daysInMonth,
  });

  // Pendências.
  const rangeStart = `${month}-01`;
  const pending = (debtsQuery.data ?? [])
    .filter((d) => d.paid_at === null && d.due_date >= rangeStart)
    .map((d) => ({
      id: d.id,
      kind: d.type === "receivable" ? ("receivable" as const) : ("payable" as const),
      remainingCents: numberToCents(d.amount),
    }));
  const pendingSummary = pendingProjection(pending);

  // Desafios e sugestões de corte — essencialidade pela fonte única (F19) e
  // média mensal real (F27): média dos meses com gasto, não o mês isolado.
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
  // F27 — sem repetição: com 1 única categoria elegível, o desafio individual
  // (30% dela) já cobre o mesmo número; a linha agregada só agrega quando há
  // 2+ categorias na base.
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

  // Diagnósticos — agregador de dia da semana compartilhado (F19).
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
  // Monday-first: 0–4 úteis, 5–6 fim de semana — médias diárias (÷5 / ÷2).
  const weekdayDaily = weekdayTotals.slice(0, 5).reduce((acc, w) => acc + w.ponderadoCents, 0) / 5;
  const weekendDaily = weekdayTotals.slice(5).reduce((acc, w) => acc + w.ponderadoCents, 0) / 2;
  const weekendRatio = weekendSpendingRatio(weekdayDaily, weekendDaily);
  // F27 — sem dados de dia útil a comparação não faz sentido (evita "inf" e
  // alertas absurdos de "gastos inf maiores"): exibe "—" e não alerta.
  const weekendComparable = weekdayDaily > 0;

  // Tendência significativa vs mês anterior (motor §3.7.6 — F19 entrega 5).
  const prevExpenseCents = weightedSum(month1.data ?? []);
  const trendSignificant = isSignificantTrend(expenseCents, prevExpenseCents);
  const trendPercent = prevExpenseCents > 0 ? ((expenseCents - prevExpenseCents) / prevExpenseCents) * 100 : 0;

  const handleFeedback = (occurrenceKey: string, decision: FeedbackDecision | null) => {
    setFeedback.mutate({ occurrenceKey, decision });
  };

  const hasDiagnosticAlerts =
    concentration.alert || (weekendComparable && weekendRatio > WEEKEND_RATIO_LIMIT) || trendSignificant;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Insights</h1>
          <p className="text-sm text-muted-foreground">Análise do seu consumo, projeção e corte de gastos.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground sm:self-auto">
          <Calendar className="size-3.5" aria-hidden="true" />
          <span>
            Referência: <strong className="font-medium text-foreground">{monthLabel(month)}</strong>
          </span>
        </div>
      </header>

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
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
              label: "Alertas & Diagnósticos",
              content: (
                <div className="flex flex-col gap-6 min-w-0">
                  {/* Bloco 1: Alertas Críticos */}
                  <section aria-label="Alertas críticos" className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Alertas Críticos
                      </h2>
                      {alerts.length > 0 ? (
                        <Badge variant="warning">{alerts.length} ativo(s)</Badge>
                      ) : (
                        <Badge variant="positive">Tudo em dia</Badge>
                      )}
                    </div>

                    {alerts.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-positive/30 bg-positive/5 p-4 text-xs">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 text-positive-strong">
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <p className="font-medium text-foreground">Nenhum alerta crítico ativo no momento.</p>
                          <p className="text-muted-foreground">Seu ritmo de gastos e limites estão sob controle neste mês.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {alerts.map((alert) => (
                          <AlertCard
                            key={alert.id}
                            priority={alert.priority as 1 | 2 | 3 | 4 | 5 | 6}
                            title={alert.title}
                            description={alert.description}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Bloco 2: Diagnóstico Financeiro (Grid 3x2 equilibrado) */}
                  <section aria-label="Diagnóstico financeiro" className="flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Diagnóstico de Hábitos & Indicadores
                    </h2>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-w-0">
                      <DiagnosticCard
                        icon={<PiggyBank className="size-4" aria-hidden="true" />}
                        label="Saúde da poupança"
                        value={SAVINGS_HEALTH_LABELS[health]}
                        subtitle="Capacidade de poupar"
                        tone={health === "forte" || health === "saudavel" ? "positive" : health === "moderado" ? "neutral" : "negative"}
                      />
                      <DiagnosticCard
                        icon={<Zap className="size-4" aria-hidden="true" />}
                        label="Taxa de poupança"
                        value={`${savingsRate.toFixed(1)}%`}
                        subtitle="Meta ideal: 20%+"
                        tone={savingsRate >= 20 ? "positive" : savingsRate >= 0 ? "neutral" : "negative"}
                      />
                      <DiagnosticCard
                        icon={<Flame className="size-4" aria-hidden="true" />}
                        label="Taxa de consumo"
                        value={`${burnRate.toFixed(0)}%`}
                        subtitle="Despesas / Renda"
                        tone={burnRate > 85 ? "negative" : burnRate > 70 ? "neutral" : "positive"}
                      />
                      <DiagnosticCard
                        icon={<Wallet className="size-4" aria-hidden="true" />}
                        label="Concentração de renda"
                        value={`${concentration.topSharePercent.toFixed(0)}%`}
                        subtitle="Na principal fonte"
                        tone={concentration.alert ? "negative" : "positive"}
                      />
                      <DiagnosticCard
                        icon={<Calendar className="size-4" aria-hidden="true" />}
                        label="Gastos fim de semana"
                        value={weekendComparable ? `${weekendRatio.toFixed(1)}×` : "—"}
                        subtitle="vs. dias úteis"
                        tone={weekendComparable ? (weekendRatio > WEEKEND_RATIO_LIMIT ? "negative" : "positive") : "neutral"}
                      />
                      <DiagnosticCard
                        icon={trendPercent >= 0 ? <TrendingUp className="size-4" aria-hidden="true" /> : <TrendingDown className="size-4" aria-hidden="true" />}
                        label="Tendência de gastos"
                        value={`${trendPercent >= 0 ? "+" : ""}${trendPercent.toFixed(1)}%`}
                        subtitle="vs. mês anterior"
                        tone={trendSignificant ? (trendPercent > 0 ? "negative" : "positive") : "neutral"}
                      />
                    </div>
                  </section>

                  {/* Bloco 3: Avisos e Oportunidades Contextuais */}
                  {hasDiagnosticAlerts ? (
                    <section aria-label="Avisos e oportunidades" className="flex flex-col gap-2.5">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Avisos & Recomendações
                      </h2>
                      <div className="flex flex-col gap-2">
                        {concentration.alert ? (
                          <Alert variant="warning">
                            Uma única fonte representa mais de 60% da sua renda — diversifique suas fontes para maior segurança.
                          </Alert>
                        ) : null}
                        {weekendComparable && weekendRatio > WEEKEND_RATIO_LIMIT ? (
                          <Alert variant="warning">
                            Seus gastos de fim de semana estão {weekendRatio.toFixed(1)}× maiores que os de dias úteis.
                          </Alert>
                        ) : null}
                        {trendSignificant ? (
                          <Alert variant={trendPercent > 0 ? "warning" : "success"}>
                            {trendPercent > 0
                              ? `Gastos ${trendPercent.toFixed(1)}% acima do mês anterior — tendência significativa de alta.`
                              : `Gastos ${Math.abs(trendPercent).toFixed(1)}% abaixo do mês anterior — tendência de redução.`}
                          </Alert>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              ),
            },
            {
              value: "recurrences",
              label: "Assinaturas & recorrências",
              content: (
                <div className="flex flex-col gap-4">
                  {/* Card de Resumo de Recorrências */}
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6 min-w-0">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Total mensal recorrente</span>
                          <div className="flex items-baseline gap-1.5">
                            <MoneyText cents={totalRecurringCents} tone="default" className="text-xl sm:text-2xl font-bold" />
                            <span className="text-xs text-muted-foreground">/mês</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Total anual projetado</span>
                          <div className="flex items-baseline gap-1.5">
                            <MoneyText cents={totalAnnualRecurringCents} tone="default" className="text-xl sm:text-2xl font-bold" />
                            <span className="text-xs text-muted-foreground">/ano</span>
                          </div>
                        </div>
                        {canCutRecurringCents > 0 ? (
                          <div>
                            <span className="text-xs font-medium text-positive-strong">Economia potencial (corte)</span>
                            <div className="flex items-baseline gap-1.5">
                              <MoneyText cents={canCutRecurringCents} tone="positive" className="text-xl sm:text-2xl font-bold" />
                              <span className="text-xs text-muted-foreground">/mês (<MoneyText cents={canCutAnnualCents} tone="positive" />/ano)</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs self-start sm:self-center">
                        <Badge variant="default">{activeOccurrences.length} ativa(s)</Badge>
                        {confirmedCount > 0 ? <Badge variant="positive">{confirmedCount} confirmada(s)</Badge> : null}
                        {pendingCount > 0 ? <Badge variant="warning">{pendingCount} a revisar</Badge> : null}
                      </div>
                    </div>
                  </div>

                  {/* Lista de Recorrências */}
                  <section aria-label="Lista de assinaturas e recorrências" className="flex flex-col gap-2">
                    <InsightList
                      items={visible.map((o) => {
                        const badges: { label: string; tone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted" }[] = [];
                        if (o.tier === "can_cut") {
                          badges.push({ label: "Pode cortar", tone: "positive" });
                        } else if (o.tier === "discretionary") {
                          badges.push({ label: "Discricionário", tone: "default" });
                        } else if (o.tier === "essential") {
                          badges.push({ label: "Essencial", tone: "default" });
                        }

                        if (o.priceAdjustment) {
                          badges.push({ label: `+${o.priceAdjustment.percentIncrease}% reajuste`, tone: "warning" });
                        }

                        if (o.duplicateChargesThisMonth && o.duplicateChargesThisMonth > 1) {
                          badges.push({ label: `${o.duplicateChargesThisMonth}x no mês`, tone: "warning" });
                        }

                        return {
                          key: o.key,
                          title: o.name,
                          subtitle: `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`,
                          confidence: o.confidence,
                          amountCents: o.averageCents,
                          badges,
                          icon: <Repeat className="size-4" aria-hidden="true" />,
                        };
                      })}
                      feedback={feedbackMap}
                      onIgnore={(key) => handleFeedback(key, "ignore")}
                      onConfirm={(key) => handleFeedback(key, "confirm")}
                      onRestore={(key) => handleFeedback(key, null)}
                      emptyLabel="Nenhuma assinatura ou recorrência detectada nos últimos meses."
                    />
                  </section>

                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
                    <Lightbulb className="size-4 shrink-0 text-warning-strong" aria-hidden="true" />
                    <span>
                      O aprendizado persiste: ocorrências ignoradas deixam de contar nas análises e confirmadas ficam marcadas permanentemente.
                    </span>
                  </div>
                </div>
              ),
            },
            {
              value: "projection",
              label: "Projeção & corte",
              content: (
                <div className="flex flex-col gap-5">
                  {/* Bloco 1: Fechamento Projetado */}
                  <section aria-label="Fechamento do mês" className="flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Fechamento Projetado do Mês
                    </h2>

                    <div className="flex flex-col gap-3">
                      <ProjectionLine
                        dailyCents={daily.dailyCents}
                        projectedExpensesCents={projection.projectedExpensesCents}
                        surplusCents={projection.surplusCents}
                        onTrack={projection.onTrack}
                        spentPercent={pace.spentPercent}
                        elapsedPercent={pace.elapsedPercent}
                        paceActive={pace.active}
                      />

                      {/* Pendências projetadas */}
                      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                        <h3 className="text-sm font-semibold text-foreground">Pendências do período</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                            <p className="text-muted-foreground">A receber</p>
                            <MoneyText cents={pendingSummary.receivablesCents} tone="positive" className="text-sm font-semibold truncate" />
                          </div>
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                            <p className="text-muted-foreground">A pagar</p>
                            <MoneyText cents={pendingSummary.payablesCents} tone="negative" className="text-sm font-semibold truncate" />
                          </div>
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
                            <p className="text-muted-foreground">Saldo projetado das pendências</p>
                            <MoneyText cents={pendingSummary.balanceCents} tone={pendingSummary.balanceCents >= 0 ? "positive" : "negative"} className="text-sm font-semibold truncate" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Bloco 2: Oportunidades de Economia & Cortes */}
                  <section aria-label="Desafios de economia" className="flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Plano de Economia & Cortes
                    </h2>

                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning-strong">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">Desafios de economia sugeridos</h3>
                          <p className="text-[11px] text-muted-foreground truncate">Metas inteligentes de corte nas suas categorias de maior volume.</p>
                        </div>
                      </div>

                      {challenges.length === 0 && !showDiscretionary ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhum desafio sugerido no momento para os seus gastos atuais.</p>
                      ) : (
                        <div className="flex flex-col gap-2 min-w-0">
                          {challenges.map((challenge) => (
                            <div key={`${challenge.categoryId}-${challenge.percent}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs min-w-0">
                              <span className="font-medium text-foreground min-w-0 flex-1">
                                {challenge.name} — cortar {challenge.percent}% (meta{" "}
                                <MoneyText cents={challenge.targetCents} tone="default" className="privacy-mask text-xs" />)
                              </span>
                              <span className="num shrink-0 font-semibold text-positive-strong">
                                <MoneyText cents={-challenge.savingsCents} tone="positive" sign="explicit" />/mês
                              </span>
                            </div>
                          ))}
                          {showDiscretionary && discretionary ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-positive/40 bg-positive/5 p-3 text-xs min-w-0">
                              <span className="font-medium text-foreground min-w-0 flex-1">30% em não essenciais</span>
                              <span className="num shrink-0 font-semibold text-positive-strong">
                                <MoneyText cents={-discretionary.savingsCents} tone="positive" sign="explicit" />/mês
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Bloco 3: Otimização de Limites */}
                  <section aria-label="Sugestões de limite" className="flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Otimização de Limites
                    </h2>

                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Sugestões de ajuste de limite</h3>
                        <p className="text-[11px] text-muted-foreground">Ajustes recomendados para alinhar os limites de orçamento ao consumo real.</p>
                      </div>

                      {limitSuggestions.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhuma sugestão de ajuste de limite no momento.</p>
                      ) : (
                        <div className="flex flex-col gap-2 min-w-0">
                          {limitSuggestions.map((s) => (
                            <div key={`${s.categoryId}-${s.kind}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs min-w-0">
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="font-medium text-foreground truncate">{s.name}</span>
                                <span className="text-muted-foreground text-[11px]">{s.reason}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 font-semibold text-foreground">
                                <MoneyText cents={s.currentLimitCents} tone="default" />
                                <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                                <MoneyText cents={s.suggestedLimitCents} tone="default" />
                              </div>
                            </div>
                          ))}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Para aplicar uma sugestão, acesse a tela de Orçamentos e atualize o limite da categoria.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ),
            },
            {
              value: "planning",
              label: "Planejamento",
              content: <PlanningSection balanceCents={balanceCents} monthlyExpensesCents={Math.max(1, expenseCents)} />,
            },
          ]}
        />
      )}
    </div>
  );
}

interface DiagnosticCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
}

function DiagnosticCard({ icon, label, value, subtitle, tone }: DiagnosticCardProps) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "num text-lg sm:text-xl font-semibold truncate",
            tone === "positive" ? "text-positive-strong" : tone === "negative" ? "text-critical" : "text-foreground",
          )}
        >
          {value}
        </span>
        {subtitle ? <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span> : null}
      </div>
    </div>
  );
}
