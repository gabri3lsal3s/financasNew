import { Badge } from "@/components/ui/badge";

export interface InstallmentBadgeProps {
  /** Parcela atual (1-based). */
  current: number;
  total: number;
}

/** Badge "3/12" para despesas parceladas. */
export function InstallmentBadge({ current, total }: InstallmentBadgeProps) {
  return (
    <Badge variant="muted">
      {current}/{total}
    </Badge>
  );
}
