import { useSearchParams } from "react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Repeat, Zap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { VirtualList } from "@/components/ui/virtual-list";
import { HighlightRow, KpiCard, MonthPicker, TransactionRow } from "@/components/modules";
import { currentMonth, isValidMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useCategories, useExpenses, useIncomes, useRecurrences } from "@/state";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { partitionInvoiceExpenses } from "@/domain/cards";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import type { Category, Expense, Income } from "@/types";

function sumCents(items: readonly { value: number }[]): number {
  return items.reduce((acc, item) => acc + Math.round(item.value * 100), 0);
}

function ExpenseRow({
  expense,
  category,
  recurrenceLabel,
  onClick,
}: {
  expense: Expense;
  category?: Category | null;
  /** Rótulo de frequência quando recorrente (Fase 32). */
  recurrenceLabel?: string;
  onClick?: () => void;
}) {
  const title = expense.description || category?.name || "Despesa";
  const subtitle =
    recurrenceLabel ?? (expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : undefined);
  return (
    <TransactionRow
      title={title}
      date={expense.date}
      subtitle={subtitle}
      amountCents={Math.round(expense.value * 100)}
      reportWeight={expense.report_weight}
      kind="expense"
      icon={category?.icon}
      iconColor={category?.color}
      onClick={onClick}
    />
  );
}

// Altura fixa das linhas (py-2.5 + ícone 36px ≈ 56px; folga p/ badges).
const ROW_HEIGHT = 64;
// Acima deste total renderiza tudo direto (sem janela) — meses comuns.
const PLAIN_THRESHOLD = 60;

function IncomeRow({
  income,
  category,
  recurrenceLabel,
  onClick,
}: {
  income: Income;
  category?: Category | null;
  /** Rótulo de frequência quando recorrente (Fase 32). */
  recurrenceLabel?: string;
  onClick?: () => void;
}) {
  const title = income.description || category?.name || "Receita";
  return (
    <TransactionRow
      title={title}
      date={income.date}
      subtitle={recurrenceLabel}
      amountCents={Math.round(income.value * 100)}
      reportWeight={income.report_weight}
      kind="income"
      icon={category?.icon}
      iconColor={category?.color}
      onClick={onClick}
    />
  );
}

