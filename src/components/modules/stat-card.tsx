import type { ElementType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import type { AssetCurrency } from "@/types";

export interface StatCardTrend {
  value: number; // Ex: +12.5% ou -3.2%
  label?: string;
  isPositiveGood?: boolean; // Default: true (positivo = verde)
}

export interface StatCardProps {
  title: string;
  value: number | string;
  isCurrency?: boolean; // Se true, valor numérico é interpretado como centavos
  currency?: AssetCurrency;
  animated?: boolean;
  icon?: ElementType;
  iconClassName?: string;
  trend?: StatCardTrend;
  description?: string;
  variant?: "default" | "positive" | "warning" | "critical" | "info";
  className?: string;
  valueClassName?: string;
  action?: ReactNode;
}

const VARIANT_BORDER_MAP: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border-border/70",
  positive: "border-positive/30 bg-positive/5",
  warning: "border-warning/30 bg-warning/5",
  critical: "border-critical/30 bg-critical/5",
  info: "border-info/30 bg-info/5",
};

const VARIANT_ICON_COLOR_MAP: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "text-muted-foreground",
  positive: "text-positive-strong",
  warning: "text-warning",
  critical: "text-critical-strong",
  info: "text-primary",
};

/**
 * Módulo universal de métricas (F56).
 * 
 * Padroniza KPIs e estatísticas com:
 * - Auto-fit dinâmico de tipografia para valores grandes (>= 7 dígitos);
 * - Animações suaves com NumberTicker e MoneyText;
 * - Suporte a badges de tendência, ícones temáticos e variantes semânticas.
 */
export function StatCard({
  title,
  value,
  isCurrency = true,
  currency = "BRL",
  animated = true,
  icon: Icon,
  iconClassName,
  trend,
  description,
  variant = "default",
  className,
  valueClassName,
  action,
}: StatCardProps) {
  const isLargeNumber =
    typeof value === "number" && (isCurrency ? value >= 10000000 : value >= 100000);

  const valueSizeClass = isLargeNumber
    ? "text-xl sm:text-2xl font-bold tracking-tight"
    : "text-2xl sm:text-3xl font-bold tracking-tight";

  return (
    <Card className={cn("relative overflow-hidden transition-all duration-200", VARIANT_BORDER_MAP[variant], className)}>
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate" title={title}>
            {title}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {action}
            {Icon && (
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg bg-surface-hover/80",
                  VARIANT_ICON_COLOR_MAP[variant],
                  iconClassName,
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <div className={cn("truncate", valueSizeClass, valueClassName)}>
            {typeof value === "number" ? (
              isCurrency ? (
                <MoneyText
                  cents={value}
                  currency={currency}
                  animated={animated}
                />

              ) : animated ? (
                <NumberTicker value={value} />
              ) : (
                value
              )
            ) : (
              value
            )}
          </div>

          {trend && (
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[11px]",
                  (trend.isPositiveGood ?? true)
                    ? trend.value >= 0
                      ? "text-positive-strong bg-positive/10"
                      : "text-critical-strong bg-critical/10"
                    : trend.value <= 0
                    ? "text-positive-strong bg-positive/10"
                    : "text-critical-strong bg-critical/10",
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value.toFixed(1)}%
              </span>
              {trend.label && <span className="text-muted-foreground truncate">{trend.label}</span>}
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-1" title={description}>
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
