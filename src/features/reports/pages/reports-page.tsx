import { useState } from "react";
import { ChartPie, Printer, TrendingDown, TrendingUp } from "lucide-react";
import { Button, EmptyState, ErrorState, Modal, PrintSheet, Skeleton, Tabs } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import {
  MonthlyClosePrintView,
  MonthPicker,
  ReportTable,
  YearPicker,
  type MonthlyCloseCategory,
  type MonthlyCloseInvoice,
  type ReportRow,
} from "@/components/modules";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  buildDetailedClose,
  mergePaidDebts,
  mondayFirstWeekday,
  percentChange,
  validateCustomPeriod,
  WEEKDAY_LABELS,
  type DetailedCloseCategory,
  type ReportEntry,
} from "@/domain/reports";
import { addDaysISO } from "@/domain/debts";
import { currentMonth, currentYear, monthLabel, monthRange, shiftMonth, yearRange } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { computeOverview } from "@/domain/overview";
import {
  useActiveCreditCards,
  useAllCardPayments,
  useCategories,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useIncomes,
  useIncomesByRange,
} from "@/state";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { calculateChargesBreakdown, CHARGE_KIND_LABELS } from "@/domain/charges";
import { ExpenseDetailDialog } from "@/features/transactions";
import { ReportDetailDialog } from "../components/report-detail-dialog";
import type { ChargeKind, Expense } from "@/types";

import { numberToCents } from "@/domain/money";

type PeriodMode = "month" | "year" | "custom";
type AggregationTab = "category" | "method" | "weekday" | "charges";

