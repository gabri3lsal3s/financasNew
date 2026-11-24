import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/domain/cards";

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const statusVariant: Record<
  InvoiceStatus,
  "positive" | "default" | "muted" | "warning" | "critical"
> = {
  rolled_over: "muted",
  empty: "muted",
  paid: "positive",
  overdue: "critical",
  near_due: "warning",
  closed: "default",
  open: "default",
};

/** Badge do status da fatura de cartão (ESPECIFICAÇÃO §3.3.3). */
export function InvoiceStatusBadge({ status, size = "sm", className }: InvoiceStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} size={size} className={className}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
