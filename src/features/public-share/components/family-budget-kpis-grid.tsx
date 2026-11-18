import { PiggyBank, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SharedFamilyBudgetResult } from "@/types";

export interface FamilyBudgetKpisGridProps {
  budgetData: SharedFamilyBudgetResult;
}

/**
 * Grade de indicadores-chave (Teto, Total Gasto, Saldo Restante) do Orçamento Familiar público.
 */
export function FamilyBudgetKpisGrid({ budgetData }: FamilyBudgetKpisGridProps) {
  const isPositiveRemaining = budgetData.remaining_cents >= 0;

  return (
    <section aria-label="Indicadores do Orçamento Familiar">
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3.5">
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Teto do Mês</span>
              <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
              <MoneyText cents={budgetData.monthly_ceiling_cents} variant="hero" tone="default" />
            </div>
            <p className="text-[11px] text-muted-foreground">Limite mensal planejado</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Total Gasto</span>
              <TrendingDown className="size-4 text-negative-strong" aria-hidden="true" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
              <MoneyText cents={budgetData.total_spent_cents} variant="hero" tone="negative" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {budgetData.expenses.length === 1
                ? "1 despesa familiar registrada"
                : `${budgetData.expenses.length} despesas familiares`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Saldo Restante</span>
              <PiggyBank
                className={cn(
                  "size-4",
                  isPositiveRemaining ? "text-positive-strong" : "text-critical-strong",
                )}
                aria-hidden="true"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
              <MoneyText
                cents={budgetData.remaining_cents}
                variant="hero"
                tone={isPositiveRemaining ? "positive" : "negative"}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isPositiveRemaining
                ? "Disponível até o final do mês"
                : "Excedente acima do planejado"}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
