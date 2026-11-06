import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
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
 *
 * Em conformidade estrita com:
 *  - AGENTS.md §4: Design tokens, MoneyText, zero emojis, ícones sem caixas decorativas em títulos.
 *  - FINANCIAL_MATH_SPEC.md: Moeda em centavos inteiros.
 */
export function HouseholdCombinedFlowCard({
  totalIncomeCents,
  totalSpentCents,
  className,
}: HouseholdCombinedFlowCardProps) {
  const netCents = totalIncomeCents - totalSpentCents;
  const isPositiveNet = netCents >= 0;

  // Taxa de Poupança Familiar (0 a 100%)
  const savingsRate =
    totalIncomeCents > 0
      ? Math.max(0, Math.round((netCents / totalIncomeCents) * 100))
      : 0;

  // Percentual da renda já consumido
  const spentRate =
    totalIncomeCents > 0
      ? Math.min(100, Math.round((totalSpentCents / totalIncomeCents) * 100))
      : 0;

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Fluxo Conjunto do Lar</span>
        </CardTitle>

        <div>
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
        {/* Grid de métricas financeiras mobile-first */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Receitas da Casa</span>
            </span>
            <div className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              <MoneyText cents={totalIncomeCents} />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-subtle/50 border border-border/50 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-negative-strong shrink-0" aria-hidden="true" />
              <span>Gastos Realizados</span>
            </span>
            <div className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              <MoneyText cents={totalSpentCents} />
            </div>
          </div>
        </div>

        {/* Saldo Líquido do Mês (Sobra / Aporte Coletivo) */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground block">
              {isPositiveNet ? "Sobra para Aporte / Reserva" : "Déficit Líquido do Mês"}
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {isPositiveNet
                ? "Disponível para alimentar a reserva ou metas de investimento da família."
                : "Os gastos da casa superaram as receitas registradas neste mês."}
            </span>
          </div>

          <div
            className={cn(
              "text-base sm:text-lg font-bold tracking-tight shrink-0",
              isPositiveNet ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            <MoneyText cents={netCents} />
          </div>
        </div>

        {/* Barra de Consumo da Renda */}
        {totalIncomeCents > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Consumo da renda da família</span>
              <span className="font-semibold text-foreground">{spentRate}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden border border-border/40">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  spentRate <= 70
                    ? "bg-positive"
                    : spentRate <= 90
                      ? "bg-warning"
                      : "bg-critical",
                )}
                style={{ width: `${Math.min(100, spentRate)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
