import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
import { cn } from "@/lib/utils";

export interface PriceIncreaseBadgeProps {
  deltaPercent: number;
  annualizedImpactCents?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Badge visual discreto indicando aumento/reajuste percentual em cobrança recorrente (§Plano 12).
 */
export function PriceIncreaseBadge({
  deltaPercent,
  annualizedImpactCents,
  onClick,
  className,
}: PriceIncreaseBadgeProps) {
  const title = annualizedImpactCents
    ? `Reajuste de +${deltaPercent}% (+${formatCentsAsBRL(annualizedImpactCents)}/ano). Toque para detalhes.`
    : `Reajuste de +${deltaPercent}% detectado.`;

  return (
    <Badge
      variant="warning"
      size="xs"
      data-tour="subscriptions-audit-badge"
      className={cn(
        "gap-1 font-semibold tabular-nums shrink-0 cursor-pointer hover:bg-warning/25 transition-colors",
        className,
      )}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      title={title}
    >
      <TrendingUp className="size-2.5" aria-hidden="true" />
      <span>+{deltaPercent}%</span>
    </Badge>
  );
}
