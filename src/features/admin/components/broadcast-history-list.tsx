import { useState } from "react";
import { BellRing, Clock, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton } from "@/components/ui";
import { formatDateTimeBR } from "@/lib/date";
import { useAdminDeleteBroadcast, useAdminExpireBroadcast } from "@/state";
import type { AdminBroadcastNotification } from "@/types";

export interface BroadcastHistoryListProps {
  broadcasts: AdminBroadcastNotification[];
  isLoading: boolean;
}

/**
 * Histórico de notificações broadcast enviadas aos usuários pelo painel administrativo.
 */
export function BroadcastHistoryList({ broadcasts, isLoading }: BroadcastHistoryListProps) {
  const [nowMs] = useState(() => Date.now());
  const [deleteTarget, setDeleteTarget] = useState<AdminBroadcastNotification | null>(null);
  const expireMutation = useAdminExpireBroadcast();
  const deleteMutation = useAdminDeleteBroadcast();

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
          {broadcasts.map((b) => {
            const isExpired = Boolean(b.expires_at && new Date(b.expires_at).getTime() <= nowMs);
            const audienceLabel =
              b.target_audience === "all"
                ? "Todos"
                : b.target_audience === "pro"
                  ? "Pro"
                  : b.target_audience === "specific_users"
                    ? "Usuários específicos"
                    : "Free";

            return (
              <div
                key={b.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/20 transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground line-clamp-2 break-words">{b.title}</span>
                    <Badge variant="muted" size="xs" className="font-mono">
                      {audienceLabel}
                    </Badge>
                    {b.expires_at ? (
                      <Badge variant={isExpired ? "warning" : "default"} size="xs">
                        {isExpired ? "Expirado" : `Expira ${formatDateTimeBR(b.expires_at)}`}
                      </Badge>
                    ) : null}
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

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDateTimeBR(b.created_at)}
                  </span>
                  {!isExpired && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={expireMutation.isPending}
                      onClick={() => expireMutation.mutate(b.id)}
                    >
                      <Clock aria-hidden="true" />
                      <span>Encerrar</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-critical-strong hover:text-critical-strong"
                    aria-label={`Excluir comunicado ${b.title}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteTarget(b)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Excluir comunicado?"
        description={
          deleteTarget
            ? `O comunicado "${deleteTarget.title}" será removido permanentemente do histórico.`
            : undefined
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          const targetId = deleteTarget.id;
          setDeleteTarget(null);
          deleteMutation.mutate(targetId);
        }}
      />
    </section>
  );
}
