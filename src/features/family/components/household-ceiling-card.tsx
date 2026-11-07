import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface HouseholdCeilingCardProps {
  monthlyCeilingCents: number;
  totalSpentCents: number;
  remainingCents: number;
  spentPercentage: number;
  totalIncomeCents?: number;
  className?: string;
}

/**
 * Card de Acompanhamento do Teto Orçamentário da Família.
 * Exibe o teto mensal configurado, total realizado da casa, saldo restante e barra de progresso adaptativa.
 */
export function HouseholdCeilingCard({
  monthlyCeilingCents,
  totalSpentCents,
  remainingCents,
  spentPercentage,
  totalIncomeCents,
  className,
}: HouseholdCeilingCardProps) {
  const hasCeiling = monthlyCeilingCents > 0;
  const isOverCeiling = hasCeiling && totalSpentCents > monthlyCeilingCents;
  const clampedPercent = hasCeiling ? Math.min(100, Math.max(0, spentPercentage)) : 0;

  const barColor = isOverCeiling
    ? "bg-critical"
    : spentPercentage >= 85
      ? "bg-warning"
      : "bg-primary";

  return (
    <Card
      data-tour="family-ceiling-card"
      className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}
    >
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Target className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Teto da Casa</span>
        </CardTitle>

        <div>
          {!hasCeiling ? (
            <Badge variant="muted" size="sm">
              Sem teto definido
            </Badge>
          ) : isOverCeiling ? (
            <Badge variant="critical" size="sm">
              Teto excedido
            </Badge>
          ) : (
            <Badge variant={spentPercentage >= 85 ? "warning" : "positive"} size="sm">
              {Math.round(spentPercentage)}% consumido
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total gasto pela casa</p>
          <div className="mt-1 flex items-baseline gap-2">
            <MoneyText
              cents={totalSpentCents}
              tone="default"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums whitespace-nowrap"
            />
          </div>
        </div>

        {hasCeiling ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isOverCeiling ? (
                  <span className="text-critical font-medium">
                    Excedido em <MoneyText cents={Math.abs(remainingCents)} tone="negative" className="font-semibold" />
                  </span>
                ) : (
                  <span>
                    Restam <MoneyText cents={remainingCents} tone="positive" className="font-semibold" />
                  </span>
                )}
              </span>
              <span>
                Teto: <MoneyText cents={monthlyCeilingCents} className="font-medium text-foreground" />
              </span>
            </div>

            <div
              className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60"
              role="progressbar"
              aria-valuenow={Math.round(spentPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do teto familiar"
            >
              <div
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                style={{ width: `${clampedPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Defina um teto mensal nas configurações para monitorar o limite de consumo familiar.
          </p>
        )}

        {typeof totalIncomeCents === "number" && totalIncomeCents > 0 && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Receita conjunta informada</span>
            <MoneyText cents={totalIncomeCents} tone="positive" className="font-medium" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
