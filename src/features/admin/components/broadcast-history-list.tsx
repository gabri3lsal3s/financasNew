import { BellRing } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { formatDateTimeBR } from "@/lib/date";
import type { AdminBroadcastNotification } from "@/types";

export interface BroadcastHistoryListProps {
  broadcasts: AdminBroadcastNotification[];
  isLoading: boolean;
}

/**
 * Histórico de notificações broadcast enviadas aos usuários pelo painel administrativo.
 */
export function BroadcastHistoryList({ broadcasts, isLoading }: BroadcastHistoryListProps) {
  return (
    <section aria-label="Histórico de Comunicados" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-bold text-foreground">Histórico de Mensagens Enviadas</h2>
        </div>
        <Badge variant="muted" size="xs">
          {broadcasts.length} disparos
        </Badge>
      </div>

      {isLoading ? (
        <div
          className="rounded-xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 divide-y divide-border/80"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36 sm:w-48" />
                  <Skeleton className="h-3 w-48 sm:w-64" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : broadcasts.length === 0 ? (
        <EmptyState
          title="Nenhum comunicado enviado"
          description="Use o formulário acima para disparar seu primeiro aviso a todos ou parte dos usuários."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden divide-y divide-border/80">
          {broadcasts.map((b) => (
            <div
              key={b.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/20 transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{b.title}</span>
                  <Badge variant="muted" size="xs" className="font-mono">
                    {b.target_audience === "all"
                      ? "Todos"
                      : b.target_audience === "pro"
                        ? "Pro"
                        : "Free"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                  {b.message}
                </p>
                {b.action_url && (
                  <span className="text-[11px] text-primary-strong font-mono mt-1">
                    Ação: {b.action_url}
                  </span>
                )}
              </div>

              <div className="shrink-0 text-right text-xs text-muted-foreground font-mono">
                {formatDateTimeBR(b.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
