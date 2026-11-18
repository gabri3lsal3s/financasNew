import { Trash2, WalletCards } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { TransactionRow } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import type { CardPayment } from "@/types";

export interface CardInvoicePaymentsFeedProps {
  competencePayments: CardPayment[];
  onDeletePayment: (payment: CardPayment) => void;
}

export function CardInvoicePaymentsFeed({
  competencePayments,
  onDeletePayment,
}: CardInvoicePaymentsFeedProps) {
  return (
    <section aria-label="Pagamentos e estornos" className="flex flex-col gap-3.5 sm:gap-4">
      <div className="flex items-center justify-between pb-0.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pagamentos e estornos
        </h2>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
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
          {competencePayments.map((payment) => {
            const isRefund = payment.amount < 0;
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
        </div>
      )}
    </section>
  );
}
