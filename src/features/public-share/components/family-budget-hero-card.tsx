import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MoneyText,
  Progress,
} from "@/components/ui";
import type { SharedFamilyBudgetResult } from "@/types";

export interface FamilyBudgetHeroCardProps {
  budgetData: SharedFamilyBudgetResult;
}

/**
 * Cartão principal de consumo mensal e progresso do teto no Orçamento Familiar público.
 */
export function FamilyBudgetHeroCard({ budgetData }: FamilyBudgetHeroCardProps) {
  const isOverCeiling = budgetData.remaining_cents < 0;
  const isNearCeiling = budgetData.spent_percentage >= 85 && !isOverCeiling;
  const hasCeiling = budgetData.monthly_ceiling_cents > 0;

  const progressTone = isOverCeiling ? "critical" : isNearCeiling ? "warning" : "positive";

  const statusBadge = isOverCeiling ? (
    <Badge variant="critical" size="xs">
      Teto Excedido ({budgetData.spent_percentage}%)
    </Badge>
  ) : isNearCeiling ? (
    <Badge variant="warning" size="xs">
      Atenção ({budgetData.spent_percentage}%)
    </Badge>
  ) : hasCeiling ? (
    <Badge variant="positive" size="xs">
      Dentro do Teto ({budgetData.spent_percentage}%)
    </Badge>
  ) : (
    <Badge variant="muted" size="xs">
      Sem Teto Definido
    </Badge>
  );

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {budgetData.owner_name
                ? `Orçamento Familiar · ${budgetData.owner_name}`
                : "Orçamento da Casa"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhamento transparente das contas e despesas compartilhadas do lar
            </p>
          </div>
          <div className="shrink-0">{statusBadge}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Consumo do Mês</span>
            <span className="font-semibold tabular-nums text-foreground">
              {budgetData.spent_percentage}% consumido
            </span>
          </div>
          <Progress
            value={budgetData.spent_percentage}
            tone={progressTone}
            size="lg"
            aria-label={`Consumo do orçamento: ${budgetData.spent_percentage}%`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              {hasCeiling ? (
                <>
                  <span>Teto:</span>
                  <MoneyText
                    cents={budgetData.monthly_ceiling_cents}
                    variant="caption"
                    tone="default"
                  />
                </>
              ) : (
                "Sem teto estipulado"
              )}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span>Saldo disponível:</span>
              <MoneyText
                cents={budgetData.remaining_cents}
                variant="caption"
                tone={budgetData.remaining_cents >= 0 ? "positive" : "negative"}
              />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
