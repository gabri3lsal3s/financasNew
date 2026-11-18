import { Badge } from "@/components/ui/badge";
import { DEBT_STATUS_LABELS, type DebtStatus } from "@/domain/debts";

export interface DebtStatusBadgeProps {
  status: DebtStatus;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const statusVariant: Record<DebtStatus, "positive" | "critical" | "warning" | "muted"> = {
  paid: "positive",
  overdue: "critical",
  due_today: "warning",
  due_soon: "warning",
  pending: "muted",
};

/** Badge do status derivado de dívida (ESPECIFICAÇÃO §3.4). */
export function DebtStatusBadge({ status, size = "sm", className }: DebtStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} size={size} className={className}>
      {DEBT_STATUS_LABELS[status]}
    </Badge>
  );
}
