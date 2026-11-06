import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
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
      <CardHeader className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Ranking de Consumo por Categoria</span>
        </CardTitle>

        <div>
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
          />
        ) : (
          <div
            className={cn(
              "grid gap-3",
              clusters.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            )}
          >
            {clusters.map((cluster) => {
              const clampedPercent = Math.min(100, Math.max(0, cluster.percentage));

              return (
                <div
                  key={cluster.clusterId}
                  className="p-3 rounded-xl border border-border/70 bg-surface-muted/30 space-y-2.5 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border/80 shrink-0">
                        <CategoryIcon
                          icon={cluster.icon}
                          color={cluster.color}
                          className="size-4"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {cluster.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {cluster.expenses_count}{" "}
                          {cluster.expenses_count === 1 ? "lançamento" : "lançamentos"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <MoneyText
                        cents={cluster.total_cents}
                        className="text-xs sm:text-sm font-bold text-foreground tabular-nums whitespace-nowrap"
                      />
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {cluster.display_percentage}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Progresso Proporcional da Categoria */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clampedPercent}%`,
                        backgroundColor: cluster.color || "var(--primary)",
                      }}
                    />
                  </div>

                  {/* Contribuição por participante na categoria */}
                  {cluster.member_contributions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                      {cluster.member_contributions.map((mc) => (
                        <span key={mc.user_id} className="tabular-nums">
                          <span className="font-medium text-foreground">{mc.payer_name}:</span>{" "}
                          <MoneyText cents={mc.spent_cents} className="inline text-muted-foreground" />{" "}
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
