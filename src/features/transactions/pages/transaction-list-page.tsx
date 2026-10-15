import { useNavigate, useSearchParams } from "react-router";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Calendar, FileSpreadsheet, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { MoneyText } from "@/components/ui/money-text";
import { SkeletonList } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { HighlightRow, KpiCard, MonthPicker, ReadOnlyBanner, TransactionRow, UpgradeDialog } from "@/components/modules";
import { currentMonth, formatDateBR, isValidMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useCategories, useExpenses, useIncomes, usePermission, useRecurrences } from "@/state";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { buildUnifiedFeedItems, groupFeedByDay, type FeedFilter } from "@/domain/expenses";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import { BankStatementImportDialog } from "@/features/transactions/components/bank-statement-import-dialog";
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
  const [isImportOpen, setIsImportOpen] = useState(false);
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
  const incomesWeightedCents = (incomesQuery.data ?? []).reduce(
    (acc, i) => acc + Math.round(i.value * i.report_weight * 100),
    0,
  );
  const expensesWeightedCents = (expensesQuery.data ?? []).reduce(
    (acc, e) => acc + Math.round(e.value * e.report_weight * 100),
    0,
  );
  const balanceCents = incomesTotalCents - expensesTotalCents;
  const balanceWeightedCents = incomesWeightedCents - expensesWeightedCents;

  const [filter, setFilter] = useState<FeedFilter>("all");

  const feedItems = useMemo(
    () => buildUnifiedFeedItems(expensesQuery.data ?? [], incomesQuery.data ?? [], filter),
    [expensesQuery.data, incomesQuery.data, filter],
  );
  const feedGroups = useMemo(() => groupFeedByDay(feedItems), [feedItems]);

  // Frequência por template (Fase 32) — subtítulo "Mensal", "Semanal", etc.
  const frequencyById = new Map(
    (recurrencesQuery.data ?? []).map((recurrence) => [recurrence.id, recurrence.frequency]),
  );
  const recurrenceLabel = (recurrenceId: string | null | undefined): string | undefined => {
    const frequency = recurrenceId ? frequencyById.get(recurrenceId) : undefined;
    return frequency ? RECURRENCE_FREQUENCY_LABELS[frequency] : undefined;
  };

  const { setOpen: setWizardOpen } = useCreateDeepLink("transacao");
  const permission = usePermission("transactions");
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const handleNewTransaction = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Criar Lançamentos e Despesas");
      setUpgradeOpen(true);
      return;
    }
    setWizardOpen(true);
  };

  const handleImportStatement = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Importar Extrato Bancário");
      setUpgradeOpen(true);
      return;
    }
    setIsImportOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: seletor de mês direto; o botão de novo
          lançamento fica abaixo dos KPIs (só desktop — no mobile o FAB da BottomNav
          assume) e o título permanece apenas para leitores de tela. */}
      <h1 className="sr-only">Transações</h1>

      {permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            setUpgradeContext(undefined);
            setUpgradeOpen(true);
          }}
        />
      )}

      <MonthPicker value={month} onValueChange={handleMonthChange} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <KpiCard
          label="Receitas"
          cents={incomesTotalCents}
          tone="positive"
          hint={
            incomesTotalCents !== incomesWeightedCents ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
                <span className="hidden sm:inline">Ponderada:</span>
                <span className="sm:hidden">Pond:</span>
                <MoneyText cents={incomesWeightedCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : undefined
          }
        />
        <KpiCard
          label="Despesas"
          cents={expensesTotalCents}
          tone="negative"
          hint={
            expensesTotalCents !== expensesWeightedCents ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
                <span className="hidden sm:inline">Ponderada:</span>
                <span className="sm:hidden">Pond:</span>
                <MoneyText cents={expensesWeightedCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : undefined
          }
        />
        <KpiCard
          label="Saldo do mês"
          cents={balanceCents}
          tone={balanceCents >= 0 ? "positive" : "negative"}
          hint={
            balanceCents !== balanceWeightedCents ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
                <span className="hidden sm:inline">Ponderado:</span>
                <span className="sm:hidden">Pond:</span>
                <MoneyText cents={balanceWeightedCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : undefined
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <Button className="w-full sm:flex-1 gap-1.5" onClick={handleNewTransaction}>
          <Plus className="size-4" aria-hidden="true" />
          Nova transação
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto gap-1.5"
          onClick={handleImportStatement}
        >
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Importar extrato
        </Button>
      </div>

      <Tabs
        value={filter}
        onValueChange={(val) => setFilter(val as FeedFilter)}
        fullWidth={false}
        items={[
          { value: "all", label: "Tudo" },
          { value: "incomes", label: "Receitas" },
          { value: "expenses", label: "Despesas" },
          { value: "installments", label: "Parceladas" },
          { value: "recurring", label: "Recorrentes" },
        ]}
      />

      {error ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void Promise.all([expensesQuery.refetch(), incomesQuery.refetch(), categoriesQuery.refetch(), recurrencesQuery.refetch()])}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <SkeletonList rows={4} />
        </div>
      ) : feedGroups.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" aria-hidden="true" />}
          title="Nenhum lançamento encontrado"
          description={
            filter === "incomes"
              ? "Nenhuma receita registrada neste mês."
              : filter === "expenses"
                ? "Nenhuma despesa registrada neste mês."
                : filter === "recurring"
                  ? "Nenhum lançamento recorrente neste mês."
                  : filter === "installments"
                    ? "Nenhum lançamento parcelado neste mês."
                    : "Registre sua primeira transação do mês ou importe seu extrato bancário."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <Button size="sm" onClick={handleNewTransaction} className="gap-1.5 cursor-pointer">
                <Plus className="size-4" aria-hidden="true" />
                Nova transação
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportStatement}
                className="gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                Importar extrato
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {feedGroups.map((group) => (
            <section
              key={group.date}
              aria-label={`Lançamentos de ${formatDateBR(group.date)}`}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2 pt-1 px-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>{formatDateBR(group.date)}</span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground/80">
                    ({group.items.length} {group.items.length === 1 ? "lançamento" : "lançamentos"})
                  </span>
                </div>
                <Badge
                  variant={group.netCents > 0 ? "positive" : group.netCents < 0 ? "negative" : "muted"}
                  size="sm"
                  className="font-semibold"
                >
                  <MoneyText
                    cents={group.netCents}
                    tone={group.netCents > 0 ? "positive" : group.netCents < 0 ? "negative" : "default"}
                    sign="auto"
                    className="text-[11px]"
                  />
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <HighlightRow key={item.id} highlightId={highlightId} id={item.id}>
                    {item.kind === "income" && item.rawIncome ? (
                      <IncomeRow
                        income={item.rawIncome}
                        category={categoryById.get(item.categoryId)}
                        recurrenceLabel={recurrenceLabel(item.recurrenceId)}
                        onClick={() => setSelectedIncome(item.rawIncome!)}
                      />
                    ) : item.rawExpense ? (
                      <ExpenseRow
                        expense={item.rawExpense}
                        category={categoryById.get(item.categoryId)}
                        recurrenceLabel={recurrenceLabel(item.recurrenceId)}
                        onClick={() => setSelectedExpense(item.rawExpense!)}
                      />
                    ) : null}
                  </HighlightRow>
                ))}
              </div>
            </section>
          ))}
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

      <BankStatementImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        competenceMonth={month}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(p) => {
          setUpgradeOpen(false);
          navigate(`/assinatura?plano=${p}`);
        }}
      />
    </div>
  );
}
