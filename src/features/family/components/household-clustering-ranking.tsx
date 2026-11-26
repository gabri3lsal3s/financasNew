import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { clusterFamilyExpenses } from "@/domain/family";
import { cn } from "@/lib/utils";
import type { FamilyConsolidationExpense } from "@/types";

export interface HouseholdClusteringRankingProps {
  expenses: FamilyConsolidationExpense[];
  className?: string;
}

/**
 * Ranking de Consumo Familiar Agrupado por Categorias e Clusters Semânticos.
 * Consolida as despesas da casa usando o motor puro `clusterFamilyExpenses`,
 * exibindo percentuais de representatividade e fatias de quem pagou cada categoria.
 * Estrutura limpa em divide-y, padronizada com o restante do aplicativo (sem caixas cinzas aninhadas).
 */
export function HouseholdClusteringRanking({
  expenses,
  className,
}: HouseholdClusteringRankingProps) {
  const clusters = useMemo(() => {
    return clusterFamilyExpenses(expenses);
  }, [expenses]);

  return (
    <Card className={cn("border-border/80 bg-surface shadow-xs rounded-2xl", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2.5 pb-3">
        <CardTitle className="flex items-center gap-2 min-w-0 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sm:hidden truncate">Ranking por Categoria</span>
          <span className="hidden sm:inline truncate">Ranking de Consumo por Categoria</span>
        </CardTitle>

        <div className="shrink-0">
          {clusters.length > 0 ? (
            <Badge variant="muted" size="sm">
              {clusters.length} {clusters.length === 1 ? "categoria" : "categorias"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {clusters.length === 0 ? (
          <EmptyState
            title="Nenhuma despesa familiar registrada"
            description="Os gastos da casa aparecerão organizados aqui por categoria assim que forem lançados."
            tone="default"
            className="py-8"
            action={
              <a href="/transacoes" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Lançar despesa
              </a>
            }
          />
        ) : (
          <div className="divide-y divide-border/80">
            {clusters.map((cluster) => {
              const clampedPercent = Math.min(100, Math.max(0, cluster.percentage));

              return (
                <div
                  key={cluster.clusterId}
                  className="py-3.5 first:pt-0 last:pb-0 space-y-2.5 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIcon
                        icon={cluster.icon}
                        color={cluster.color}
                        className="size-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground line-clamp-1 break-words">
                          {cluster.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-2">
                          {cluster.expenses_count}{" "}
                          {cluster.expenses_count === 1 ? "lançamento" : "lançamentos"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <MoneyText
                        cents={cluster.total_cents}
                        tone="default"
                        className="text-xs sm:text-sm font-bold"
                      />
                      <span className="text-[11px] text-muted-foreground font-medium tabular-nums ml-2">
                        {cluster.display_percentage}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Proporcional da Categoria */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clampedPercent}%`,
                        backgroundColor: cluster.color || "hsl(var(--primary))",
                      }}
                    />
                  </div>

                  {/* Contribuição por participante na categoria */}
                  {cluster.member_contributions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {cluster.member_contributions.map((mc) => (
                        <span key={mc.user_id} className="tabular-nums">
                          <span className="font-medium text-foreground">{mc.payer_name}:</span>{" "}
                          <MoneyText cents={mc.spent_cents} tone="default" variant="caption" className="inline text-muted-foreground" />{" "}
                          ({Math.round(mc.percentage)}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
