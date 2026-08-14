import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/domain/cards";

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

const statusVariant: Record<InvoiceStatus, "positive" | "default" | "warning" | "critical"> = {
  closed: "positive",
  open: "default",
  near_due: "warning",
  overdue: "critical",
};

/** Badge do status da fatura de cartão (ESSPECIFICAÇÃO §3.3.3). */
export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return <Badge variant={statusVariant[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
