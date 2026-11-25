import { ExternalLink, FileText, Receipt } from "lucide-react";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MoneyText,
  SkeletonList,
} from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { useInvoices } from "@/state/queries/use-invoices";
import type { SubscriptionStatus } from "@/types";

export interface InvoiceHistoryCardProps {
  subscription: SubscriptionStatus;
}

function formatAsaasInvoiceStatus(status: string): {
  label: string;
  variant: "positive" | "warning" | "critical" | "muted";
} {
  const normalized = (status || "").toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(normalized)) {
    return { label: "Pago", variant: "positive" };
  }
  if (normalized === "PENDING") {
    return { label: "Pendente", variant: "warning" };
  }
  if (normalized === "OVERDUE") {
    return { label: "Vencida", variant: "critical" };
  }
  if (normalized === "AWAITING_RISK_ANALYSIS") {
    return { label: "Em análise", variant: "warning" };
  }
  if (normalized === "REFUNDED") {
    return { label: "Estornado", variant: "critical" };
  }
  if (["REFUND_REQUESTED", "REFUND_IN_PROGRESS"].includes(normalized)) {
    return { label: "Estorno em andamento", variant: "warning" };
  }
  if (
    [
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "AWAITING_CHARGEBACK_REVERSAL",
    ].includes(normalized)
  ) {
    return { label: "Contestação", variant: "critical" };
  }
  return { label: "Em processamento", variant: "muted" };
}

function formatAsaasBillingType(billingType: string): string {
  const normalized = (billingType || "").toUpperCase();
  if (normalized === "PIX") return "Pix";
  if (normalized === "CREDIT_CARD") return "Cartão de Crédito";
  if (normalized === "BOLETO") return "Boleto";
  return "Cobrança";
}

export function InvoiceHistoryCard({ subscription }: InvoiceHistoryCardProps) {
  const { data: invoices, isLoading } = useInvoices(subscription.isPro);
  const isPastDue = subscription.status === "past_due";

  const planName =
    subscription.plan === "annual" ? "Plano Pro Anual (12 meses)" : "Plano Pro Mensal";
  const planPriceCents = subscription.plan === "annual" ? 14388 : 1999;
  const planSuffix = subscription.plan === "annual" ? "/ano" : "/mês";

  const renewDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Faturamento &amp; Histórico de Faturas</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subscription.isPro ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-raised/60 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/80 pb-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground">{planName}</span>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{isPastDue ? "Pendência de cobrança" : "Cobrança ativa"}</span>
                    <span aria-hidden="true">|</span>
                    <span>Gateway Asaas</span>
                    {renewDate ? (
                      <>
                        <span aria-hidden="true">|</span>
                        <span>Próxima renovação: {renewDate}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPastDue ? (
                    <Badge variant="critical" size="xs">
                      Pagamento pendente
                    </Badge>
                  ) : subscription.cancelAtPeriodEnd ? (
                    <Badge variant="warning" size="xs">
                      Cancelamento agendado
                    </Badge>
                  ) : (
                    <Badge variant="positive" size="xs">
                      Em dia
                    </Badge>
                  )}
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                    <MoneyText cents={planPriceCents} variant="caption" tone="default" />
                    <span>{planSuffix}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px]">
                  Os recibos de pagamento e notas fiscais eletrônicas (NFS-e) são emitidos automaticamente pelo gateway Asaas a cada renovação.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Faturas Recentes</h4>
              {isLoading ? (
                <div role="status" aria-busy="true" className="p-1">
                  <SkeletonList rows={2} />
                  <span className="sr-only">Carregando faturas...</span>
                </div>
              ) : invoices && invoices.length > 0 ? (
                <div className="divide-y divide-border/80 rounded-xl border border-border/80 overflow-hidden">
                  {invoices.map((inv) => {
                    const rawReceiptUrl = inv.transactionReceiptUrl || inv.invoiceUrl;
                    const receiptUrl =
                      rawReceiptUrl && /^https:\/\//i.test(rawReceiptUrl.trim())
                        ? rawReceiptUrl.trim()
                        : null;
                    const dateFormatted =
                      inv.paymentDate || inv.dateCreated
                        ? new Date(inv.paymentDate || inv.dateCreated).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : inv.dueDate;

                    const statusInfo = formatAsaasInvoiceStatus(inv.status);

                    return (
                      <div
                        key={inv.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-surface hover:bg-surface-hover/50 transition-colors text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{dateFormatted}</span>
                            <Badge variant={statusInfo.variant} size="xs">
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            {formatAsaasBillingType(inv.billingType)}
                            {inv.description ? ` — ${inv.description}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <MoneyText
                            cents={numberToCents(inv.value)}
                            variant="caption"
                            tone="default"
                            className="font-semibold"
                          />
                          {receiptUrl ? (
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir recibo em nova aba"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "gap-1.5",
                              )}
                            >
                              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                              <span>Recibo</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-3 rounded-xl bg-surface-raised/60">
                  Nenhuma fatura anterior registrada no Asaas.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center space-y-2">
            <Receipt className="size-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Nenhuma fatura emitida</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Ao assinar o Plano Pro, as informações de cobrança, recibos e notas fiscais ficarão registradas para sua conta.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
