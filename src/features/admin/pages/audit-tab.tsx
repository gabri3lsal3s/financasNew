import { History } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui";
import { useAdminAuditLogs } from "@/state";

export function AuditTab() {
  const auditQuery = useAdminAuditLogs(100);
  const logs = auditQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="size-4" aria-hidden="true" />
        <span>Exibindo os últimos 100 registros de auditoria de segurança da plataforma.</span>
      </div>

      <div className="rounded-2xl border border-border/80 bg-surface/90 shadow-xs overflow-hidden">
        {auditQuery.isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum log de auditoria"
              description="Nenhum evento administrativo ou de segurança foi registrado ainda."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Entidade</th>
                  <th className="py-3 px-4">ID Usuário</th>
                  <th className="py-3 px-4">Payload / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover/30">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-md bg-surface-hover px-2 py-0.5 text-[10px] font-mono font-semibold text-foreground">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      {log.user_id ? log.user_id.slice(0, 8) + "…" : "Sistema"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground max-w-xs truncate">
                      {JSON.stringify(log.payload ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
