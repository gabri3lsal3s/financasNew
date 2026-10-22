import { lazy, Suspense, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Download, FileUp, Plus, Printer, Repeat, Trash2, Undo2, WalletCards, Zap } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, MoneyText, Skeleton } from "@/components/ui";


import {
  CardInvoicePrintView,
  CardSubscriptionRadar,
  CreditCardWallet,
  InvoiceStatusBadge,
  KpiCard,
  MonthPicker,
  ReadOnlyBanner,
  ReportDocumentLayout,
  TransactionRow,
  UpgradeDialog,
} from "@/components/modules";
import {
  autoSelectBillMonth,
  buildCompetenceSummaries,
  invoiceDueDate,
  invoiceStatus,
  partitionInvoiceExpenses,
  shiftMonth,
} from "@/domain/cards";
import { currentMonth, monthLabel } from "@/lib/date";
import { serializeCardInvoiceCsv, type ExportCardInvoiceRow } from "@/domain/export";
import { todayISO } from "@/domain/debts";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { calculateCardSubscriptionImpact } from "@/domain/insights/card-radar";
import { partitionFeedback } from "@/domain/insights/feedback";
import type { CardInvoiceExpenseRow, CardInvoicePaymentRow } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { downloadCsv } from "@/services/export-actions";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useCardExpenses,
  useCardPayments,
  useCategories,
  useCreditCards,
  useDeleteCardPayment,
  useFeedback,
  usePermission,
  useSetFeedback,
  useUpdateCard,
} from "@/state";
import { CardFormDialog } from "@/features/cards/components/card-form-dialog";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { CardPayment, CreditCard, Expense } from "@/types";

const StatementImportDialog = lazy(() =>
  import("@/features/cards/components/statement-import-dialog").then((m) => ({
    default: m.StatementImportDialog,
  })),
);
import { cn } from "@/lib/utils";

type PaymentMode = "payment" | "refund" | null;

/**
 * Página de Gestão Completa de Cartões de Crédito:
 * - Carteira / Carrossel 3D com modelo de cartão que agrega todas as informações
 *   (limite total/disponível, fatura atual, melhor dia de compra, fechamento e vencimento)
 * - Edição, Desativação/Arquivamento e Exclusão segura de cartões
 * - Fatura por competência (previsto, pago, saldo aberto, estornos)
 * - Extrato discriminado de despesas e pagamentos/estornos (com opção de exclusão)
 */