/** Relatórios (§3.6) — agregações por categoria/forma/dia da semana, comparativo, visão dupla (Bruto vs. Ponderado) e merge de dívidas pagas. */
export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [aggregationTab, setAggregationTab] = useState<AggregationTab>("category");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    expenses: Expense[];
  } | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);

  const range =
    mode === "month"
      ? monthRange(month)
      : mode === "year"
        ? yearRange(year)
        : { start: customStart, end: customEnd ? addDaysISO(customEnd, 1) : "" };
  const customValid =
    mode !== "custom" ||
    (customStart !== "" && customEnd !== "" && validateCustomPeriod(customStart, customEnd).ok);

  // Em modo mês só as queries mensais rodam; em modo ano ou custom só as de range.
  const isYear = mode === "year";
  const isCustom = mode === "custom";

  const monthlyExpenses = useExpenses(month);
  const monthlyIncomes = useIncomes(month);
  const prevExpenses = useExpenses(shiftMonth(month, -1));
  const prevIncomes = useIncomes(shiftMonth(month, -1));

  const yearExpenses = useExpensesByRange(range.start, range.end, { enabled: isYear });
  const yearIncomes = useIncomesByRange(range.start, range.end, { enabled: isYear });
  const prevYearRange = isYear ? yearRange(year - 1) : { start: "", end: "" };
  const prevYearExpenses = useExpensesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear });
  const prevYearIncomes = useIncomesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear });

  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const debtsQuery = useDebts();
  const categoriesQuery = useCategories();
  const allPaymentsQuery = useAllCardPayments();
  const activeCardsQuery = useActiveCreditCards();

  const expenses =
    mode === "month"
      ? (monthlyExpenses.data ?? [])
      : mode === "year"
        ? (yearExpenses.data ?? [])
        : customValid
          ? (rangeExpenses.data ?? [])
          : [];
  const incomes =
    mode === "month"
      ? (monthlyIncomes.data ?? [])
      : mode === "year"
        ? (yearIncomes.data ?? [])
        : customValid
          ? (rangeIncomes.data ?? [])
          : [];

  const loading =
    (mode === "month"
      ? monthlyExpenses.isLoading || monthlyIncomes.isLoading || prevExpenses.isLoading || prevIncomes.isLoading
      : mode === "year"
        ? yearExpenses.isLoading || yearIncomes.isLoading || prevYearExpenses.isLoading || prevYearIncomes.isLoading
        : rangeExpenses.isLoading || rangeIncomes.isLoading) ||
    debtsQuery.isLoading ||
    categoriesQuery.isLoading;
  const error =
    (mode === "month"
      ? monthlyExpenses.error ?? monthlyIncomes.error ?? prevExpenses.error ?? prevIncomes.error
      : mode === "year"
        ? yearExpenses.error ?? yearIncomes.error ?? prevYearExpenses.error ?? prevYearIncomes.error
        : rangeExpenses.error ?? rangeIncomes.error) ??
    debtsQuery.error ??
    categoriesQuery.error;

  const categories = categoriesQuery.data ?? [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

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
      baseCents: numberToCents(item.value),
      weight: item.report_weight,
    }));

  // Merge de dívidas pagas (§4.3): recebíveis → rendas; pagáveis → despesas.
  const paidDebts = (debtsQuery.data ?? [])
    .filter((d) => d.paid_at !== null && d.due_date >= range.start && d.due_date < range.end)
    .map((d) => ({
      kind: d.type === "receivable" ? ("receivable" as const) : ("payable" as const),
      valueCents: numberToCents(d.amount),
    }));

  const baseIncomePonderadoCents = incomes.reduce((acc, i) => acc + numberToCents(i.value * i.report_weight), 0);
  const baseIncomeBrutoCents = incomes.reduce((acc, i) => acc + numberToCents(i.value), 0);

  const baseExpensePonderadoCents = expenses.reduce((acc, e) => acc + numberToCents(e.value * e.report_weight), 0);
  const baseExpenseBrutoCents = expenses.reduce((acc, e) => acc + numberToCents(e.value), 0);

  const merged = mergePaidDebts(baseIncomePonderadoCents, baseExpensePonderadoCents, 0, paidDebts, {
    incomeBrutoCents: baseIncomeBrutoCents,
    expenseBrutoCents: baseExpenseBrutoCents,
  });

  const prevIncomesList =
    mode === "month"
      ? (prevIncomes.data ?? [])
      : mode === "year"
        ? (prevYearIncomes.data ?? [])
        : [];
  const prevExpensesList =
    mode === "month"
      ? (prevExpenses.data ?? [])
      : mode === "year"
        ? (prevYearExpenses.data ?? [])
        : [];

  const prevIncomeCents = prevIncomesList.reduce((acc, i) => acc + numberToCents(i.value * i.report_weight), 0);
  const prevExpenseCents = prevExpensesList.reduce((acc, e) => acc + numberToCents(e.value * e.report_weight), 0);
  const incomeDelta = mode === "month" || mode === "year" ? percentChange(merged.incomePonderadoCents, prevIncomeCents) : null;
  const expenseDelta = mode === "month" || mode === "year" ? percentChange(merged.expensePonderadoCents, prevExpenseCents) : null;

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

  const chargesBreakdown = calculateChargesBreakdown(expenses);
  const chargesRows: ReportRow[] = [
    {
      key: "interest",
      label: CHARGE_KIND_LABELS.interest,
      brutoCents: chargesBreakdown.interestGrossCents,
      ponderadoCents: chargesBreakdown.interestWeightedCents,
      valueCents: chargesBreakdown.interestWeightedCents,
      percent: totalSpentPonderado > 0 ? (chargesBreakdown.interestWeightedCents / totalSpentPonderado) * 100 : 0,
    },
    {
      key: "fine",
      label: CHARGE_KIND_LABELS.fine,
      brutoCents: chargesBreakdown.fineGrossCents,
      ponderadoCents: chargesBreakdown.fineWeightedCents,
      valueCents: chargesBreakdown.fineWeightedCents,
      percent: totalSpentPonderado > 0 ? (chargesBreakdown.fineWeightedCents / totalSpentPonderado) * 100 : 0,
    },
    {
      key: "tax",
      label: CHARGE_KIND_LABELS.tax,
      brutoCents: chargesBreakdown.taxGrossCents,
      ponderadoCents: chargesBreakdown.taxWeightedCents,
      valueCents: chargesBreakdown.taxWeightedCents,
      percent: totalSpentPonderado > 0 ? (chargesBreakdown.taxWeightedCents / totalSpentPonderado) * 100 : 0,
    },
    {
      key: "bank_fee",
      label: CHARGE_KIND_LABELS.bank_fee,
      brutoCents: chargesBreakdown.feeGrossCents,
      ponderadoCents: chargesBreakdown.feeWeightedCents,
      valueCents: chargesBreakdown.feeWeightedCents,
      percent: totalSpentPonderado > 0 ? (chargesBreakdown.feeWeightedCents / totalSpentPonderado) * 100 : 0,
    },
    {
      key: "regular",
      label: CHARGE_KIND_LABELS.regular,
      brutoCents: chargesBreakdown.regularGrossCents,
      ponderadoCents: chargesBreakdown.regularWeightedCents,
      valueCents: chargesBreakdown.regularWeightedCents,
      percent: totalSpentPonderado > 0 ? (chargesBreakdown.regularWeightedCents / totalSpentPonderado) * 100 : 0,
    },
  ].filter((r) => r.brutoCents > 0 || r.key === "regular");

  const periodLabel = mode === "month" ? monthLabel(month) : mode === "year" ? String(year) : `${customStart} a ${customEnd}`;

  // F22 — Fechamento imprimível do período (valores REAIS, sem peso de relatório).
  // Mês, ano e período custom: as listas `incomes`/`expenses` já são as do modo.
  const closeIncomeCents = incomes.reduce((acc, i) => acc + numberToCents(i.value), 0);
  const closeExpenseCents = expenses.reduce((acc, e) => acc + numberToCents(e.value), 0);
  const closeTotals = computeOverview(closeIncomeCents, closeExpenseCents, 0);
  const closeCategories: MonthlyCloseCategory[] = byCategory
    .map((c) => ({
      name: c.name,
      totalCents: c.brutoCents,
      pct: closeExpenseCents > 0 ? (c.brutoCents / closeExpenseCents) * 100 : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
  const activeCardName = new Map((activeCardsQuery.data ?? []).map((card) => [card.id, card.name]));
  // Pagamentos de fatura pelo mês da DATA do pagamento dentro do período ativo.
  const closeInvoices: MonthlyCloseInvoice[] = (allPaymentsQuery.data ?? [])
    .filter((payment) => payment.date >= range.start && payment.date < range.end)
    .map((payment) => ({
      cardName: activeCardName.get(payment.card_id) ?? "Cartão",
      competenceMonth: payment.competence_month,
      amountCents: numberToCents(payment.amount),
      date: payment.date,
    }));

  // F22 evolução — fechamento DETALHADO: categoria → dia → cada gasto com
  // descrição, método de pagamento, cartão e parcela (mês, ano ou custom).
  const closeDetailedCategories: DetailedCloseCategory[] = buildDetailedClose(
    expenses.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      paymentMethod: e.payment_method,
      cardId: e.card_id,
      installmentsTotal: e.installments_total,
      installmentNumber: e.installment_number,
      installmentGroupId: e.installment_group_id,
      categoryId: e.category_id,
      valueCents: numberToCents(e.value),
    })),
    {
      categoryName: (id) => categoryById.get(id)?.name ?? "Outra",
      cardName: (id) => activeCardName.get(id) ?? null,
      paymentMethodLabel: (method) =>
        PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method,
      weekdayLabel: (date) => WEEKDAY_LABELS[mondayFirstWeekday(date)] ?? "",
    },
  );

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
            value: "year",
            label: "Por ano",
            content: <YearPicker value={year} onValueChange={setYear} />,
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

      {/* F22 — Fechamento imprimível do período (mês, ano ou custom) */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setCloseOpen(true)} className="gap-2 w-full sm:w-auto justify-center">
          <Printer className="size-4" aria-hidden="true" />
          <span>Fechamento do período</span>
        </Button>
      </div>

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

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

          {chargesBreakdown.wastedGrossCents > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning-strong">
              <span className="font-medium">
                Custo de fricção (Juros e Multas):{" "}
                <strong>
                  {(chargesBreakdown.wastedGrossCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>{" "}
                gastos no período.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAggregationTab("charges")}
              >
                Ver detalhes
              </Button>
            </div>
          )}

          {paidDebts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {paidDebts.length} dívida(s) paga(s) somada(s) ao período pelo mês do vencimento.
            </p>
          ) : null}

          {/* Agregações com abas interativas corrigidas */}
          <Tabs
            value={aggregationTab}
            onValueChange={(val) => setAggregationTab(val as AggregationTab)}
            swipeable
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
                    onRowClick={(row) => {
                      const filtered = expenses.filter((e) => e.category_id === row.key);
                      const catName = categoryById.get(row.key)?.name ?? "Outra";
                      setDetailModal({
                        open: true,
                        title: `Despesas — ${catName}`,
                        expenses: filtered,
                      });
                    }}
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
                    onRowClick={(row) => {
                      const filtered = expenses.filter((e) => (e.payment_method ?? "other") === row.key);
                      const methodName = PAYMENT_METHOD_LABELS[row.key as keyof typeof PAYMENT_METHOD_LABELS] ?? row.key;
                      setDetailModal({
                        open: true,
                        title: `Despesas — ${methodName}`,
                        expenses: filtered,
                      });
                    }}
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
                    onRowClick={(row) => {
                      const weekdayIndex = Number(row.key);
                      const filtered = expenses.filter((e) => mondayFirstWeekday(e.date) === weekdayIndex);
                      const weekdayName = WEEKDAY_LABELS[weekdayIndex] ?? "Dia da semana";
                      setDetailModal({
                        open: true,
                        title: `Despesas — ${weekdayName}`,
                        expenses: filtered,
                      });
                    }}
                  />
                ),
              },
              {
                value: "charges",
                label: "Por natureza / encargos",
                content: (
                  <ReportTable
                    title="Natureza do gasto"
                    rows={chargesRows}
                    totalBrutoCents={totalSpentBruto}
                    totalPonderadoCents={totalSpentPonderado}
                    totalCents={totalSpentPonderado}
                    onRowClick={(row) => {
                      const filtered = expenses.filter((e) => (e.charge_kind ?? "regular") === row.key);
                      const kindLabel = CHARGE_KIND_LABELS[row.key as ChargeKind] ?? row.key;
                      setDetailModal({
                        open: true,
                        title: `Despesas — ${kindLabel}`,
                        expenses: filtered,
                      });
                    }}
                  />
                ),
              },
            ]}
          />
        </>
      )}

      <ReportDetailDialog
        open={detailModal !== null && detailModal.open}
        onOpenChange={(open) => {
          if (!open) setDetailModal(null);
        }}
        title={detailModal?.title ?? ""}
        subtitle={periodLabel}
        expenses={detailModal?.expenses ?? []}
        categories={categories}
        onSelectExpense={(exp) => setSelectedExpense(exp)}
      />

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpense(null);
        }}
      />

      {/* F22 — Fechamento do período imprimível (folha de estilo @media print) */}
      <Modal
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Fechamento do período"
        description={`Fechamento detalhado de ${periodLabel}: resumo executivo + cada gasto por categoria e dia, com método de pagamento — pronto para imprimir ou salvar em PDF.`}
        size="xl"
        hideCalculator
      >
        <div className="mt-4">
          <MonthlyClosePrintView
            periodLabel={periodLabel}
            totals={closeTotals}
            expenseCount={expenses.length}
            incomeCount={incomes.length}
            categories={closeCategories}
            paidInvoices={closeInvoices}
            detailedCategories={closeDetailedCategories}
          />
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setCloseOpen(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
          <Button type="button" onClick={() => window.print()} className="gap-2 w-full sm:w-auto justify-center">
            <Printer className="size-4" aria-hidden="true" />
            <span>Imprimir / Salvar PDF</span>
          </Button>
        </div>
      </Modal>

      {/* Portal de impressão (F22 evolução): o documento sai do modal e vai
          para o body como `.print-sheet` — na impressão só ele aparece, em
          fluxo normal, paginando por TODAS as páginas (sem cortar lançamentos). */}
      <PrintSheet open={closeOpen}>
        <MonthlyClosePrintView
          periodLabel={periodLabel}
          totals={closeTotals}
          expenseCount={expenses.length}
          incomeCount={incomes.length}
          categories={closeCategories}
          paidInvoices={closeInvoices}
          detailedCategories={closeDetailedCategories}
        />
      </PrintSheet>
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


