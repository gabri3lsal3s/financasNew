import { Link } from "react-router";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/modules/kpi-card";
import { MonthPicker } from "@/components/modules/month-picker";
import { TransactionRow } from "@/components/modules/transaction-row";
import { currentMonth } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";
import { useExpenses, useIncomes } from "@/state";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { Expense, Income } from "@/types";

function sumCents(items: readonly { value: number }[]): number {
  return items.reduce((acc, item) => acc + Math.round(item.value * 100), 0);
}

function ExpenseRow({ expense, onClick }: { expense: Expense; onClick?: () => void }) {
  const title = expense.description || "Despesa sem descrição";
  const subtitle = expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : undefined;
  return (
    <TransactionRow
      title={title}
      date={expense.date}
      subtitle={subtitle}
      amountCents={Math.round(expense.value * 100)}
      kind="expense"
      onClick={onClick}
    />
  );
}

function IncomeRow({ income }: { income: Income }) {
  return (
    <TransactionRow
      title={income.description || "Renda sem descrição"}
      date={income.date}
      amountCents={Math.round(income.value * 100)}
      kind="income"
    />
  );
}

export function TransactionListPage() {
  const [month, setMonth] = useState(currentMonth());
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);

  const loading = expensesQuery.isLoading || incomesQuery.isLoading;
  const error = expensesQuery.error ?? incomesQuery.error;

  const incomesTotalCents = sumCents(incomesQuery.data ?? []);
  const expensesTotalCents = sumCents(expensesQuery.data ?? []);
  const balanceCents = incomesTotalCents - expensesTotalCents;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h1 className="font-display text-2xl font-bold">Transações</h1>
      <Link to="/transacoes/novo">
        <Button>
          <Plus aria-hidden="true" />
          Nova transação
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {header}

      <MonthPicker value={month} onValueChange={setMonth} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Receitas" value={formatCentsAsBRL(incomesTotalCents)} tone="positive" />
        <KpiCard label="Despesas" value={formatCentsAsBRL(expensesTotalCents)} tone="negative" />
        <KpiCard
          label="Saldo do mês"
          value={formatCentsAsBRL(balanceCents)}
          tone={balanceCents >= 0 ? "positive" : "negative"}
        />
      </div>

      {error ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error">{getErrorMessage(error)}</Alert>
          <div>
            <Button
              variant="outline"
              onClick={() => void Promise.all([expensesQuery.refetch(), incomesQuery.refetch()])}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
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
              />
            ) : (
              (incomesQuery.data ?? []).map((income) => <IncomeRow key={income.id} income={income} />)
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
              />
            ) : (
              (expensesQuery.data ?? []).map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} onClick={() => setSelectedExpense(expense)} />
              ))
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