export function TransactionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const { highlightId } = useHighlightTarget("q");

  // Mês derivado: deep-link ?month= (busca §3.9) prevalece; sem param,
  // usa a escolha manual (MonthPicker) ou o mês corrente. Sem setState em
  // effect/render — o param é a fonte e o pick manual limpa o param.
  const paramMonth = searchParams.get("month");
  const validParamMonth = paramMonth && isValidMonth(paramMonth) ? paramMonth : null;
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = validParamMonth ?? pickedMonth ?? currentMonth();

  const handleMonthChange = (next: string) => {
    setPickedMonth(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("month");
        return updated;
      },
      { replace: true },
    );
  };

  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);
  const categoriesQuery = useCategories();
  const recurrencesQuery = useRecurrences();

  const loading =
    expensesQuery.isLoading || incomesQuery.isLoading || categoriesQuery.isLoading || recurrencesQuery.isLoading;
  const error = expensesQuery.error ?? incomesQuery.error ?? categoriesQuery.error ?? recurrencesQuery.error;

  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));

  const incomesTotalCents = sumCents(incomesQuery.data ?? []);
  const expensesTotalCents = sumCents(expensesQuery.data ?? []);
  const balanceCents = incomesTotalCents - expensesTotalCents;

  // Partição de despesas: recorrentes (recurrence_id) × parceladas × à vista
  // — mesmo motor puro usado na página de cartões (domain/cards).
  const expenseRecurring = (expensesQuery.data ?? []).filter((expense) => expense.recurrence_id != null);
  const { installments: expenseInstallments, regular: expenseRegular } = partitionInvoiceExpenses(
    (expensesQuery.data ?? []).filter((expense) => expense.recurrence_id == null),
  );
  const incomeRecurring = (incomesQuery.data ?? []).filter((income) => income.recurrence_id != null);
  const incomeRegular = (incomesQuery.data ?? []).filter((income) => income.recurrence_id == null);

  // Frequência por template (Fase 32) — subtítulo "Mensal", "Semanal", etc.
  const frequencyById = new Map(
    (recurrencesQuery.data ?? []).map((recurrence) => [recurrence.id, recurrence.frequency]),
  );
  const recurrenceLabel = (recurrenceId: string | null | undefined): string | undefined => {
    const frequency = recurrenceId ? frequencyById.get(recurrenceId) : undefined;
    return frequency ? RECURRENCE_FREQUENCY_LABELS[frequency] : undefined;
  };

  const { setOpen: setWizardOpen } = useCreateDeepLink("transacao");

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: seletor de mês direto; o botão de novo
          lançamento fica abaixo dos KPIs (só desktop — no mobile o FAB da BottomNav
          assume) e o título permanece apenas para leitores de tela. */}
      <h1 className="sr-only">Transações</h1>

      <MonthPicker value={month} onValueChange={handleMonthChange} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <KpiCard label="Receitas" cents={incomesTotalCents} tone="positive" />
        <KpiCard label="Despesas" cents={expensesTotalCents} tone="negative" />
        <KpiCard
          label="Saldo do mês"
          cents={balanceCents}
          tone={balanceCents >= 0 ? "positive" : "negative"}
        />
      </div>

      <Button className="w-full" onClick={() => setWizardOpen(true)}>
        <Plus aria-hidden="true" />
        Nova transação
      </Button>

      {error ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error">{getErrorMessage(error)}</Alert>
          <div>
            <Button
              variant="outline"
              onClick={() => void Promise.all([expensesQuery.refetch(), incomesQuery.refetch(), categoriesQuery.refetch()])}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <SkeletonList rows={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Receitas do mês" className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowDownLeft className="size-4 text-positive-strong" aria-hidden="true" />
              Receitas
            </h2>
            {(incomesQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={<ArrowDownLeft className="size-6" aria-hidden="true" />}
                title="Nenhuma receita"
                description="Registre sua primeira renda do mês."
                tone="positive"
              />
            ) : (
              <div className="flex flex-col gap-4">
                {incomeRecurring.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Repeat className="size-3.5" aria-hidden="true" />
                        Recorrentes
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono">
                        {incomeRecurring.length} {incomeRecurring.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <VirtualList
                      key={`${month}-income-recurring`}
                      rows={incomeRecurring}
                      rowKey={(income) => income.id}
                      itemHeight={ROW_HEIGHT}
                      plainThreshold={PLAIN_THRESHOLD}
                      maxHeight={560}
                      gap={8}
                      aria-label="Rendas recorrentes do mês"
                      renderRow={(income) => (
                        <HighlightRow highlightId={highlightId} id={income.id}>
                          <IncomeRow
                            income={income}
                            category={categoryById.get(income.category_id)}
                            recurrenceLabel={recurrenceLabel(income.recurrence_id)}
                            onClick={() => setSelectedIncome(income)}
                          />
                        </HighlightRow>
                      )}
                    />
                  </div>
                ) : null}
                {incomeRegular.length > 0 ? (
                  <VirtualList
                    key={`${month}-income-regular`}
                    rows={incomeRegular}
                    rowKey={(income) => income.id}
                    itemHeight={ROW_HEIGHT}
                    plainThreshold={PLAIN_THRESHOLD}
                    maxHeight={560}
                    gap={8}
                    aria-label="Receitas avulsas do mês"
                    renderRow={(income) => (
                      <HighlightRow highlightId={highlightId} id={income.id}>
                        <IncomeRow
                          income={income}
                          category={categoryById.get(income.category_id)}
                          onClick={() => setSelectedIncome(income)}
                        />
                      </HighlightRow>
                    )}
                  />
                ) : null}
              </div>
            )}
          </section>

          <section aria-label="Despesas do mês" className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowUpRight className="size-4 text-negative-strong" aria-hidden="true" />
              Despesas
            </h2>
            {(expensesQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={<ArrowUpRight className="size-6" aria-hidden="true" />}
                title="Nenhuma despesa"
                description="Registre seu primeiro gasto do mês."
                tone="negative"
              />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Recorrentes — recorrência formal (Fase 32, topo) */}
                {expenseRecurring.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Repeat className="size-3.5" aria-hidden="true" />
                        Recorrentes
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono">
                        {expenseRecurring.length} {expenseRecurring.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <VirtualList
                      key={`${month}-expense-recurring`}
                      rows={expenseRecurring}
                      rowKey={(expense) => expense.id}
                      itemHeight={ROW_HEIGHT}
                      plainThreshold={PLAIN_THRESHOLD}
                      maxHeight={560}
                      gap={8}
                      aria-label="Despesas recorrentes do mês"
                      renderRow={(expense) => (
                        <HighlightRow highlightId={highlightId} id={expense.id}>
                          <ExpenseRow
                            expense={expense}
                            category={categoryById.get(expense.category_id)}
                            recurrenceLabel={recurrenceLabel(expense.recurrence_id)}
                            onClick={() => setSelectedExpense(expense)}
                          />
                        </HighlightRow>
                      )}
                    />
                  </div>
                ) : null}

                {/* Parceladas — compras com mais de 1 parcela */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Repeat className="size-3.5" aria-hidden="true" />
                      Parceladas
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {expenseInstallments.length} {expenseInstallments.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {expenseInstallments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma despesa parcelada no mês.</p>
                  ) : (
                    <VirtualList
                      key={`${month}-installments`}
                      rows={expenseInstallments}
                      rowKey={(expense) => expense.id}
                      itemHeight={ROW_HEIGHT}
                      plainThreshold={PLAIN_THRESHOLD}
                      maxHeight={560}
                      gap={8}
                      aria-label="Despesas parceladas do mês"
                      renderRow={(expense) => (
                        <HighlightRow highlightId={highlightId} id={expense.id}>
                          <ExpenseRow
                            expense={expense}
                            category={categoryById.get(expense.category_id)}
                            onClick={() => setSelectedExpense(expense)}
                          />
                        </HighlightRow>
                      )}
                    />
                  )}
                </div>

                {/* À vista — gastos sem parcelamento (abaixo) */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Zap className="size-3.5" aria-hidden="true" />
                      À vista
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {expenseRegular.length} {expenseRegular.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {expenseRegular.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma despesa à vista no mês.</p>
                  ) : (
                    <VirtualList
                      key={`${month}-regular`}
                      rows={expenseRegular}
                      rowKey={(expense) => expense.id}
                      itemHeight={ROW_HEIGHT}
                      plainThreshold={PLAIN_THRESHOLD}
                      maxHeight={560}
                      gap={8}
                      aria-label="Despesas à vista do mês"
                      renderRow={(expense) => (
                        <HighlightRow highlightId={highlightId} id={expense.id}>
                          <ExpenseRow
                            expense={expense}
                            category={categoryById.get(expense.category_id)}
                            onClick={() => setSelectedExpense(expense)}
                          />
                        </HighlightRow>
                      )}
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedExpense(null);
          }
        }}
      />

      <IncomeDetailDialog
        income={selectedIncome}
        open={selectedIncome !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIncome(null);
          }
        }}
      />
    </div>
  );
}
