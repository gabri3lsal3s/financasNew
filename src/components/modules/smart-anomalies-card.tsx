import { Sparkles } from "lucide-react";
import type { InsightAlert } from "@/domain/insights";
import { AlertCard } from "@/components/modules/alert-card";

export interface SmartAnomaliesCardProps {
  /** Alertas priorizados (domain/insights criticalAlerts) — já ordenados. */
  alerts: readonly InsightAlert[];
  /** Máximo de alertas exibidos (default 3). */
  limit?: number;
}

/**
 * Card inteligente de anomalias (F8): alertas críticos priorizados no topo da
 * Visão Geral, reutilizando o módulo AlertCard (DRY — mesma apresentação da
 * tela de Insights).
 */
export function SmartAnomaliesCard({ alerts, limit = 3 }: SmartAnomaliesCardProps) {
  const visible = alerts.slice(0, limit);

  if (visible.length === 0) {
    return (
      <article className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="size-4 text-foreground" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">Anomalias</h3>
        </div>
        <p className="text-xs text-muted-foreground">Nenhum alerta crítico no momento.</p>
      </article>
    );
  }

  return (
    <section aria-label="Anomalias e alertas" className="flex flex-col gap-2">
      {visible.map((alert) => (
        <AlertCard
          key={alert.id}
          priority={alert.priority as 1 | 2 | 3 | 4 | 5 | 6}
          title={alert.title}
          description={alert.description}
        />
      ))}
    </section>
  );
}
