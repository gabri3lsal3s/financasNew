import { Clock, KeyRound, Shield, UserCheck, Users } from "lucide-react";
import { NumberTicker, Skeleton } from "@/components/ui";
import type { AdminMetrics } from "@/types";

export interface AdminMetricsKpiGridProps {
  metrics?: AdminMetrics;
  isLoading: boolean;
}

const METRIC_CARDS = [
  {
    key: "total_users",
    label: "Total Usuários",
    icon: Users,
    valueClass: "text-foreground",
  },
  {
    key: "active_users",
    label: "Contas Ativas",
    icon: UserCheck,
    valueClass: "text-positive-strong",
  },
  {
    key: "pending_users",
    label: "Fila Aprovação",
    icon: Clock,
    valueClass: "text-warning-strong",
  },
  {
    key: "suspended_users",
    label: "Bloqueados",
    icon: Shield,
    valueClass: "text-critical-strong",
  },
  {
    key: "total_invites",
    label: "Convites Criados",
    icon: KeyRound,
    valueClass: "text-foreground",
  },
  {
    key: "used_invites",
    label: "Convites Usados",
    icon: KeyRound,
    valueClass: "text-positive-strong",
  },
] as const;

/**
 * Grade responsiva dos KPIs principais do Dashboard Executivo Administrativo.
 */
export function AdminMetricsKpiGrid({ metrics, isLoading }: AdminMetricsKpiGridProps) {
  return (
    <section
      aria-label="Métricas Principais"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
    >
      {METRIC_CARDS.map(({ key, label, icon: Icon, valueClass }) => (
        <div
          key={key}
          className="rounded-xl border border-border/80 bg-surface p-3 sm:p-4 shadow-xs flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
            <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className={`tabular-nums text-xl font-bold tracking-tight sm:text-2xl ${valueClass}`}>
              <NumberTicker value={metrics?.[key] ?? 0} />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
