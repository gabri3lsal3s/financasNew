import { useNavigate, useSearchParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeftRight, Calendar, ChevronDown, Download, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { MoneyText } from "@/components/ui/money-text";
import { SkeletonList } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { HighlightRow, KpiCard, MonthPicker, ReadOnlyBanner, TransactionRow, UpgradeDialog } from "@/components/modules";
import { currentMonth, formatDateBR, isValidMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { downloadCsv } from "@/services/export-actions";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { setStepIndex, startDemo, useCategories, useCreditCards, useExpenses, useIncomes, usePermission, useRecurrences } from "@/state";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS, RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { sumGrossCents, sumWeightedCents } from "@/domain/money";
import { buildUnifiedFeedItems, groupFeedByDay, type FeedFilter } from "@/domain/expenses";
import { serializeUnifiedTransactionsCsv, type ExportUnifiedTransactionRow } from "@/domain/export";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import type { Category, Expense, Income } from "@/types";


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
    recurrenceLabel ??
    (expense.installments_total > 1
      ? `${expense.installment_number}/${expense.installments_total}`
      : category?.name && expense.description
        ? category.name
        : undefined);
  return (
    <TransactionRow
      title={title}
      subtitle={subtitle}
      amountCents={Math.round(expense.value * 100)}
      reportWeight={expense.report_weight}
      kind="expense"
      icon={category?.icon}
      iconColor={category?.color}
      onClick={onClick}
      variant="flat"
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
  const subtitle =
    recurrenceLabel ?? (category?.name && income.description ? category.name : undefined);
  return (
    <TransactionRow
      title={title}
      subtitle={subtitle}
      amountCents={Math.round(income.value * 100)}
      reportWeight={income.report_weight}
      kind="income"
      icon={category?.icon}
      iconColor={category?.color}
      onClick={onClick}
      variant="flat"
    />
  );
}

const TRANSACTIONS_PAGE_SIZE = 50;

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

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );

  const incomesTotalCents = useMemo(() => sumGrossCents(incomesQuery.data ?? []), [incomesQuery.data]);
  const expensesTotalCents = useMemo(() => sumGrossCents(expensesQuery.data ?? []), [expensesQuery.data]);
  const incomesWeightedCents = useMemo(() => sumWeightedCents(incomesQuery.data ?? []), [incomesQuery.data]);
  const expensesWeightedCents = useMemo(() => sumWeightedCents(expensesQuery.data ?? []), [expensesQuery.data]);
  const balanceCents = incomesTotalCents - expensesTotalCents;
  const balanceWeightedCents = incomesWeightedCents - expensesWeightedCents;


  const [filter, setFilter] = useState<FeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PAGE_SIZE);
  const [prevFilterKey, setPrevFilterKey] = useState(() => `${month}-${filter}-${searchQuery}`);

  // Redefine a paginação durante a renderização se os filtros mudarem (React: adjusting state during render)
  const currentFilterKey = `${month}-${filter}-${searchQuery}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setVisibleCount(TRANSACTIONS_PAGE_SIZE);
  }

  const feedItems = useMemo(
    () => buildUnifiedFeedItems(expensesQuery.data ?? [], incomesQuery.data ?? [], filter),
    [expensesQuery.data, incomesQuery.data, filter],
  );

  const filteredFeedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return feedItems;
    return feedItems.filter((item) => {
      const desc = (item.description ?? "").toLowerCase();
      const catName = (categoryById.get(item.categoryId)?.name ?? "").toLowerCase();
      return desc.includes(q) || catName.includes(q);
    });
  }, [feedItems, searchQuery, categoryById]);

  // Se houver alvo de highlight via deep-link além da primeira página, expande a visualização efetiva
  const highlightIndex = useMemo(() => {
    if (!highlightId) return -1;
    return filteredFeedItems.findIndex((it) => it.id === highlightId);
  }, [highlightId, filteredFeedItems]);

  const effectiveVisibleCount = useMemo(() => {
    if (highlightIndex >= 0 && highlightIndex >= visibleCount) {
      return Math.ceil((highlightIndex + 1) / TRANSACTIONS_PAGE_SIZE) * TRANSACTIONS_PAGE_SIZE;
    }
    return visibleCount;
  }, [highlightIndex, visibleCount]);

  const visibleFeedItems = useMemo(
    () => filteredFeedItems.slice(0, effectiveVisibleCount),
    [filteredFeedItems, effectiveVisibleCount],
  );

  const feedGroups = useMemo(() => groupFeedByDay(visibleFeedItems), [visibleFeedItems]);
  const hasMore = filteredFeedItems.length > effectiveVisibleCount;
  const isSearching = searchQuery.trim().length > 0;

  // Frequência por template (Fase 32) — subtítulo "Mensal", "Semanal", etc.
  const frequencyById = useMemo(
    () => new Map((recurrencesQuery.data ?? []).map((recurrence) => [recurrence.id, recurrence.frequency])),
    [recurrencesQuery.data],
  );
  const recurrenceLabel = useCallback(
    (recurrenceId: string | null | undefined): string | undefined => {
      const frequency = recurrenceId ? frequencyById.get(recurrenceId) : undefined;
      return frequency ? RECURRENCE_FREQUENCY_LABELS[frequency] : undefined;
    },
    [frequencyById],
  );

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

  const cardsQuery = useCreditCards();
  const cardById = useMemo(
    () => new Map((cardsQuery.data ?? []).map((c) => [c.id, c.name])),
    [cardsQuery.data],
  );

  const handleExportCsv = () => {
    if (filteredFeedItems.length === 0) return;
    const rows: ExportUnifiedTransactionRow[] = filteredFeedItems.map((item) => {
      const isExpense = item.kind === "expense";
      const exp = item.rawExpense ?? null;
      const inc = item.rawIncome ?? null;

      const catId = exp?.category_id ?? inc?.category_id ?? item.categoryId;
      const catName = (catId ? categoryById.get(catId)?.name : null) ?? "Sem categoria";

      const cardName = exp?.card_id ? (cardById.get(exp.card_id) ?? null) : null;
      const installments =
        exp && exp.installments_total > 1
          ? `${exp.installment_number}/${exp.installments_total}`
          : "—";

      const detailsOrMethod = isExpense
        ? exp
          ? (PAYMENT_METHOD_LABELS[exp.payment_method] ?? exp.payment_method)
          : ""
        : inc
          ? (RECEIVE_TYPE_LABELS[inc.receive_type] ?? inc.receive_type)
          : "";

      const recLabel = recurrenceLabel(exp?.recurrence_id ?? inc?.recurrence_id ?? item.recurrenceId);

      return {
        date: item.date,
        type: item.kind,
        description: item.description,
        categoryName: catName,
        valueCents: item.amountCents,
        reportValueCents: Math.round(item.amountCents * (item.reportWeight ?? 1)),
        detailsOrMethod,
        cardName,
        installments,
        recurrenceLabel: recLabel,
      };
    });

    const filterSlug = filter === "all" ? "todas" : filter;
    downloadCsv(`transacoes_${month}_${filterSlug}.csv`, serializeUnifiedTransactionsCsv(rows));
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
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
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
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
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
              <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
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
          onClick={handleExportCsv}
          disabled={filteredFeedItems.length === 0}
          aria-label="Exportar CSV"
          title={filteredFeedItems.length === 0 ? "Nenhum lançamento para exportar" : "Exportar lançamentos filtrados em CSV"}
        >
          <Download className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Exportar </span>CSV
        </Button>
      </div>

      <div className="flex flex-col gap-3">
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por descrição ou categoria…"
            className="pl-9 pr-9 text-xs sm:text-sm h-9.5 bg-surface"
            aria-label="Buscar lançamentos"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Limpar campo de busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

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
          title={isSearching ? "Nenhum resultado encontrado" : "Nenhum lançamento encontrado"}
          description={
            isSearching
              ? `Nenhum lançamento corresponde ao termo "${searchQuery.trim()}". Tente buscar por outro termo ou limpe a busca.`
              : filter === "incomes"
                ? "Nenhuma receita registrada neste mês."
                : filter === "expenses"
                  ? "Nenhuma despesa registrada neste mês."
                  : filter === "recurring"
                    ? "Nenhum lançamento recorrente neste mês."
                    : filter === "installments"
                      ? "Nenhum lançamento parcelado neste mês."
                      : "Registre sua primeira transação para acompanhar suas finanças neste mês."
          }
          action={
            isSearching ? (
              <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="mt-2 cursor-pointer gap-1.5">
                <X className="size-3.5" aria-hidden="true" />
                Limpar busca
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button size="sm" onClick={handleNewTransaction} className="gap-1.5 cursor-pointer">
                  <Plus className="size-4" aria-hidden="true" />
                  Novo lançamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    startDemo("finances");
                    setStepIndex(1);
                  }}
                  className="gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Ver exemplo na Simulação
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5 sm:gap-4">
          {feedGroups.map((group) => (
            <section
              key={group.date}
              aria-label={`Lançamentos de ${formatDateBR(group.date)}`}
              className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-surface-hover/25 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>{formatDateBR(group.date)}</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  ({group.items.length} {group.items.length === 1 ? "lançamento" : "lançamentos"})
                </span>
              </div>
              <div className="divide-y divide-border/40">
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
              {/* Barra de rodapé com soma total e soma ponderada */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 bg-surface-hover/20 border-t border-border/50 text-xs">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Total do dia
                </span>
                <div className="flex items-center gap-2 sm:gap-3 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Total:</span>
                    <MoneyText
                      cents={group.netCents}
                      tone={group.netCents > 0 ? "positive" : group.netCents < 0 ? "negative" : "default"}
                      sign="auto"
                      className="text-xs font-semibold"
                    />
                  </span>
                  {group.netCents !== group.weightedNetCents ? (
                    <span className="inline-flex items-center gap-1 border-l border-border/60 pl-2 sm:pl-3">
                      <span className="text-[11px] text-muted-foreground">Ponderado:</span>
                      <MoneyText
                        cents={group.weightedNetCents}
                        tone={group.weightedNetCents > 0 ? "positive" : group.weightedNetCents < 0 ? "negative" : "default"}
                        sign="auto"
                        className="text-xs font-medium text-muted-foreground"
                      />
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          ))}

          {hasMore ? (
            <div className="flex flex-col items-center justify-center pt-2 pb-4 gap-2 border-t border-border/40 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + TRANSACTIONS_PAGE_SIZE)}
                className="cursor-pointer gap-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
                aria-label={`Carregar mais lançamentos. ${filteredFeedItems.length - effectiveVisibleCount} lançamentos restantes`}
              >
                <span>Carregar mais lançamentos ({filteredFeedItems.length - effectiveVisibleCount} restantes)</span>
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
              <span className="text-[11px] text-muted-foreground font-mono">
                Exibindo {effectiveVisibleCount} de {filteredFeedItems.length} lançamentos
              </span>
            </div>
          ) : null}
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
