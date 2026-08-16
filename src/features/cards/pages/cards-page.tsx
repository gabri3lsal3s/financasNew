import { useState } from "react";
import { useSearchParams } from "react-router";
import { Download, Plus, Printer, Repeat, Trash2, Undo2, WalletCards, Zap } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, Modal, MoneyText, PrintSheet, Skeleton } from "@/components/ui";
import {
  CardInvoicePrintView,
  CreditCardWallet,
  InvoiceStatusBadge,
  KpiCard,
  MonthPicker,
  TransactionRow,
} from "@/components/modules";
import {
  autoSelectBillMonth,
  buildCompetenceSummaries,
  invoiceStatus,
  partitionInvoiceExpenses,
} from "@/domain/cards";
import { currentMonth, monthLabel } from "@/lib/date";
import { serializeCardInvoiceCsv } from "@/domain/export";
import type { ExportCardInvoiceRow } from "@/domain/export";
import type { CardInvoiceExpenseRow, CardInvoicePaymentRow } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { downloadCsv } from "@/services/export-actions";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import {
  useCardExpenses,
  useCardPayments,
  useCategories,
  useCreditCards,
  useDeleteCard,
  useDeleteCardPayment,
  useUpdateCard,
} from "@/state";
import { CardFormDialog } from "@/features/cards/components/card-form-dialog";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { CardPayment, CreditCard, Expense } from "@/types";
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
  const deleteCardMutation = useDeleteCard();
  const updateCardMutation = useUpdateCard();
  const deleteCardPaymentMutation = useDeleteCardPayment();
  const [searchParams, setSearchParams] = useSearchParams();

  // Destaque do cartão via ?q= (um-shot — limpo pelo hook); seleção via
  // ?card= (derivada) ou escolha manual (limpa o param). Sem setState em effect.
  const { isHighlighted } = useHighlightTarget("q");
  const paramCard = searchParams.get("card");
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const selectedCardId = paramCard ?? pickedCardId;

  const [month, setMonth] = useState<string | null>(null);
  // FAB contextual (F12): ?novo=cartao abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen, fromUrl } = useCreateDeepLink("cartao");
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deletingCard, setDeletingCard] = useState<CreditCard | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<CardPayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const cards = cardsQuery.data ?? [];
  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? (selectedCardId ? undefined : cards[0]) ?? null;

  const cardId = selectedCard?.id ?? null;
  const expensesQuery = useCardExpenses(cardId);
  const paymentsQuery = useCardPayments(cardId);
  const categoriesQuery = useCategories("expense");

  const loading = cardsQuery.isLoading || (cardId !== null && (expensesQuery.isLoading || paymentsQuery.isLoading));
  const error = cardsQuery.error ?? expensesQuery.error ?? paymentsQuery.error ?? categoriesQuery.error ?? (actionError ? new Error(actionError) : null);

  const categoryById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));

  // Derivação pura (domain/cards): resumos por competência + seleção automática de mês.
  const summaries = buildCompetenceSummaries(expensesQuery.data ?? [], paymentsQuery.data ?? []);
  const effectiveMonth = month ?? (summaries.length > 0 ? autoSelectBillMonth(summaries) : currentMonth());
  const summary = summaries.find((s) => s.month === effectiveMonth);

  const competenceExpenses = (expensesQuery.data ?? []).filter((e) => e.bill_competence === effectiveMonth);
  const competencePayments = (paymentsQuery.data ?? []).filter((p) => p.competence_month === effectiveMonth);

  // Fatura separada: parceladas (herdadas de meses anteriores) × à vista
  // (gastos do mês), cada grupo ordenado por data — motor puro em domain/cards.
  const { installments, regular } = partitionInvoiceExpenses(competenceExpenses);

  /** Linha de despesa da fatura (mesmo layout para os dois grupos). */
  const renderInvoiceRow = (expense: Expense) => {
    const category = categoryById.get(expense.category_id);
    const title = expense.description || category?.name || "Despesa";
    return (
      <TransactionRow
        key={expense.id}
        title={title}
        date={expense.date}
        subtitle={expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : undefined}
        amountCents={Math.round(expense.value * 100)}
        reportWeight={expense.report_weight}
        kind="expense"
        icon={category?.icon}
        iconColor={category?.color}
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

  const handleRequestDelete = (card: CreditCard) => {
    setActionError(null);
    setDeletingCard(card);
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
      setDeletingCard(null);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCard) return;
    setActionError(null);
    try {
      await deleteCardMutation.mutateAsync(deletingCard.id);
      const remainingCards = cards.filter((c) => c.id !== deletingCard.id);
      setDeletingCard(null);
      if (selectedCard?.id === deletingCard.id) {
        if (remainingCards.length > 0 && remainingCards[0]) {
          selectCard(remainingCards[0].id);
        } else {
          setPickedCardId(null);
        }
      }
    } catch (err) {
      setDeletingCard(null);
      const msg = getErrorMessage(err);
      if (
        msg.toLowerCase().includes("foreign key") ||
        msg.toLowerCase().includes("histórico") ||
        msg.toLowerCase().includes("vinculad") ||
        msg.toLowerCase().includes("desativá-lo")
      ) {
        setActionError(
          "Não é possível excluir um cartão que possui despesas ou pagamentos registrados. Você pode desativá-lo para mantê-lo no histórico.",
        );
      } else {
        setActionError(msg);
      }
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
  if (selectedCard && summary) {
    usedLimitMap[selectedCard.id] = {
      brutoCents: summary.saldoBrutoCents,
      ponderadoCents: summary.saldoPonderadoCents,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Título de acessibilidade */}
      <h1 className="sr-only">Cartões de Crédito</h1>

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

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-2xl max-w-[440px] mx-auto" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          tone="primary"
          action={
            <Button onClick={() => openForm(null)} className="gap-2">
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
              "flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-surface/50 border border-border/70 backdrop-blur-sm shadow-xs transition-all",
              selectedCard && isHighlighted(selectedCard.id) && "ring-2 ring-primary",
            )}
          >
            <CreditCardWallet
              cards={cards}
              selectedCardId={selectedCard?.id ?? null}
              onSelectCard={selectCard}
              onEditCard={openForm}
              onDeleteCard={handleRequestDelete}
              onNewCard={() => openForm(null)}
              usedLimitMap={usedLimitMap}
              competenceMonth={effectiveMonth}
              status={invStatus}
            />
          </section>

          {/* =========================================================================
              SEÇÃO 2: SELETOR DE MÊS, STATUS DA FATURA E KPIS
             ========================================================================= */}
          <div className="flex flex-col gap-4">
            <MonthPicker value={effectiveMonth} onValueChange={setMonth} />

            {/* KPIs da fatura com visão dupla (Bruto vs. Ponderado) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                label="Fatura Total (Bruto)"
                cents={summary?.previstoBrutoCents ?? 0}
                hint={
                  summary && summary.previstoBrutoCents !== summary.previstoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <span>Ponderada:</span>
                      <MoneyText cents={summary.previstoPonderadoCents} tone="default" />
                    </span>
                  ) : undefined
                }
              />
              <KpiCard label="Pago" cents={summary?.pagoCents ?? 0} />
              <KpiCard
                label="Saldo aberto (Bruto)"
                cents={summary?.saldoBrutoCents ?? 0}
                tone={summary && summary.saldoBrutoCents > 0 ? "negative" : "positive"}
                hint={
                  summary && summary.saldoBrutoCents !== summary.saldoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <span>Ponderado:</span>
                      <MoneyText cents={summary.saldoPonderadoCents} tone="default" />
                    </span>
                  ) : undefined
                }
              />
            </div>

            {selectedCard ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Status da fatura:</span>
                  <InvoiceStatusBadge status={invStatus} />
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPaymentMode("refund")} className="gap-1.5">
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Estorno
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setPaymentMode("payment")}
                    disabled={(summary?.saldoCents ?? 0) <= 0}
                    className="gap-1.5"
                  >
                    Registrar pagamento
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* =========================================================================
              SEÇÃO 3: EXTRATO DISCRIMINADO (DESPESAS E PAGAMENTOS)
             ========================================================================= */}
          <section aria-label={`Despesas da fatura de ${monthLabel(effectiveMonth)}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Despesas · {monthLabel(effectiveMonth)}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {competenceExpenses.length} {competenceExpenses.length === 1 ? "item" : "itens"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintOpen(true)}
                  disabled={competenceExpenses.length === 0 || !selectedCard}
                  className="gap-1.5"
                >
                  <Printer className="size-3.5" aria-hidden="true" />
                  Imprimir / Salvar PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportInvoice}
                  disabled={competenceExpenses.length === 0 || !selectedCard}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            {competenceExpenses.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6 text-muted-foreground" aria-hidden="true" />}
                title="Sem despesas nesta fatura"
                description="As compras no cartão aparecem aqui de acordo com o fechamento da fatura."
              />
            ) : (
              <>
                {/* Parceladas — compras herdadas de meses anteriores (topo) */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Repeat className="size-3.5" aria-hidden="true" />
                      Parceladas
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {installments.length} {installments.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {installments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma compra parcelada nesta fatura.</p>
                  ) : (
                    installments.map(renderInvoiceRow)
                  )}
                </div>

                {/* À vista — gastos do próprio mês da fatura (abaixo) */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Zap className="size-3.5" aria-hidden="true" />
                      À vista
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {regular.length} {regular.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {regular.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma compra à vista nesta fatura.</p>
                  ) : (
                    regular.map(renderInvoiceRow)
                  )}
                </div>
              </>
            )}
          </section>

          {/* Pagamentos e estornos */}
          <section aria-label="Pagamentos e estornos" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pagamentos e estornos
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {competencePayments.length} {competencePayments.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            {competencePayments.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6 text-muted-foreground" aria-hidden="true" />}
                title="Nenhum pagamento"
                description="Registre o pagamento ou estorno desta fatura quando for efetuado."
              />
            ) : (
              competencePayments.map((payment) =>
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
                        onClick={() => setDeletingPayment(payment)}
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
                        onClick={() => setDeletingPayment(payment)}
                        aria-label={`Excluir pagamento ${payment.note || ""}`}
                        className="size-7 p-0 text-muted-foreground hover:text-critical"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                ),
              )
            )}
          </section>
        </>
      )}

      {/* Deep-link do FAB sempre abre em modo criação (ignora edição pendente). */}
      <CardFormDialog
        card={fromUrl ? null : editingCard}
        open={formOpen}
        onOpenChange={setFormOpen}
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

      {/* Diálogo de confirmação para exclusão direta do cartão */}
      {deletingCard && (
        <ConfirmDialog
          open={deletingCard !== null}
          onOpenChange={(next) => {
            if (!next) setDeletingCard(null);
          }}
          title="Excluir cartão"
          description={`Tem certeza que deseja excluir o cartão "${deletingCard.name}"? Se houver histórico de compras ou pagamentos, você deve desativá-lo em vez de excluí-lo.`}
          confirmLabel="Excluir cartão"
          variant="destructive"
          onConfirm={() => void handleConfirmDelete()}
        />
      )}

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
        />
      ) : null}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedExpense(null);
        }}
      />

      {/* Fatura imprimível — preview no modal + portal de impressão (padrão F22) */}
      {selectedCard && summary ? (
        <>
          <Modal
            open={printOpen}
            onOpenChange={setPrintOpen}
            title={`Fatura — ${selectedCard.name}`}
            description={`Gastos lançados no cartão em ${monthLabel(effectiveMonth)} (competência ${effectiveMonth}), prontos para imprimir ou salvar em PDF — compare com a fatura do banco.`}
            size="xl"
            hideCalculator
          >
            <div className="mt-4">
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
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPrintOpen(false)}>
                Fechar
              </Button>
              <Button type="button" onClick={() => window.print()} className="gap-2">
                <Printer className="size-4" aria-hidden="true" />
                <span>Imprimir / Salvar PDF</span>
              </Button>
            </div>
          </Modal>

          <PrintSheet open={printOpen}>
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
          </PrintSheet>
        </>
      ) : null}
    </div>
  );
}
