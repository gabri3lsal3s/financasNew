import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface HouseholdCombinedFlowCardProps {
  totalIncomeCents: number;
  totalSpentCents: number;
  className?: string;
}

/**
 * Card de Fluxo de Caixa Combinado da Família (Caixa Único).
 * Exibe a receita global do lar, despesas conjuntas, sobra líquida e taxa de poupança familiar,
 * sem comparações individuais ou acusações de quem contribuiu mais.
 */
export function HouseholdCombinedFlowCard({
  totalIncomeCents,
  totalSpentCents,
  className,
}: HouseholdCombinedFlowCardProps) {
  const netCents = totalIncomeCents - totalSpentCents;
  const isPositiveNet = netCents >= 0;

  const savingsRate =
    totalIncomeCents > 0
      ? Math.max(0, Math.round((netCents / totalIncomeCents) * 100))
      : 0;

  const spentRate =
    totalIncomeCents > 0
      ? Math.min(100, Math.round((totalSpentCents / totalIncomeCents) * 100))
      : 0;

  const progressTone =
    spentRate <= 70 ? "positive" : spentRate <= 90 ? "warning" : "critical";

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2.5 pb-3">
        <CardTitle className="flex items-center gap-2 min-w-0 text-sm font-semibold text-foreground">
          <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sm:hidden truncate">Fluxo do Lar</span>
          <span className="hidden sm:inline truncate">Fluxo Conjunto do Lar</span>
        </CardTitle>

        <div className="shrink-0">
          {totalIncomeCents > 0 && isPositiveNet ? (
            <Badge variant="positive" size="sm">
              Taxa de poupança: {savingsRate}%
            </Badge>
          ) : totalIncomeCents > 0 && !isPositiveNet ? (
            <Badge variant="critical" size="sm">
              Déficit no mês
            </Badge>
          ) : (
            <Badge variant="muted" size="sm">
              Caixa unificado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Grid de métricas financeiras mobile-first (sem caixas cinzas aninhadas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 rounded-xl border border-border/80 bg-surface space-y-1 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Receitas da Casa</span>
            </span>
            <div>
              <MoneyText
                cents={totalIncomeCents}
                tone="positive"
                className="text-base sm:text-lg font-bold tracking-tight"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-surface space-y-1 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-negative-strong shrink-0" aria-hidden="true" />
              <span>Gastos Realizados</span>
            </span>
            <div>
              <MoneyText
                cents={totalSpentCents}
                tone="default"
                className="text-base sm:text-lg font-bold tracking-tight"
              />
            </div>
          </div>
        </div>

        {/* Saldo Líquido do Mês (Sobra / Aporte Coletivo) */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground block">
              {isPositiveNet ? "Sobra para Aporte / Reserva" : "Déficit Líquido do Mês"}
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {isPositiveNet
                ? "Disponível para alimentar a reserva ou metas de investimento da família."
                : "Os gastos da casa superaram as receitas registradas neste mês."}
            </span>
          </div>

          <div className="shrink-0">
            <MoneyText
              cents={netCents}
              tone={isPositiveNet ? "positive" : "negative"}
              className="text-base sm:text-lg font-bold tracking-tight"
            />
          </div>
        </div>

        {/* Barra de Consumo da Renda */}
        {totalIncomeCents > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Consumo da renda da família</span>
              <span className="font-semibold text-foreground tabular-nums">{spentRate}%</span>
            </div>
            <Progress
              value={spentRate}
              tone={progressTone}
              size="md"
              aria-label="Consumo da renda da família"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
