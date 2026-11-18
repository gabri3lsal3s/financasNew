import { History } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { formatDateTimeBR } from "@/lib/date";
import type { SystemBackup } from "@/types";

export interface BackupHistoryListProps {
  backups: SystemBackup[];
  isLoading: boolean;
}

/**
 * Trilha auditável de snapshots registrados no console administrativo.
 */
export function BackupHistoryList({ backups, isLoading }: BackupHistoryListProps) {
  return (
    <section aria-label="Histórico de Backups" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-bold text-foreground">Trilha de Snapshots Realizados</h2>
        </div>
        <Badge variant="muted" size="xs">
          {backups.length} registros
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
                  <Skeleton className="h-4 w-32 sm:w-44" />
                  <Skeleton className="h-3 w-40 sm:w-56" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : backups.length === 0 ? (
        <EmptyState
          title="Nenhum backup registrado no histórico"
          description="Clique em 'Exportar Snapshot Auditado' para registrar a primeira cópia segura."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden divide-y divide-border/80">
          {backups.map((b) => (
            <div
              key={b.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/20 transition-colors text-xs"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {formatDateTimeBR(b.created_at)}
                  </span>
                  <Badge variant="positive" size="xs">
                    {b.status === "completed" ? "Concluído" : b.status}
                  </Badge>
                </div>
                <span className="text-muted-foreground font-mono text-[11px] truncate mt-0.5">
                  Hash: {b.checksum_sha256}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-muted-foreground font-mono">
                <span>{b.record_count.toLocaleString("pt-BR")} registros</span>
                <span>{(b.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
