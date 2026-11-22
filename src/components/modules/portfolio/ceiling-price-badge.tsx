import { Check, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCentsAsCurrency } from "@/services/masks";
import { numberToCents } from "@/domain/money";
import {
  calculateMarginOfSafety,
  getValuationStatus,
} from "@/domain/portfolio/ceiling-valuation";

export interface CeilingPriceBadgeProps {
  ceilingPrice?: number | null;
  currentPrice?: number | null;
  size?: "xs" | "sm";
  className?: string;
  /** Se true, anexa o valor do Preço Teto ao rótulo (ex: "Margem: +15,2% vs Teto (R$ 45,00)") */
  showCeilingValue?: boolean;
  currency?: "BRL" | "USD";
}

/**
 * Badge canônico de Preço Teto & Margem de Segurança (DRY §4 · Design System §13/§14).
 * Substitui definitivamente as comparações de oportunidade com Preço Médio (PM).
 */
export function CeilingPriceBadge({
  ceilingPrice,
  currentPrice,
  size = "xs",
  className,
  showCeilingValue = false,
  currency = "BRL",
}: CeilingPriceBadgeProps) {
  if (
    ceilingPrice == null ||
    ceilingPrice <= 0 ||
    currentPrice == null ||
    currentPrice <= 0
  ) {
    return null;
  }

  const { marginOfSafetyPct, diffVsCeilingPct } = calculateMarginOfSafety(
    ceilingPrice,
    currentPrice,
  );
  if (marginOfSafetyPct === null) return null;

  const status = getValuationStatus(marginOfSafetyPct, diffVsCeilingPct);
  const formattedCeiling = formatCentsAsCurrency(numberToCents(ceilingPrice), currency);

  return (
    <Badge
      variant={status.badgeVariant}
      size={size}
      className={cn("gap-1 shrink-0 inline-flex items-center font-medium", className)}
    >
      {status.zone === "opportunity" ? (
        <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
      ) : status.zone === "stretched" ? (
        <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span>
        {showCeilingValue
          ? status.zone === "opportunity"
            ? `Margem de ${Math.abs(marginOfSafetyPct).toFixed(1)}% vs Teto (${formattedCeiling})`
            : status.zone === "stretched"
              ? `+${Math.abs(diffVsCeilingPct ?? 0).toFixed(1)}% acima do Teto (${formattedCeiling})`
              : `Preço Justo vs Teto (${formattedCeiling})`
          : status.label}
      </span>
    </Badge>
  );
}
