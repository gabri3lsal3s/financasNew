import { useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, Compass, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import type { AllocationDriftAnalysis } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface AllocationDriftCardProps {
  analysis: AllocationDriftAnalysis;
  className?: string;
}

/**
 * Card de Monitoramento de Desvios de Alocação (Allocation Drift) — FASE 52.
 *
 * Aponta desvios em relação às metas de carteira e sugere aportes corretivos.
 */
export function AllocationDriftCard({ analysis, className }: AllocationDriftCardProps) {
  const navigate = useNavigate();

  if (!analysis.hasTargets) {
    return null;
  }

  const { isBalanced, underweightItems, overweightItems } = analysis;

  return (
    <div
      role="region"
      aria-label="Diagnóstico de Alocação"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-4 sm:p-5 shadow-xs transition-all",
        isBalanced
          ? "border-border/80 bg-surface/90"
          : "border-warning/30 bg-warning/5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              isBalanced
                ? "bg-positive/10 border-positive/20 text-positive"
                : "bg-warning/10 border-warning/20 text-warning-strong",
            )}
            aria-hidden="true"
          >
            {isBalanced ? <CheckCircle2 className="size-4.5" /> : <Compass className="size-4.5" />}
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {isBalanced ? "Carteira Balanceada" : "Desvio de Alocação Detectado"}
              </h3>
              <Badge
                variant={isBalanced ? "positive" : "warning"}
                className="text-[10px] py-0 px-1.5 font-medium"
              >
                {isBalanced ? "Em conformidade" : `${underweightItems.length + overweightItems.length} desvios`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isBalanced
                ? "Todos os ativos e classes estão dentro da margem de tolerância das suas metas."
                : "Alguns ativos ou classes estão abaixo da sua meta estipulada. Priorize novos aportes para equilibrar."}
            </p>
          </div>
        </div>

        {!isBalanced && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/carteira?tab=aporte")}
            className="gap-1.5 text-xs h-8 shrink-0 font-medium self-end sm:self-center"
          >
            <span>Simular Rebalanceamento</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {!isBalanced && underweightItems.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Ativos/Classes com Aporte Recomendado
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {underweightItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-surface/80"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingDown className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({item.currentPercent}% / {item.targetPercent}%)
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-muted-foreground block">Gap:</span>
                  <MoneyText cents={item.recommendedAporteCents} tone="default" className="text-xs font-semibold" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
