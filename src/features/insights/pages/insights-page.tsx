import { useState } from "react";
import { Lightbulb, Repeat, Sparkles } from "lucide-react";
import { Alert, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { AlertCard, InsightList, ProjectionLine } from "@/components/modules";
import { criticalAlerts } from "@/domain/insights/alerts";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { applyFeedback, type FeedbackDecision } from "@/domain/insights/feedback";
import {
  incomeConcentration,
  savingsHealth,
  SAVINGS_HEALTH_LABELS,
  weekendSpendingRatio,
  WEEKEND_RATIO_LIMIT,
} from "@/domain/insights/diagnostics";
import {
  buildChallengeOptions,
  buildLimitSuggestions,
  discretionaryChallenge,
  pickTopChallenges,
  type CategorySpend,
  type BudgetUsage,
} from "@/domain/savings";
import { dailyBudget, endOfMonthProjection, pendingProjection, spendingPace } from "@/domain/projection";
import { budgetStatus, resolveEffectiveLimit } from "@/domain/budgets";
import { currentMonth, shiftMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {
  useBudgets,
  useCategories,
  useDebts,
  useExpenses,
  useFeedback,
  useIncomes,
  useSetFeedback,
} from "@/state";

const toCents = (value: number) => Math.round(value * 100);

const LEVEL_LABELS: Record<string, string> = {
  subscription: "Assinatura",
  recurring: "Recorrente",
  similar: "Similar",
};

/**
 * Insights (§3.7) — alertas críticos, assinaturas/recorrências com
 * aprendizado (ignorar/confirmar/restaurar), projeção & corte e diagnósticos.
 */
export function InsightsPage() {
  const [tab, setTab] = useState("alerts");
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

  const loading =
    month0.isLoading || month1.isLoading || month2.isLoading || month3.isLoading || incomesQuery.isLoading;
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

  const incomeCents = (incomesQuery.data ?? []).reduce((acc, i) => acc + toCents(i.value * i.report_weight), 0);
  const expenseCents = (month0.data ?? []).reduce((acc, e) => acc + toCents(e.value * e.report_weight), 0);
  const balanceCents = incomeCents - expenseCents;
  const savingsRate = incomeCents > 0 ? (balanceCents / incomeCents) * 100 : 0;
  const burnRate = incomeCents > 0 ? (expenseCents / incomeCents) * 100 : 0;

  // Ritmo de gastos: acumulado ÷ esperado (1 = no trilho).
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const pace = spendingPace({ spentCents: expenseCents, monthlyBudgetCents: Math.max(1, incomeCents), dayOfMonth, daysInMonth });
  const paceRatio = pace.active ? 1 + pace.gapPoints / 100 : 1;

  // Orçamentos estourados no mês (com herança).
  const budgets = budgetsQuery.data ?? [];
  const limitsByCategory = new Map<string, { month: string; limitCents: number }[]>();
  for (const budget of budgets) {
    const list = limitsByCategory.get(budget.category_id) ?? [];
    list.push({ month: budget.month, limitCents: toCents(budget.limit) });
    limitsByCategory.set(budget.category_id, list);
  }
  const spentByCategory = new Map<string, number>();
  for (const expense of month0.data ?? []) {
    spentByCategory.set(expense.category_id, (spentByCategory.get(expense.category_id) ?? 0) + toCents(expense.value * expense.report_weight));
  }
  const overspentBudgets = (categoriesQuery.data ?? [])
    .filter((c) => c.type === "expense")
    .map((c) => ({
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], month),
      spentCents: spentByCategory.get(c.id) ?? 0,
    }))
    .filter((row) => row.limitCents > 0 && budgetStatus(row.spentCents, row.limitCents) === "exceeded").length;

  // Déficit projetado (dia ≥ 10 e fora do trilho).
  const projection = endOfMonthProjection({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents: 0,
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
  const allExpenses: ExpenseLike[] = [month0, month1, month2, month3]
    .flatMap((q, index) =>
      (q.data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        month: shiftMonth(month, -index),
        valueCents: toCents(e.value * e.report_weight),
        categoryId: e.category_id,
        categoryIcon: categoriesQuery.data?.find((c) => c.id === e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
      })),
    );
  const occurrences = detectRecurrences(allExpenses);
  const feedbackMap = feedbackQuery.data ?? {};
  const visible = applyFeedback(occurrences, feedbackMap as Record<string, FeedbackDecision>);

  // Projeção & corte.
  const daily = dailyBudget({
    phase: "current",
    incomesCents: incomeCents,
    investmentsCents: 0,
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
      remainingCents: toCents(d.amount),
    }));
  const pendingSummary = pendingProjection(pending);

  // Desafios e sugestões de corte.
  const categorySpends: CategorySpend[] = (categoriesQuery.data ?? [])
    .filter((c) => c.type === "expense")
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      monthlyAvgCents: Math.round(spentByCategory.get(c.id) ?? 0),
      essential: isEssentialIcon(c.icon),
    }));
  const challenges = pickTopChallenges(buildChallengeOptions(categorySpends, incomeCents));
  const discretionary = discretionaryChallenge(categorySpends, incomeCents);

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

  // Diagnósticos.
  const incomeByCategory = new Map<string, number>();
  for (const income of incomesQuery.data ?? []) {
    incomeByCategory.set(income.category_id, (incomeByCategory.get(income.category_id) ?? 0) + toCents(income.value * income.report_weight));
  }
  const concentration = incomeConcentration([...incomeByCategory.values()]);
  const health = savingsHealth(savingsRate);
  const weekdayCents = new Map<number, number>();
  const weekendCents = new Map<number, number>();
  for (const expense of month0.data ?? []) {
    const d = new Date(`${expense.date}T12:00:00`);
    const weekday = (d.getDay() + 6) % 7;
    const cents = toCents(expense.value * expense.report_weight);
    if (weekday >= 5) weekendCents.set(weekday, (weekendCents.get(weekday) ?? 0) + cents);
    else weekdayCents.set(weekday, (weekdayCents.get(weekday) ?? 0) + cents);
  }
  const weekdayDaily = [...weekdayCents.values()].reduce((a, b) => a + b, 0) / 5;
  const weekendDaily = [...weekendCents.values()].reduce((a, b) => a + b, 0) / 2;
  const weekendRatio = weekendSpendingRatio(weekdayDaily, weekendDaily);

  const handleFeedback = (occurrenceKey: string, decision: FeedbackDecision | null) => {
    setFeedback.mutate({ occurrenceKey, decision });
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Insights</h1>
        <p className="text-sm text-muted-foreground">Análise do seu consumo, projeção e corte de gastos.</p>
      </header>

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            {
              value: "alerts",
              label: "Alertas",
              content:
                alerts.length === 0 ? (
                  <EmptyState
                    icon={<Lightbulb className="size-6" aria-hidden="true" />}
                    title="Nada crítico"
                    description="Nenhum alerta ativo no momento."
                    tone="positive"
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {alerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        priority={alert.priority as 1 | 2 | 3 | 4 | 5 | 6}
                        title={alert.title}
                        description={alert.description}
                      />
                    ))}
                  </div>
                ),
            },
            {
              value: "recurrences",
              label: "Assinaturas & recorrências",
              content: (
                <div className="flex flex-col gap-3">
                  <InsightList
                    items={visible.map((o) => ({
                      key: o.key,
                      title: o.name,
                      subtitle: `${LEVEL_LABELS[o.level] ?? o.level} · ${o.months.length} mês(es)`,
                      confidence: o.confidence,
                      amountCents: o.averageCents,
                      icon: <Repeat className="size-4" aria-hidden="true" />,
                    }))}
                    feedback={feedbackMap as Record<string, FeedbackDecision>}
                    onIgnore={(key) => handleFeedback(key, "ignore")}
                    onConfirm={(key) => handleFeedback(key, "confirm")}
                    onRestore={(key) => handleFeedback(key, null)}
                    emptyLabel="Nenhuma assinatura ou recorrência detectada nos últimos meses."
                  />
                  <p className="text-xs text-muted-foreground">
                    O aprendizado persiste: ocorrências ignoradas deixam de contar; confirmadas ficam marcadas.
                  </p>
                </div>
              ),
            },
            {
              value: "projection",
              label: "Projeção & corte",
              content: (
                <div className="flex flex-col gap-4">
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
                  <section aria-label="Pendências" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                    <h3 className="text-sm font-semibold text-foreground">Pendências do período</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
                      <div className="min-w-0">
                        <p className="text-muted-foreground">A receber</p>
                        <MoneyText cents={pendingSummary.receivablesCents} tone="positive" className="text-xs truncate" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground">A pagar</p>
                        <MoneyText cents={pendingSummary.payablesCents} tone="negative" className="text-xs truncate" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground">Saldo projetado</p>
                        <MoneyText cents={pendingSummary.balanceCents} tone={pendingSummary.balanceCents >= 0 ? "positive" : "negative"} className="text-xs truncate" />
                      </div>
                    </div>
                  </section>

                  {/* Desafios de economia */}
                  <section aria-label="Desafios de economia" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-attention shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-foreground">Desafios de economia</h3>
                    </div>
                    {challenges.length === 0 && !discretionary ? (
                      <p className="text-xs text-muted-foreground">Nenhum desafio sugerido agora.</p>
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
                        {discretionary ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-positive/40 bg-positive/5 p-3 text-xs min-w-0">
                            <span className="font-medium text-foreground min-w-0 flex-1">30% em não essenciais</span>
                            <span className="num shrink-0 font-semibold text-positive-strong">
                              <MoneyText cents={-discretionary.savingsCents} tone="positive" sign="explicit" />/mês
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </section>

                  {/* Sugestões de limite */}
                  <section aria-label="Sugestões de limite" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden">
                    <h3 className="text-sm font-semibold text-foreground">Sugestões de limite</h3>
                    {limitSuggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma sugestão de ajuste de limite agora.</p>
                    ) : (
                      <div className="flex flex-col gap-2 min-w-0">
                        {limitSuggestions.map((s) => (
                          <div key={`${s.categoryId}-${s.kind}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs min-w-0">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="font-medium text-foreground truncate">{s.name}</span>
                              <span className="text-muted-foreground text-[11px]">{s.reason}</span>
                            </div>
                            <span className="shrink-0 font-semibold text-foreground">
                              <MoneyText cents={s.currentLimitCents} tone="default" /> → <MoneyText cents={s.suggestedLimitCents} tone="default" />
                            </span>
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          Aplicar uma sugestão em Orçamentos: defina o novo limite da categoria.
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              ),
            },
            {
              value: "diagnostics",
              label: "Diagnósticos",
              content: (
                <div className="flex flex-col gap-3 min-w-0">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 min-w-0">
                    <DiagnosticCard label="Saúde da poupança" value={SAVINGS_HEALTH_LABELS[health]} />
                    <DiagnosticCard
                      label="Concentração de renda"
                      value={`${concentration.topSharePercent.toFixed(0)}%`}
                      tone={concentration.alert ? "negative" : "positive"}
                    />
                    <DiagnosticCard
                      label="Gastos fim de semana"
                      value={`${weekendRatio === Infinity ? "∞" : weekendRatio.toFixed(1)}×`}
                      tone={weekendRatio > WEEKEND_RATIO_LIMIT ? "negative" : "positive"}
                    />
                    <DiagnosticCard label="Taxa de poupança" value={`${savingsRate.toFixed(1)}%`} tone={savingsRate >= 20 ? "positive" : savingsRate >= 0 ? "neutral" : "negative"} />
                  </div>
                  {concentration.alert ? (
                    <Alert variant="warning">Uma única fonte representa mais de 60% da sua renda — diversifique.</Alert>
                  ) : null}
                  {weekendRatio > WEEKEND_RATIO_LIMIT ? (
                    <Alert variant="warning">Seus gastos de fim de semana estão {weekendRatio.toFixed(1)}× maiores que os de dias úteis.</Alert>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

function DiagnosticCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 overflow-hidden">
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={`num text-lg sm:text-xl font-semibold truncate ${
          tone === "positive" ? "text-positive-strong" : tone === "negative" ? "text-critical" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Categorias essenciais nunca viram desafio de corte. */
function isEssentialIcon(icon: string | null | undefined): boolean {
  return icon != null && new Set(["moradia", "saude", "educacao", "mercado", "supermercado", "farmacia", "transporte", "combustivel"]).has(icon);
}
