import { Trash2, Undo2, WalletCards } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { TransactionRow } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { formatDateBR, monthLabel } from "@/lib/date";
import type { CardBillRollover, CardPayment } from "@/types";

export interface CardInvoicePaymentsFeedProps {
  competencePayments: CardPayment[];
  competenceRollovers?: CardBillRollover[];
  effectiveMonth?: string;
  onDeletePayment: (payment: CardPayment) => void;
  onDeleteRollover?: (rollover: CardBillRollover) => void;
}

export function CardInvoicePaymentsFeed({
  competencePayments,
  competenceRollovers = [],
  effectiveMonth,
  onDeletePayment,
  onDeleteRollover,
}: CardInvoicePaymentsFeedProps) {
  const totalCount = competencePayments.length + competenceRollovers.length;

  return (
    <section aria-label="Pagamentos e estornos" className="flex flex-col gap-3.5 sm:gap-4">
      <div className="flex items-center justify-between pb-0.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pagamentos, estornos e ajustes
        </h2>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {totalCount} {totalCount === 1 ? "registro" : "registros"}
        </span>
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={<WalletCards className="size-6" aria-hidden="true" />}
          title="Nenhum pagamento"
          description="Registre o pagamento ou estorno desta fatura quando for efetuado."
          className="py-8 sm:py-10 px-4"
        />
      ) : (
        <div className="flex flex-col gap-2 sm:gap-2.5">
          {competencePayments.map((payment) => {
            const isRefund = payment.is_refund || payment.amount < 0;
            const label = payment.note || (isRefund ? "Estorno" : "Pagamento de fatura");
            const deleteLabel = `${isRefund ? "Excluir estorno" : "Excluir pagamento"} ${payment.note || ""}`.trim();

            return (
              <TransactionRow
                key={payment.id}
                title={label}
                date={formatDateBR(payment.date)}
                amountCents={numberToCents(Math.abs(payment.amount))}
                kind={isRefund ? "income" : "neutral"}
                badges={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    sensoryIntent="selection"
                    onClick={() => onDeletePayment(payment)}
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    className="size-8 sm:size-7 text-muted-foreground hover:text-critical-strong max-sm:after:absolute max-sm:after:-inset-2"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                }
              />
            );
          })}

          {competenceRollovers.map((rollover) => {
            const isOutgoing = rollover.from_competence_month === effectiveMonth;
            const isRefinance = rollover.kind === "refinance";
            const title = isOutgoing
              ? isRefinance
                ? `Parcelado para ${monthLabel(rollover.to_competence_month)}`
                : `Saldo rolado para ${monthLabel(rollover.to_competence_month)}`
              : isRefinance
                ? `Parcela vinda de ${monthLabel(rollover.from_competence_month)}`
                : `Saldo rolado de ${monthLabel(rollover.from_competence_month)}`;
            const undoLabel = isRefinance ? "Desfazer parcelamento" : "Desfazer rolagem";

            return (
              <TransactionRow
                key={rollover.id}
                title={title}
                subtitle={rollover.note ?? (isRefinance ? "Parcelamento de fatura" : "Rotativo")}
                date={formatDateBR(rollover.created_at.slice(0, 10))}
                amountCents={numberToCents(rollover.principal_amount)}
                kind={isOutgoing ? "income" : "expense"}
                badges={
                  onDeleteRollover ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      sensoryIntent="selection"
                      onClick={() => onDeleteRollover(rollover)}
                      aria-label={undoLabel}
                      title={undoLabel}
                      className="size-8 sm:size-7 text-muted-foreground hover:text-critical-strong max-sm:after:absolute max-sm:after:-inset-2"
                    >
                      <Undo2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
