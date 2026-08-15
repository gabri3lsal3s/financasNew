import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { VirtualList } from "@/components/ui/virtual-list";
import { HighlightRow, KpiCard, MonthPicker, TransactionRow } from "@/components/modules";
import { currentMonth, isValidMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useCategories, useExpenses, useIncomes } from "@/state";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { Category, Expense, Income } from "@/types";

function sumCents(items: readonly { value: number }[]): number {
  return items.reduce((acc, item) => acc + Math.round(item.value * 100), 0);
}

function ExpenseRow({
  expense,
  category,
  onClick,
}: {
  expense: Expense;
  category?: Category | null;
  onClick?: () => void;
}) {
  const title = expense.description || category?.name || "Despesa";
  const subtitle = expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : undefined;
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
      // Swipe-to-action (F8 — Decisão 2): excluir abre o diálogo de detalhe
      // existente (exclusão com cascata e modos).
      swipeActions={
        <Button
          type="button"
          variant="destructive"
          aria-label={`Excluir ${title}`}
          onClick={onClick}
          className="h-full w-24 rounded-none"
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      }
    />
  );
}

// Altura fixa das linhas (py-2.5 + ícone 36px ≈ 56px; folga p/ badges).
const ROW_HEIGHT = 64;
// Acima deste total renderiza tudo direto (sem janela) — meses comuns.
const PLAIN_THRESHOLD = 60;

function IncomeRow({ income, category }: { income: Income; category?: Category | null }) {
  return (
    <TransactionRow
      title={income.description || category?.name || "Receita"}
      date={income.date}
      amountCents={Math.round(income.value * 100)}
      reportWeight={income.report_weight}
      kind="income"
      icon={category?.icon}
      iconColor={category?.color}
    />
  );
}

export function TransactionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
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

  const loading = expensesQuery.isLoading || incomesQuery.isLoading || categoriesQuery.isLoading;
  const error = expensesQuery.error ?? incomesQuery.error ?? categoriesQuery.error;

  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));

  const incomesTotalCents = sumCents(incomesQuery.data ?? []);
  const expensesTotalCents = sumCents(expensesQuery.data ?? []);
  const balanceCents = incomesTotalCents - expensesTotalCents;

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: seletor de mês direto; o botão de novo
          lançamento fica ao lado (só desktop — no mobile o FAB da BottomNav
          assume) e o título permanece apenas para leitores de tela. */}
      <h1 className="sr-only">Transações</h1>

      <div className="flex items-center justify-between gap-3">
        <MonthPicker value={month} onValueChange={handleMonthChange} className="flex-1" />
        <Link to="/transacoes/novo" className="hidden sm:inline-flex">
          <Button>
            <Plus aria-hidden="true" />
            Nova transação
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <KpiCard label="Receitas" cents={incomesTotalCents} tone="positive" />
        <KpiCard label="Despesas" cents={expensesTotalCents} tone="negative" />
        <KpiCard
          label="Saldo do mês"
          cents={balanceCents}
          tone={balanceCents >= 0 ? "positive" : "negative"}
        />
      </div>

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
              <VirtualList
                key={month}
                rows={incomesQuery.data ?? []}
                rowKey={(income) => income.id}
                itemHeight={ROW_HEIGHT}
                plainThreshold={PLAIN_THRESHOLD}
                maxHeight={560}
                gap={8}
                aria-label="Receitas do mês"
                renderRow={(income) => (
                  <HighlightRow highlightId={highlightId} id={income.id}>
                    <IncomeRow income={income} category={categoryById.get(income.category_id)} />
                  </HighlightRow>
                )}
              />
            )}
          </section>

          <section aria-label="Despesas do mês" className="flex flex-col gap-2">
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
              <VirtualList
                key={month}
                rows={expensesQuery.data ?? []}
                rowKey={(expense) => expense.id}
                itemHeight={ROW_HEIGHT}
                plainThreshold={PLAIN_THRESHOLD}
                maxHeight={560}
                gap={8}
                aria-label="Despesas do mês"
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
          </section>
        </div>
      )}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpense(null);
        }}
      />
    </div>
  );
}
