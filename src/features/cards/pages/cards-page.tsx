import { useState } from "react";
import { useSearchParams } from "react-router";
import { Pencil, Plus, Undo2, WalletCards } from "lucide-react";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";
import { KpiCard, MonthPicker, TransactionRow, InvoiceStatusBadge } from "@/components/modules";
import { autoSelectBillMonth, buildCompetenceSummaries, invoiceStatus } from "@/domain/cards";
import { currentMonth, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useCardExpenses, useCardPayments, useCreditCards } from "@/state";
import { CardFormDialog } from "@/features/cards/components/card-form-dialog";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import type { CreditCard } from "@/types";
import { cn } from "@/lib/utils";

type PaymentMode = "payment" | "refund" | null;

/** Fatura de um cartão: previsto/pago/saldo + despesas + pagamentos (§3.3.3). */
export function CardsPage() {
  const cardsQuery = useCreditCards();
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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(null);

  const cards = cardsQuery.data ?? [];
  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? (selectedCardId ? undefined : cards[0]) ?? null;

  const cardId = selectedCard?.id ?? null;
  const expensesQuery = useCardExpenses(cardId);
  const paymentsQuery = useCardPayments(cardId);

  const loading = cardsQuery.isLoading || (cardId !== null && (expensesQuery.isLoading || paymentsQuery.isLoading));
  const error = cardsQuery.error ?? expensesQuery.error ?? paymentsQuery.error;

  // Derivação pura (domain/cards): resumos por competência + seleção automática de mês.
  const summaries = buildCompetenceSummaries(expensesQuery.data ?? [], paymentsQuery.data ?? []);
  const effectiveMonth = month ?? (summaries.length > 0 ? autoSelectBillMonth(summaries) : currentMonth());
  const summary = summaries.find((s) => s.month === effectiveMonth);

  const competenceExpenses = (expensesQuery.data ?? []).filter((e) => e.bill_competence === effectiveMonth);
  const competencePayments = (paymentsQuery.data ?? []).filter((p) => p.competence_month === effectiveMonth);

  const selectCard = (id: string) => {
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
    setEditingCard(card);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* F12 — sem header visual: seletor de mês direto; título apenas p/ leitores de tela. */}
      <h1 className="sr-only">Cartões</h1>

      {error ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error">{getErrorMessage(error)}</Alert>
          <div>
            <Button variant="outline" onClick={() => void Promise.all([expensesQuery.refetch(), paymentsQuery.refetch()])}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="size-6" aria-hidden="true" />}
          title="Nenhum cartão"
          description="Adicione seu primeiro cartão de crédito para acompanhar faturas, pagamentos e estornos."
          action={<Button onClick={() => openForm(null)}>Adicionar cartão</Button>}
        />
      ) : (
        <>
          {/* Seletor de cartão */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Selecionar cartão">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => selectCard(card.id)}
                aria-pressed={card.id === selectedCard?.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  card.id === selectedCard?.id
                    ? "border-primary bg-primary/10 text-primary-strong"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-hover",
                  isHighlighted(card.id) && "ring-2 ring-portfolio",
                )}
              >
                {card.color ? (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: card.color }} aria-hidden="true" />
                ) : (
                  <WalletCards className="size-4" aria-hidden="true" />
                )}
                {card.name}
                {!card.is_active ? <span className="text-xs text-muted-foreground">(inativo)</span> : null}
              </button>
            ))}
            <Button type="button" variant="ghost" size="icon" aria-label="Editar cartão" onClick={() => openForm(selectedCard)}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            {/* Novo cartão só no desktop — no mobile o FAB da BottomNav assume (F12). */}
            <Button type="button" className="hidden sm:inline-flex" onClick={() => openForm(null)}>
              <Plus aria-hidden="true" />
              Novo cartão
            </Button>
          </div>

          <MonthPicker value={effectiveMonth} onValueChange={setMonth} />

          {/* KPIs da fatura */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Previsto" cents={summary?.previstoCents ?? 0} />
            <KpiCard label="Pago" cents={summary?.pagoCents ?? 0} />
            <KpiCard label="Saldo aberto" cents={summary?.saldoCents ?? 0} tone={summary && summary.saldoCents > 0 ? "negative" : "positive"} />
          </div>

          {selectedCard ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <InvoiceStatusBadge
                status={invoiceStatus(effectiveMonth, selectedCard.due_day, summary?.saldoCents ?? 0)}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaymentMode("refund")}>
                  <Undo2 aria-hidden="true" />
                  Estorno
                </Button>
                <Button onClick={() => setPaymentMode("payment")} disabled={(summary?.saldoCents ?? 0) <= 0}>
                  Registrar pagamento
                </Button>
              </div>
            </div>
          ) : null}

          {/* Despesas da competência */}
          <section aria-label={`Despesas da fatura de ${monthLabel(effectiveMonth)}`} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Despesas · {monthLabel(effectiveMonth)}
            </h2>
            {competenceExpenses.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6" aria-hidden="true" />}
                title="Sem despesas nesta fatura"
                description="As compras no crédito aparecem aqui pela competência."
              />
            ) : (
              competenceExpenses.map((expense) => (
                <TransactionRow
                  key={expense.id}
                  title={expense.description || "Despesa sem descrição"}
                  date={expense.date}
                  subtitle={expense.report_weight < 1 ? `${Math.round(expense.report_weight * 100)}% no relatório` : undefined}
                  amountCents={Math.round(expense.value * expense.report_weight * 100)}
                  kind="expense"
                />
              ))
            )}
          </section>

          {/* Pagamentos e estornos */}
          <section aria-label="Pagamentos e estornos" className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos e estornos</h2>
            {competencePayments.length === 0 ? (
              <EmptyState
                icon={<WalletCards className="size-6" aria-hidden="true" />}
                title="Nenhum pagamento"
                description="Registre o pagamento da fatura quando efetuar."
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
                  />
                ) : (
                  <TransactionRow
                    key={payment.id}
                    title={payment.note || "Pagamento de fatura"}
                    date={payment.date}
                    amountCents={Math.round(payment.amount * 100)}
                    kind="expense"
                  />
                ),
              )
            )}
          </section>
        </>
      )}

      {/* Deep-link do FAB sempre abre em modo criação (ignora edição pendente). */}
      <CardFormDialog card={fromUrl ? null : editingCard} open={formOpen} onOpenChange={setFormOpen} />

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
    </div>
  );
}
