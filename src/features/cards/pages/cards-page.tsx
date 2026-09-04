import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Download, FileUp, Plus, Printer, Repeat, Trash2, Undo2, WalletCards, Zap } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, MoneyText, Skeleton } from "@/components/ui";


import {
  CardInvoicePrintView,
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
  useDeleteCardPayment,
  usePermission,
  useUpdateCard,
} from "@/state";
import { CardFormDialog } from "@/features/cards/components/card-form-dialog";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import { StatementImportDialog } from "@/features/cards/components/statement-import-dialog";
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
  // Deep link direto (F12): ?novo=cartao abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen, fromUrl } = useCreateDeepLink("cartao");
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<CardPayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
  if (selectedCard && summary) {
    usedLimitMap[selectedCard.id] = {
      brutoCents: summary.saldoBrutoCents,
      ponderadoCents: summary.saldoPonderadoCents,
    };
  }

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
              "flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-surface/50 border border-border/70 backdrop-blur-sm shadow-xs transition-all",
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
          <div className="flex flex-col gap-4">
            <MonthPicker value={effectiveMonth} onValueChange={setMonth} />

            {/* KPIs da fatura com visão dupla (Bruto vs. Ponderado) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
              <KpiCard
                label="Fatura Total (Bruto)"
                cents={summary?.previstoBrutoCents ?? 0}
                hint={
                  summary && summary.previstoBrutoCents !== summary.previstoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
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
                  summary && summary.estornoCents > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
                      <span>Estornos:</span>
                      <MoneyText cents={summary.estornoCents} tone="positive" className="text-[11px] tabular-nums" />
                    </span>
                  ) : undefined
                }
              />
              <KpiCard
                label="Saldo aberto (Bruto)"
                cents={summary?.saldoBrutoCents ?? 0}
                tone={summary && summary.saldoBrutoCents > 0 ? "negative" : "positive"}
                hint={
                  summary && summary.saldoBrutoCents !== summary.saldoPonderadoCents ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] truncate">
                      <span className="hidden sm:inline">Ponderado:</span>
                      <span className="sm:hidden">Pond:</span>
                      <MoneyText cents={summary.saldoPonderadoCents} tone="default" className="text-[11px] tabular-nums" />
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

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={() => handleOpenPayment("refund")} className="gap-1.5 flex-1 sm:flex-none justify-center">
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Estorno
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleOpenPayment("payment")}
                    disabled={(summary?.saldoCents ?? 0) <= 0}
                    className="gap-1.5 flex-1 sm:flex-none justify-center"
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

      <StatementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        card={selectedCard}
        competenceMonth={effectiveMonth}
      />

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
