import { Clock, Shield, UserCheck, Users } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { KpiCard, KpiGrid } from "@/components/modules";
import type { AdminMetrics } from "@/types";

export interface AdminMetricsKpiGridProps {
  metrics?: AdminMetrics;
  isLoading: boolean;
}

/**
 * Grade responsiva dos KPIs principais do Dashboard Executivo Administrativo.
 */
export function AdminMetricsKpiGrid({ metrics, isLoading }: AdminMetricsKpiGridProps) {
  if (isLoading) {
    return (
      <section aria-label="Métricas Principais">
        <KpiGrid columns={4}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3 h-24"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </KpiGrid>
      </section>
    );
  }

  return (
    <section aria-label="Métricas Principais">
      <KpiGrid columns={4}>
        <KpiCard
          label="Total de Usuários"
          value={String(metrics?.total_users ?? 0)}
          hint={
            (metrics?.test_or_internal_users ?? 0) > 0
              ? `${metrics?.test_or_internal_users} teste/internas excluídas`
              : undefined
          }
          icon={<Users className="size-4 text-muted-foreground" aria-hidden="true" />}
        />
        <KpiCard
          label="Contas Ativas"
          value={String(metrics?.active_users ?? 0)}
          tone="positive"
          icon={<UserCheck className="size-4 text-positive-strong" aria-hidden="true" />}
        />
        <KpiCard
          label="Fila de Aprovação"
          value={String(metrics?.pending_users ?? 0)}
          tone={(metrics?.pending_users ?? 0) > 0 ? "portfolio" : "default"}
          icon={<Clock className="size-4 text-warning-strong" aria-hidden="true" />}
        />
        <KpiCard
          label="Bloqueados"
          value={String(metrics?.suspended_users ?? 0)}
          tone={(metrics?.suspended_users ?? 0) > 0 ? "negative" : "default"}
          hint={
            (metrics?.quarantined_users ?? 0) > 0
              ? `${metrics?.quarantined_users} em quarentena`
              : undefined
          }
          icon={<Shield className="size-4 text-critical-strong" aria-hidden="true" />}
        />
      </KpiGrid>
    </section>
  );
}
