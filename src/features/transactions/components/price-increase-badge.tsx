import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
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
  const formattedPercent = deltaPercent.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(deltaPercent) ? 0 : 1,
    maximumFractionDigits: 1,
  });

  const title = annualizedImpactCents
    ? `Reajuste de +${formattedPercent}% (+${formatCentsAsBRL(annualizedImpactCents)}/ano). Toque para detalhes.`
    : `Reajuste de +${formattedPercent}% detectado.`;

  const badge = (
    <Badge
      variant="warning"
      size="xs"
      data-tour="subscriptions-audit-badge"
      className={cn(
        "gap-1 font-semibold tabular-nums shrink-0 transition-colors duration-150",
        onClick && "cursor-pointer hover:bg-warning/25",
        className,
      )}
      title={onClick ? undefined : title}
    >
      <TrendingUp className="size-2.5" aria-hidden="true" />
      <span>+{formattedPercent}%</span>
    </Badge>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerSensory("selection");
          onClick();
        }}
        title={title}
        aria-label={title}
        className="inline-flex shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {badge}
      </button>
    );
  }

  return badge;
}
