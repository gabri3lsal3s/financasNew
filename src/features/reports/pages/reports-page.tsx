import { useState } from "react";
import { ChartPie, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import { MonthPicker, ReportTable, type ReportRow } from "@/components/modules";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  mergePaidDebts,
  percentChange,
  validateCustomPeriod,
  type ReportEntry,
} from "@/domain/reports";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useCategories, useDebts, useExpenses, useExpensesByRange, useIncomes, useIncomesByRange } from "@/state";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";

const toCents = (value: number) => Math.round(value * 100);

type PeriodMode = "month" | "custom";
type AggregationTab = "category" | "method" | "weekday";

/** Relatórios (§3.6) — agregações por categoria/forma/dia da semana, comparativo, visão dupla (Bruto vs. Ponderado) e merge de dívidas pagas. */
export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [aggregationTab, setAggregationTab] = useState<AggregationTab>("category");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = mode === "month" ? monthRange(month) : { start: customStart, end: addDay(customEnd) };
  const customValid =
    mode !== "custom" ||
    (customStart !== "" && customEnd !== "" && validateCustomPeriod(customStart, customEnd).ok);

  // F5.5 (revisão de queries): em modo mês só as queries mensais rodam;
  // em modo custom só as de range — evita fetch duplicado do mesmo período.
  const isCustom = mode === "custom";
  const monthlyExpenses = useExpenses(month);
  const monthlyIncomes = useIncomes(month);
  const prevExpenses = useExpenses(shiftMonth(month, -1));
  const prevIncomes = useIncomes(shiftMonth(month, -1));
  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const debtsQuery = useDebts();
  const categoriesQuery = useCategories();

  const expenses = mode === "month" ? (monthlyExpenses.data ?? []) : customValid ? (rangeExpenses.data ?? []) : [];
  const incomes = mode === "month" ? (monthlyIncomes.data ?? []) : customValid ? (rangeIncomes.data ?? []) : [];

  const loading = mode === "month"
    ? monthlyExpenses.isLoading || monthlyIncomes.isLoading || prevExpenses.isLoading || prevIncomes.isLoading
    : rangeExpenses.isLoading || rangeIncomes.isLoading;
  const error =
    (mode === "month"
      ? monthlyExpenses.error ?? monthlyIncomes.error ?? prevExpenses.error ?? prevIncomes.error
      : rangeExpenses.error ?? rangeIncomes.error) ??
    debtsQuery.error ??
    categoriesQuery.error;

  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));

  const toEntries = (
    list: readonly {
      id: string;
      date: string;
      category_id: string;
      value: number;
      report_weight: number;
      payment_method?: string | null;
    }[],
  ): ReportEntry[] =>
    list.map((item) => ({
      id: item.id,
      date: item.date,
      kind: "expense",
      categoryId: item.category_id,
      categoryName: categoryById.get(item.category_id)?.name ?? "Outra",
      categoryIcon: categoryById.get(item.category_id)?.icon ?? null,
      paymentMethod: item.payment_method ?? null,
      baseCents: toCents(item.value),
      weight: item.report_weight,
    }));

  // Merge de dívidas pagas (§4.3): recebíveis → rendas; pagáveis → despesas.
  const paidDebts = (debtsQuery.data ?? [])
    .filter((d) => d.paid_at !== null && d.due_date >= range.start && d.due_date < range.end)
    .map((d) => ({
      kind: d.type === "receivable" ? ("receivable" as const) : ("payable" as const),
      valueCents: toCents(d.amount),
    }));

  const baseIncomePonderadoCents = incomes.reduce((acc, i) => acc + toCents(i.value * i.report_weight), 0);
  const baseIncomeBrutoCents = incomes.reduce((acc, i) => acc + toCents(i.value), 0);

  const baseExpensePonderadoCents = expenses.reduce((acc, e) => acc + toCents(e.value * e.report_weight), 0);
  const baseExpenseBrutoCents = expenses.reduce((acc, e) => acc + toCents(e.value), 0);

  const merged = mergePaidDebts(baseIncomePonderadoCents, baseExpensePonderadoCents, 0, paidDebts, {
    incomeBrutoCents: baseIncomeBrutoCents,
    expenseBrutoCents: baseExpenseBrutoCents,
  });

  const prevIncomeCents = (prevIncomes.data ?? []).reduce((acc, i) => acc + toCents(i.value * i.report_weight), 0);
  const prevExpenseCents = (prevExpenses.data ?? []).reduce((acc, e) => acc + toCents(e.value * e.report_weight), 0);
  const incomeDelta = mode === "month" ? percentChange(merged.incomePonderadoCents, prevIncomeCents) : null;
  const expenseDelta = mode === "month" ? percentChange(merged.expensePonderadoCents, prevExpenseCents) : null;

  const entries = toEntries(expenses);
  const byCategory = aggregateByCategory(entries);
  const byMethod = aggregateByPaymentMethod(entries);
  const byWeekday = aggregateByWeekday(entries);

  const paidDebtsPayablesCents = paidDebts.filter((d) => d.kind === "payable").reduce((a, d) => a + d.valueCents, 0);
  const totalSpentPonderado = baseExpensePonderadoCents + paidDebtsPayablesCents;
  const totalSpentBruto = baseExpenseBrutoCents + paidDebtsPayablesCents;

  const categoryRows: ReportRow[] = byCategory.map((c) => ({
    key: c.categoryId,
    label: c.name,
    brutoCents: c.brutoCents,
    ponderadoCents: c.ponderadoCents,
    valueCents: c.ponderadoCents,
    percent: totalSpentPonderado > 0 ? (c.ponderadoCents / totalSpentPonderado) * 100 : 0,
  }));
  const methodRows: ReportRow[] = byMethod.map((m) => ({
    key: m.method,
    label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
    brutoCents: m.brutoCents,
    ponderadoCents: m.ponderadoCents,
    valueCents: m.ponderadoCents,
    percent: totalSpentPonderado > 0 ? (m.ponderadoCents / totalSpentPonderado) * 100 : 0,
  }));
  const weekdayRows: ReportRow[] = byWeekday.map((w) => ({
    key: String(w.weekday),
    label: w.label,
    brutoCents: w.brutoCents,
    ponderadoCents: w.ponderadoCents,
    valueCents: w.ponderadoCents,
    percent: totalSpentPonderado > 0 ? (w.ponderadoCents / totalSpentPonderado) * 100 : 0,
  }));

  const periodLabel = mode === "month" ? monthLabel(month) : `${customStart} a ${customEnd}`;

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: abas + seletor de período direto; título apenas p/ leitores de tela. */}
      <h1 className="sr-only">Relatórios</h1>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as PeriodMode)}
        items={[
          {
            value: "month",
            label: "Por mês",
            content: <MonthPicker value={month} onValueChange={setMonth} />,
          },
          {
            value: "custom",
            label: "Período custom",
            content: (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground w-full sm:w-auto">
                  De
                  <DatePicker value={customStart} onValueChange={setCustomStart} ariaLabel="Início do período" className="w-full sm:min-w-40" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground w-full sm:w-auto">
                  Até
                  <DatePicker value={customEnd} onValueChange={setCustomEnd} ariaLabel="Fim do período" className="w-full sm:min-w-40" />
                </label>
                {mode === "custom" && !customValid ? (
                  <span className="text-xs text-critical">Período inválido (máx. 366 dias).</span>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {error ? <Alert variant="error">{getErrorMessage(error)}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : expenses.length === 0 && incomes.length === 0 ? (
        <EmptyState
          icon={<ChartPie className="size-6" aria-hidden="true" />}
          title="Sem lançamentos no período"
          description={`Nenhuma receita ou despesa registrada em ${periodLabel}.`}
        />
      ) : (
        <>
          {/* Resumo com merge de dívidas (§4.3), comparativo e visão dupla (Ponderado vs. Nominal) */}
          <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4 min-w-0">
            <SummaryCard
              label="Rendas"
              cents={merged.incomePonderadoCents}
              brutoCents={merged.incomeBrutoCents}
              tone="positive"
              delta={incomeDelta}
              positiveIsGood
            />
            <SummaryCard
              label="Despesas"
              cents={merged.expensePonderadoCents}
              brutoCents={merged.expenseBrutoCents}
              tone="negative"
              delta={expenseDelta}
              positiveIsGood={false}
            />
            <SummaryCard
              label="Saldo"
              cents={merged.balancePonderadoCents}
              brutoCents={merged.balanceBrutoCents}
              tone={merged.balancePonderadoCents >= 0 ? "positive" : "negative"}
            />
            <SummaryCard label="Dívidas pagas" cents={paidDebts.reduce((a, d) => a + d.valueCents, 0)} />
          </section>

          {paidDebts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {paidDebts.length} dívida(s) paga(s) somada(s) ao período pelo mês do vencimento.
            </p>
          ) : null}

          {/* Agregações com abas interativas corrigidas */}
          <Tabs
            value={aggregationTab}
            onValueChange={(val) => setAggregationTab(val as AggregationTab)}
            items={[
              {
                value: "category",
                label: "Por categoria",
                content: (
                  <ReportTable
                    title="Categoria"
                    rows={categoryRows}
                    totalBrutoCents={totalSpentBruto}
                    totalPonderadoCents={totalSpentPonderado}
                    totalCents={totalSpentPonderado}
                  />
                ),
              },
              {
                value: "method",
                label: "Por forma",
                content: (
                  <ReportTable
                    title="Forma de pagamento"
                    rows={methodRows}
                    totalBrutoCents={totalSpentBruto}
                    totalPonderadoCents={totalSpentPonderado}
                    totalCents={totalSpentPonderado}
                  />
                ),
              },
              {
                value: "weekday",
                label: "Por dia da semana",
                content: (
                  <ReportTable
                    title="Dia da semana"
                    rows={weekdayRows}
                    totalBrutoCents={totalSpentBruto}
                    totalPonderadoCents={totalSpentPonderado}
                    totalCents={totalSpentPonderado}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  cents,
  brutoCents,
  delta,
  positiveIsGood = true,
  tone,
}: {
  label: string;
  /** Valor ponderado em centavos — renderiza MoneyText hero (padrão F12). */
  cents: number;
  /** Valor nominal bruto em centavos (opcional). */
  brutoCents?: number;
  delta?: number | null;
  positiveIsGood?: boolean;
  tone?: "positive" | "negative";
}) {
  const good =
    tone !== undefined
      ? tone === "positive"
      : delta !== null && delta !== undefined
        ? (delta >= 0) === positiveIsGood
        : null;
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0">
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <MoneyText
        cents={cents}
        variant="hero"
        tone={tone ?? "default"}
        className="truncate"
      />
      <div className="flex flex-col gap-0.5 mt-1 min-h-[18px]">
        {brutoCents !== undefined && brutoCents !== cents ? (
          <span className="truncate text-[11px] text-muted-foreground">
            Nominal: <MoneyText cents={brutoCents} tone="default" className="text-[11px] text-muted-foreground" />
          </span>
        ) : null}
        {delta !== null && delta !== undefined ? (
          <span className={cn("num inline-flex items-center gap-0.5 truncate text-[11px]", good ? "text-positive-strong" : "text-critical")}>
            {delta >= 0 ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
            {Math.abs(delta).toFixed(1)}% vs anterior
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Soma 1 dia a uma data ISO (YYYY-MM-DD) — converte fim inclusivo em exclusivo. */
function addDay(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  return date.toISOString().slice(0, 10);
}
