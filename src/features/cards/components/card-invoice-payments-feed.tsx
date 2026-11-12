import { Trash2, WalletCards } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { TransactionRow } from "@/components/modules";
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
                    onClick={() => onDeletePayment(payment)}
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
                    onClick={() => onDeletePayment(payment)}
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
  );
}