export function CardsPage() {
  const cardsQuery = useCreditCards();
  const updateCardMutation = useUpdateCard();
  const deleteCardPaymentMutation = useDeleteCardPayment();
  const allCardExpensesQuery = useAllCardExpenses();
  const allCardPaymentsQuery = useAllCardPayments();
  const feedbackQuery = useFeedback();
  const setFeedbackMutation = useSetFeedback();
  const [searchParams, setSearchParams] = useSearchParams();

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);

  // Destaque do cartão via ?q= (um-shot — limpo pelo hook); seleção via
  // ?card= (derivada) ou escolha manual (limpa o param). Sem setState em effect.
  const { isHighlighted } = useHighlightTarget("q");
  const paramCard = searchParams.get("card");
  const paramMonth = searchParams.get("month");

  // Derivação pura: prioriza o cartão e fatura em aberto com vencimento mais próximo
  const prioritySelection = useMemo(() => {
    if (cards.length === 0) return { cardId: null, month: null };
    const allExpenses = allCardExpensesQuery.data ?? [];
    const allPayments = allCardPaymentsQuery.data ?? [];

    interface OpenBillCandidate {
      cardId: string;
      month: string;
      dueDate: string;
      saldoCents: number;
    }

    const openBills: OpenBillCandidate[] = [];

    for (const card of cards.filter((c) => c.is_active)) {
      const cExpenses = allExpenses.filter((e) => e.card_id === card.id);
      const cPayments = allPayments.filter((p) => p.card_id === card.id);
      const cSummaries = buildCompetenceSummaries(cExpenses, cPayments);

      for (const s of cSummaries) {
        if (s.saldoCents > 0) {
          const dueDate = invoiceDueDate(s.month, card.due_day);
          openBills.push({
            cardId: card.id,
            month: s.month,
            dueDate,
            saldoCents: s.saldoCents,
          });
        }
      }
    }

    if (openBills.length > 0) {
      // Ordena por vencimento: prioridade máxima para a fatura mais urgente / vencida em aberto
      openBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return { cardId: openBills[0]!.cardId, month: openBills[0]!.month };
    }

    // Se nenhum cartão tiver saldo em aberto, busca o cartão cujo vencimento no mês atual é o mais próximo
    const currentM = currentMonth();
    const sortedByDue = [...cards.filter((c) => c.is_active)].sort((a, b) => {
      const dueA = invoiceDueDate(currentM, a.due_day);
      const dueB = invoiceDueDate(currentM, b.due_day);
      return dueA.localeCompare(dueB);
    });

    const fallbackCard = sortedByDue[0] ?? cards[0];
    return { cardId: fallbackCard?.id ?? null, month: null };
  }, [cards, allCardExpensesQuery.data, allCardPaymentsQuery.data]);

  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const selectedCardId = paramCard ?? pickedCardId ?? prioritySelection.cardId;

  const [month, setMonth] = useState<string | null>(null);
  // Deep link direto (F12): ?novo=cartao abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen, fromUrl } = useCreateDeepLink("cartao");
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<CardPayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? (selectedCardId ? undefined : cards[0]) ?? null;

  const cardId = selectedCard?.id ?? null;
  const expensesQuery = useCardExpenses(cardId);
  const paymentsQuery = useCardPayments(cardId);
  const categoriesQuery = useCategories("expense");

  const loading = cardsQuery.isLoading || (cardId !== null && (expensesQuery.isLoading || paymentsQuery.isLoading));
  const error = cardsQuery.error ?? expensesQuery.error ?? paymentsQuery.error ?? categoriesQuery.error ?? (actionError ? new Error(actionError) : null);

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );

  // Derivação pura (domain/cards): resumos por competência + seleção automática de mês.
  const summaries = useMemo(
    () => buildCompetenceSummaries(expensesQuery.data ?? [], paymentsQuery.data ?? []),
    [expensesQuery.data, paymentsQuery.data],
  );
  const effectiveMonth =
    paramMonth ??
    month ??
    (pickedCardId === null && !paramCard && prioritySelection.month ? prioritySelection.month : null) ??
    (summaries.length > 0 ? autoSelectBillMonth(summaries) : currentMonth());
  const summary = summaries.find((s) => s.month === effectiveMonth);

  const currMonth = currentMonth();
  const prevMonth = shiftMonth(currMonth, -1);
  const nextMonth = shiftMonth(currMonth, 1);

  const getMonthStatus = (m: string) => {
    if (!selectedCard) return "closed";
    const sum = summaries.find((s) => s.month === m);
    return invoiceStatus(m, selectedCard.due_day, sum?.saldoCents ?? 0);
  };

  const handleSelectQuickMonth = (m: string) => {
    triggerSensory("selection");
    setMonth(m);
  };

  const competenceExpenses = useMemo(
    () => (expensesQuery.data ?? []).filter((e) => e.bill_competence === effectiveMonth),
    [expensesQuery.data, effectiveMonth],
  );
  const competencePayments = useMemo(
    () => (paymentsQuery.data ?? []).filter((p) => p.competence_month === effectiveMonth),
    [paymentsQuery.data, effectiveMonth],
  );

  // Fatura separada: parceladas (herdadas de meses anteriores) × à vista
  // (gastos do mês), cada grupo ordenado por data — motor puro em domain/cards.
  const { installments, regular } = useMemo(
    () => partitionInvoiceExpenses(competenceExpenses),
    [competenceExpenses],
  );

  /** Linha de despesa da fatura (mesmo layout para os dois grupos). */
  const renderInvoiceRow = (expense: Expense) => {
    const category = categoryById.get(expense.category_id);
    const title = expense.description || category?.name || "Despesa";
    return (
      <TransactionRow
        key={expense.id}
        title={title}
        date={expense.date}
        subtitle={category?.name && expense.description ? category.name : undefined}
        amountCents={Math.round(expense.value * 100)}
        reportWeight={expense.report_weight}
        kind="expense"
        icon={category?.icon}
        iconColor={category?.color}
        badges={
          expense.installments_total > 1 ? (
            <Badge variant="muted" size="xs" className="font-mono">
              {expense.installment_number}/{expense.installments_total}
            </Badge>
          ) : undefined
        }
        onClick={() => setSelectedExpense(expense)}
      />
    );
  };

  const invStatus = selectedCard
    ? invoiceStatus(effectiveMonth, selectedCard.due_day, summary?.saldoCents ?? 0)
    : "closed";

  /**
   * Exporta a fatura do cartão em CSV — APENAS os gastos lançados no cartão na
   * competência selecionada (sem cartão/forma por coluna: redundantes aqui).
   * Permite comparar com a fatura do banco em planilha.
   */
  const handleExportInvoice = () => {
    if (!selectedCard || competenceExpenses.length === 0) return;
    const rows: ExportCardInvoiceRow[] = competenceExpenses.map((expense) => ({
      date: expense.date,
      description: expense.description ?? "",
      categoryName: categoryById.get(expense.category_id)?.name ?? "Sem categoria",
      valueCents: numberToCents(expense.value),
      reportValueCents: numberToCents(expense.value * expense.report_weight),
      installments: expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : "—",
    }));
    const slug = selectedCard.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    downloadCsv(`fatura_${slug}_${effectiveMonth}.csv`, serializeCardInvoiceCsv(rows));
  };

  // Fatura imprimível (PDF) — mesmos dados do CSV, com resumo e pagamentos.
  const printExpenseRows: CardInvoiceExpenseRow[] = competenceExpenses.map((expense) => ({
    date: expense.date,
    description: expense.description ?? "",
    categoryName: categoryById.get(expense.category_id)?.name ?? "Sem categoria",
    valueCents: numberToCents(expense.value),
    reportValueCents: numberToCents(expense.value * expense.report_weight),
    installments: expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : "—",
  }));
  const printPaymentRows: CardInvoicePaymentRow[] = competencePayments.map((payment) => ({
    date: payment.date,
    note: payment.note,
    amountCents: numberToCents(Math.abs(payment.amount)),
    isRefund: payment.amount < 0,
  }));

  const selectCard = (id: string) => {
    setActionError(null);
    setPickedCardId(id);
    setMonth(null); // reaplica a seleção automática do mês para o novo cartão
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("card");
        return updated;
      },
      { replace: true },
    );
  };

  const openForm = (card: CreditCard | null) => {
    setActionError(null);
    setEditingCard(card);
    setFormOpen(true);
  };

  const handleDeactivateCard = async (card: CreditCard) => {
    setActionError(null);
    try {
      await updateCardMutation.mutateAsync({
        id: card.id,
        input: {
          name: card.name,
          brand: card.brand,
          credit_limit: card.credit_limit,
          closing_day: card.closing_day,
          due_day: card.due_day,
          color: card.color,
          is_active: false,
        },
      });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  /**
   * Exclusão otimista (F30): fecha a confirmação e remove o registro da
   * fatura na hora; o hook faz rollback + toast se o servidor rejeitar.
   */
  const handleConfirmDeletePayment = () => {
    if (!deletingPayment) return;
    setActionError(null);
    setDeletingPayment(null);
    void Promise.resolve(deleteCardPaymentMutation.mutateAsync(deletingPayment.id)).catch(() => undefined);
  };

  const usedLimitMap: Record<string, { brutoCents: number; ponderadoCents: number }> = {};
  const allExpenses = useMemo(() => allCardExpensesQuery.data ?? [], [allCardExpensesQuery.data]);
  const allPayments = useMemo(() => allCardPaymentsQuery.data ?? [], [allCardPaymentsQuery.data]);

  for (const card of cards) {
    const cExpenses = allExpenses.filter((e) => e.card_id === card.id);
    const cPayments = allPayments.filter((p) => p.card_id === card.id);
    const cSummaries = buildCompetenceSummaries(cExpenses, cPayments);
    const cSum = cSummaries.find((s) => s.month === effectiveMonth);
    if (cSum) {
      usedLimitMap[card.id] = {
        brutoCents: cSum.saldoBrutoCents,
        ponderadoCents: cSum.saldoPonderadoCents,
      };
    }
  }

  const currentInvoiceSaldoBrutoCents = summary?.saldoBrutoCents ?? 0;

  // Radar de Assinaturas e Impacto na Fatura em Aberto (F22 / Tarefa 7.6)
  const cardSubscriptionImpact = useMemo(() => {
    if (!selectedCard) return null;
    const availableLimitCents =
      selectedCard.credit_limit !== null && selectedCard.credit_limit !== undefined && selectedCard.credit_limit > 0
        ? Math.max(0, Math.round(selectedCard.credit_limit * 100) - currentInvoiceSaldoBrutoCents)
        : null;

    const cardExpenseLikes: ExpenseLike[] = allExpenses
      .filter((e) => e.card_id === selectedCard.id)
      .map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: e.date ? e.date.slice(0, 7) : (e.bill_competence ?? currentMonth()),
        valueCents: Math.round(e.value * 100),
        categoryId: e.category_id,
        categoryName: categoryById.get(e.category_id)?.name ?? null,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
        recurrenceId: e.recurrence_id,
        paymentMethod: "credit_card",
        cardId: e.card_id,
        cardName: selectedCard.name,
        rawExpense: e,
      }));

    const todayISOStr = todayISO();
    const detected = detectRecurrences(cardExpenseLikes, { todayISO: todayISOStr });
    const feedbackMap = feedbackQuery.data ?? {};
    const { active } = partitionFeedback(detected, feedbackMap);
    return calculateCardSubscriptionImpact(selectedCard, active, {
      todayISO: todayISOStr,
      availableLimitCents,
    });
  }, [selectedCard, allExpenses, categoryById, currentInvoiceSaldoBrutoCents, feedbackQuery.data]);

  const permission = usePermission("cards");
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const handleOpenForm = (card: CreditCard | null) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext(card ? "Editar Cartão de Crédito" : "Adicionar Cartão de Crédito");
      setUpgradeOpen(true);
      return;
    }
    openForm(card);
  };

  const handleOpenPayment = (mode: PaymentMode) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Registrar Pagamento / Estorno de Fatura");
      setUpgradeOpen(true);
      return;
    }
    setPaymentMode(mode);
  };

  const handleOpenImport = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Importar Fatura de Cartão");
      setUpgradeOpen(true);
      return;
    }
    setImportOpen(true);
  };

  const handleDeletePaymentClick = (payment: CardPayment) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Excluir Pagamento de Fatura");
      setUpgradeOpen(true);
      return;
    }
    setDeletingPayment(payment);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Título de acessibilidade */}
      <h1 className="sr-only">Cartões de Crédito</h1>

      {permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            setUpgradeContext(undefined);
            setUpgradeOpen(true);
          }}
        />
      )}

      {error ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error">{getErrorMessage(error)}</Alert>
          <div className="flex items-center gap-2">
            {actionError &&
            (actionError.includes("desativá-lo") || actionError.includes("histórico")) &&
            selectedCard &&
            selectedCard.is_active ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDeactivateCard(selectedCard)}
              >
                Desativar cartão {selectedCard.name}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActionError(null);
                void Promise.all([cardsQuery.refetch(), expensesQuery.refetch(), paymentsQuery.refetch()]);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {cardsQuery.isError || expensesQuery.isError || paymentsQuery.isError ? (
        <ErrorState
          message={getErrorMessage(cardsQuery.error || expensesQuery.error || paymentsQuery.error)}
          onRetry={() => {
            void Promise.all([cardsQuery.refetch(), expensesQuery.refetch(), paymentsQuery.refetch()]);
          }}
        />
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-2xl max-w-[440px] mx-auto" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="size-6" aria-hidden="true" />}
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões de crédito para acompanhar faturas, limites disponíveis, melhor data de compra e extrato."
          tone="default"
          className="py-12 sm:py-16 px-6"
          action={
            <Button onClick={() => handleOpenForm(null)} className="gap-2">
              <Plus className="size-4" aria-hidden="true" />
              Adicionar primeiro cartão
            </Button>
          }
        />
      ) : (
        <>
          {/* =========================================================================
              SEÇÃO 1: CARTEIRA 3D (WALLET) COM MODELO INTERATIVO E INFORMAÇÕES EMBUTIDAS
             ========================================================================= */}
          <section
            aria-label="Carteira de Cartões"
            className={cn(
              "flex flex-col items-center justify-center p-3 sm:p-6 rounded-2xl bg-surface border border-border/80 shadow-xs transition-all",
              selectedCard && isHighlighted(selectedCard.id) && "ring-2 ring-primary",
            )}
          >
            <CreditCardWallet
              cards={cards}
              selectedCardId={selectedCard?.id ?? null}
              onSelectCard={selectCard}
              onEditCard={handleOpenForm}
              onNewCard={() => handleOpenForm(null)}
              usedLimitMap={usedLimitMap}
              competenceMonth={effectiveMonth}
              status={invStatus}
            />
          </section>

          {/* =========================================================================
              SEÇÃO 2: SELETOR DE MÊS, STATUS DA FATURA E KPIS
             ========================================================================= */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Seletor de mês full-width (padrão Orçamentos e Relatórios) */}
            <MonthPicker value={effectiveMonth} onValueChange={setMonth} />

            {/* Linha de controles: atalhos de competência (cards no mobile, pills no desktop) + ações de fatura */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Seletor rápido de faturas em cards (exclusivo para mobile — layout da versão anterior) */}
              <div className="grid grid-cols-3 gap-2 sm:hidden w-full" role="tablist" aria-label="Seletor rápido de faturas">
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveMonth === prevMonth}
                  onClick={() => handleSelectQuickMonth(prevMonth)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center",
                    effectiveMonth === prevMonth
                      ? "bg-surface-hover border-primary/50 shadow-xs ring-1 ring-primary/30"
                      : "bg-surface border-border hover:bg-surface-hover/60 text-muted-foreground",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anterior</span>
                  <span className="text-xs font-semibold text-foreground capitalize mt-0.5">{monthLabel(prevMonth).split(" ")[0]}</span>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={getMonthStatus(prevMonth)} size="xs" />
                  </div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveMonth === currMonth}
                  onClick={() => handleSelectQuickMonth(currMonth)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center",
                    effectiveMonth === currMonth
                      ? "bg-surface-hover border-primary/50 shadow-xs ring-1 ring-primary/30"
                      : "bg-surface border-border hover:bg-surface-hover/60 text-muted-foreground",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Atual</span>
                  <span className="text-xs font-semibold text-foreground capitalize mt-0.5">{monthLabel(currMonth).split(" ")[0]}</span>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={getMonthStatus(currMonth)} size="xs" />
                  </div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveMonth === nextMonth}
                  onClick={() => handleSelectQuickMonth(nextMonth)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center",
                    effectiveMonth === nextMonth
                      ? "bg-surface-hover border-primary/50 shadow-xs ring-1 ring-primary/30"
                      : "bg-surface border-border hover:bg-surface-hover/60 text-muted-foreground",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próxima</span>
                  <span className="text-xs font-semibold text-foreground capitalize mt-0.5">{monthLabel(nextMonth).split(" ")[0]}</span>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={getMonthStatus(nextMonth)} size="xs" />
                  </div>
                </button>
              </div>

              {/* Atalhos rápidos em pills (Anterior, Atual, Próxima) — exclusivo para desktop */}
              <div role="group" aria-label="Seletor rápido de faturas" className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={effectiveMonth === prevMonth ? "default" : "outline"}
                  onClick={() => handleSelectQuickMonth(prevMonth)}
                  className={cn(
                    "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
                    effectiveMonth === prevMonth ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={effectiveMonth === prevMonth}
                  sensoryIntent="selection"
                >
                  <span>Anterior</span>
                  <span className="text-[11px] opacity-75 capitalize">({monthLabel(prevMonth).split(" ")[0]})</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={effectiveMonth === currMonth ? "default" : "outline"}
                  onClick={() => handleSelectQuickMonth(currMonth)}
                  className={cn(
                    "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
                    effectiveMonth === currMonth ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={effectiveMonth === currMonth}
                  sensoryIntent="selection"
                >
                  <span>Atual</span>
                  <span className="text-[11px] opacity-75 capitalize">({monthLabel(currMonth).split(" ")[0]})</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={effectiveMonth === nextMonth ? "default" : "outline"}
                  onClick={() => handleSelectQuickMonth(nextMonth)}
                  className={cn(
                    "shrink-0 gap-1.5 text-xs h-8 px-3 rounded-xl transition-all",
                    effectiveMonth === nextMonth ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={effectiveMonth === nextMonth}
                  sensoryIntent="selection"
                >
                  <span>Próxima</span>
                  <span className="text-[11px] opacity-75 capitalize">({monthLabel(nextMonth).split(" ")[0]})</span>
                </Button>
              </div>

              {/* Ações principais da fatura */}
              {selectedCard ? (
                <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPayment("refund")}
                    className="gap-1.5 flex-1 sm:flex-none justify-center text-xs h-8"
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Estorno
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleOpenPayment("payment")}
                    className="gap-1.5 flex-1 sm:flex-none justify-center text-xs h-8 shadow-xs"
                  >
                    Registrar pagamento
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Linha discreta de status da fatura e limite disponível */}
            {selectedCard ? (
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status da fatura:</span>
                  <InvoiceStatusBadge status={invStatus} size="sm" />
                </div>
                {selectedCard.credit_limit !== null && selectedCard.credit_limit !== undefined && selectedCard.credit_limit > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span>Limite disponível:</span>
                    <span className="font-semibold text-foreground">
                      <MoneyText
                        cents={Math.max(0, Math.round(selectedCard.credit_limit * 100) - (summary?.saldoBrutoCents ?? 0))}
                        tone="default"
                      />
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* KPIs da fatura com visão dupla (Bruto vs. Ponderado) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
              <KpiCard
                label="Fatura Total (Bruto)"
                cents={summary?.previstoBrutoCents ?? 0}
                hint={
                  summary && summary.previstoBrutoCents !== summary.previstoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
                      <span className="hidden sm:inline">Ponderada:</span>
                      <span className="sm:hidden">Pond:</span>
                      <MoneyText cents={summary.previstoPonderadoCents} tone="default" className="text-[11px] tabular-nums" />
                    </span>
                  ) : undefined
                }
              />
              <KpiCard
                label="Pago"
                cents={summary?.pagoCents ?? 0}
                hint={
                  summary && (summary.estornoCents > 0 || summary.creditoAnteriorCents > 0) ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
                      {summary.creditoAnteriorCents > 0 && (
                        <span>
                          <span className="hidden sm:inline">Crédito anterior:</span>
                          <span className="sm:hidden">Créd. ant:</span>{" "}
                          <MoneyText cents={summary.creditoAnteriorCents} tone="positive" className="text-[11px] tabular-nums" />
                        </span>
                      )}
                      {summary.creditoAnteriorCents > 0 && summary.estornoCents > 0 && <span>·</span>}
                      {summary.estornoCents > 0 && (
                        <span>
                          <span>Estornos:</span>{" "}
                          <MoneyText cents={summary.estornoCents} tone="positive" className="text-[11px] tabular-nums" />
                        </span>
                      )}
                    </span>
                  ) : undefined
                }
              />
              <KpiCard
                label="Saldo aberto (Bruto)"
                cents={summary?.saldoBrutoCents ?? 0}
                tone={summary && summary.saldoBrutoCents > 0 ? "negative" : "positive"}
                hint={
                  summary && summary.creditoRestanteCents > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-positive-strong text-[11px] whitespace-nowrap tabular-nums">
                      <span className="hidden sm:inline">Crédito p/ fatura seguinte:</span>
                      <span className="sm:hidden">Créd. seguinte:</span>
                      <MoneyText cents={summary.creditoRestanteCents} tone="positive" className="text-[11px] tabular-nums" />
                    </span>
                  ) : summary && summary.saldoBrutoCents !== summary.saldoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
                      <span className="hidden sm:inline">Ponderado:</span>
                      <span className="sm:hidden">Pond:</span>
                      <MoneyText cents={summary.saldoPonderadoCents} tone="default" className="text-[11px] tabular-nums" />
                    </span>
                  ) : undefined
                }
              />
            </div>

            {/* Bloco Informativo de Impacto de Assinaturas na Fatura em Aberto (F22 / Tarefa 7.6) */}
            {cardSubscriptionImpact && cardSubscriptionImpact.totalProjectedCents > 0 ? (
              <CardSubscriptionRadar
                impact={cardSubscriptionImpact}
                onIgnoreItem={(key) => setFeedbackMutation.mutate({ occurrenceKey: key, decision: "ignore" })}
              />
            ) : null}
          </div>

          {/* =========================================================================
              SEÇÃO 3: EXTRATO DISCRIMINADO (DESPESAS E PAGAMENTOS)
             ========================================================================= */}
          <section aria-label={`Despesas da fatura de ${monthLabel(effectiveMonth)}`} className="flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col gap-2.5 pb-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Despesas · {monthLabel(effectiveMonth)}
                </h2>
                <span className="text-xs text-muted-foreground font-mono sm:hidden">
                  {competenceExpenses.length} {competenceExpenses.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
                  {competenceExpenses.length} {competenceExpenses.length === 1 ? "item" : "itens"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenImport}
                  disabled={!selectedCard}
                  className="gap-1.5 flex-1 sm:flex-none justify-center"
                >
                  <FileUp className="size-3.5" aria-hidden="true" />
                  <span>Importar<span className="hidden sm:inline"> fatura</span></span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintOpen(true)}
                  disabled={competenceExpenses.length === 0 || !selectedCard}
                  className="gap-1.5 flex-1 sm:flex-none justify-center"
                >
                  <Printer className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Imprimir / Salvar </span>PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportInvoice}
                  disabled={competenceExpenses.length === 0 || !selectedCard}
                  className="gap-1.5 flex-1 sm:flex-none justify-center"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Exportar </span>CSV
                </Button>
              </div>
            </div>

            {competenceExpenses.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6" aria-hidden="true" />}
                title="Sem despesas nesta fatura"
                description="As compras no cartão aparecem aqui de acordo com o fechamento da fatura."
                className="py-10 sm:py-12 px-4"
              />
            ) : (
              <div className="flex flex-col gap-6 sm:gap-7">
                {/* Parceladas — compras herdadas de meses anteriores (topo) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-0.5">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Repeat className="size-3.5" aria-hidden="true" />
                      Parceladas
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {installments.length} {installments.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {installments.length === 0 ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/50 py-5 px-4 text-center text-xs text-muted-foreground">
                      Nenhuma compra parcelada nesta fatura.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:gap-2.5">
                      {installments.map(renderInvoiceRow)}
                    </div>
                  )}
                </div>

                {/* À vista — gastos do próprio mês da fatura (abaixo) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-0.5">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Zap className="size-3.5" aria-hidden="true" />
                      À vista
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {regular.length} {regular.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {regular.length === 0 ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/50 py-5 px-4 text-center text-xs text-muted-foreground">
                      Nenhuma compra à vista nesta fatura.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:gap-2.5">
                      {regular.map(renderInvoiceRow)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Pagamentos e estornos */}
          <section aria-label="Pagamentos e estornos" className="flex flex-col gap-3.5 sm:gap-4">
            <div className="flex items-center justify-between pb-0.5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pagamentos e estornos
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {competencePayments.length} {competencePayments.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            {competencePayments.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6" aria-hidden="true" />}
                title="Nenhum pagamento"
                description="Registre o pagamento ou estorno desta fatura quando for efetuado."
                className="py-8 sm:py-10 px-4"
              />
            ) : (
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {competencePayments.map((payment) =>
                  payment.amount < 0 ? (
                    <TransactionRow
                      key={payment.id}
                      title={payment.note || "Estorno"}
                      date={payment.date}
                      amountCents={Math.round(-payment.amount * 100)}
                      kind="income"
                      badges={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePaymentClick(payment)}
                          aria-label={`Excluir estorno ${payment.note || ""}`}
                          className="size-7 p-0 text-muted-foreground hover:text-critical"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                  ) : (
                    <TransactionRow
                      key={payment.id}
                      title={payment.note || "Pagamento de fatura"}
                      date={payment.date}
                      amountCents={Math.round(payment.amount * 100)}
                      kind="expense"
                      badges={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePaymentClick(payment)}
                          aria-label={`Excluir pagamento ${payment.note || ""}`}
                          className="size-7 p-0 text-muted-foreground hover:text-critical"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Diálogo de Cartão: Edição quando editingCard estiver definido; Criação caso contrário */}
      <CardFormDialog
        card={editingCard}
        open={formOpen || fromUrl}
        onOpenChange={(next) => {
          if (!next) {
            setFormOpen(false);
            setEditingCard(null);
            if (fromUrl) {
              setSearchParams(
                (prev) => {
                  const updated = new URLSearchParams(prev);
                  updated.delete("novo");
                  return updated;
                },
                { replace: true },
              );
            }
          } else {
            setFormOpen(true);
          }
        }}
        onDeleted={(deletedId) => {
          const remaining = cards.filter((c) => c.id !== deletedId);
          if (selectedCard?.id === deletedId) {
            if (remaining.length > 0 && remaining[0]) {
              selectCard(remaining[0].id);
            } else {
              setPickedCardId(null);
            }
          }
        }}
      />

      {/* Diálogo de confirmação para exclusão de pagamento ou estorno */}
      {deletingPayment && (
        <ConfirmDialog
          open={deletingPayment !== null}
          onOpenChange={(next) => {
            if (!next) setDeletingPayment(null);
          }}
          title={deletingPayment.amount < 0 ? "Excluir estorno" : "Excluir pagamento de fatura"}
          description={
            deletingPayment.amount < 0
              ? "Tem certeza que deseja excluir este estorno? A receita automática correspondente no extrato também será removida."
              : "Tem certeza que deseja excluir este pagamento de fatura? O saldo da fatura será recalculado automaticamente."
          }
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={() => void handleConfirmDeletePayment()}
        />
      )}

      {cardId && paymentMode ? (
        <PaymentDialog
          cardId={cardId}
          competenceMonth={effectiveMonth}
          mode={paymentMode}
          open={paymentMode !== null}
          onOpenChange={(next) => {
            if (!next) setPaymentMode(null);
          }}
          openBalanceCents={summary?.saldoBrutoCents ?? 0}
        />
      ) : null}

      {importOpen && (
        <Suspense fallback={null}>
          <StatementImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            card={selectedCard}
            competenceMonth={effectiveMonth}
          />
        </Suspense>
      )}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedExpense(null);
        }}
      />

      {/* Fatura imprimível — preview no modal + portal de impressão (padrão unificado F22/F42) */}
      {selectedCard && summary ? (
        <ReportDocumentLayout
          open={printOpen}
          onOpenChange={setPrintOpen}
          title={`Fatura — ${selectedCard.name}`}
          documentTitle={`Fatura_${selectedCard.name.replace(/[^a-zA-Z0-9_\u00C0-\u00FF]+/g, "_")}_${effectiveMonth}.pdf`}
          size="2xl"
        >
          <CardInvoicePrintView
            cardName={selectedCard.name}
            competenceMonth={effectiveMonth}
            competenceLabel={monthLabel(effectiveMonth)}
            totalBrutoCents={summary.previstoBrutoCents}
            totalPonderadoCents={summary.previstoPonderadoCents}
            pagoCents={summary.pagoCents}
            saldoAbertoCents={summary.saldoBrutoCents}
            saldoPonderadoCents={summary.saldoPonderadoCents}
            expenses={printExpenseRows}
            payments={printPaymentRows}
          />
        </ReportDocumentLayout>
      ) : null}

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
