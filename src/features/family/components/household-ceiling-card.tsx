import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
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

  const progressTone = isOverCeiling
    ? "critical"
    : spentPercentage >= 85
      ? "warning"
      : "positive";

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
              variant="hero"
              className="text-2xl sm:text-3xl font-bold tracking-tight"
            />
          </div>
        </div>

        {hasCeiling ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {isOverCeiling ? (
                  <span className="text-critical-strong font-medium">
                    Excedido em <MoneyText cents={Math.abs(remainingCents)} tone="negative" className="font-semibold" />
                  </span>
                ) : (
                  <span>
                    Restam <MoneyText cents={remainingCents} tone="positive" className="font-semibold" />
                  </span>
                )}
              </span>
              <span>
                Teto: <MoneyText cents={monthlyCeilingCents} tone="default" className="font-medium text-foreground" />
              </span>
            </div>

            <Progress
              value={spentPercentage}
              tone={progressTone}
              size="md"
              aria-label="Progresso do teto familiar"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Defina um teto mensal nas configurações para monitorar o limite de consumo familiar.
          </p>
        )}

        {typeof totalIncomeCents === "number" && totalIncomeCents > 0 && (
          <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Receita conjunta informada</span>
            <MoneyText cents={totalIncomeCents} tone="positive" className="font-medium" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
