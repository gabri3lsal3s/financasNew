import { Badge } from "@/components/ui/badge";
import { DEBT_STATUS_LABELS, type DebtStatus } from "@/domain/debts";

export interface DebtStatusBadgeProps {
  status: DebtStatus;
}

const statusVariant: Record<DebtStatus, "positive" | "critical" | "warning" | "muted"> = {
  paid: "positive",
  overdue: "critical",
  due_today: "warning",
  due_soon: "warning",
  pending: "muted",
};

/** Badge do status derivado de dívida (ESSPECIFICAÇÃO §3.4). */
export function DebtStatusBadge({ status }: DebtStatusBadgeProps) {
  return <Badge variant={statusVariant[status]}>{DEBT_STATUS_LABELS[status]}</Badge>;
}
