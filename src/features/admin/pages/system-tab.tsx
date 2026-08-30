import { History, Layers, ShieldCheck } from "lucide-react";
import { Alert, EmptyState, Skeleton, Badge } from "@/components/ui";
import { useAdminFeatures, useAdminAuditLogs } from "@/state";
import { FeatureToggleCard } from "../components";

export function SystemTab() {
  const featuresQuery = useAdminFeatures();
  const auditQuery = useAdminAuditLogs(100);

  const features = featuresQuery.data ?? [];
  const logs = auditQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* --- SEÇÃO 1: FEATURE FLAGS & KILL-SWITCHES --- */}
      <section aria-label="Módulos e Feature Flags" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-foreground">Funcionalidades &amp; Kill-Switches Globais</h2>
              <p className="text-xs text-muted-foreground">Controle central de ativação de módulos para toda a plataforma</p>
            </div>
          </div>
          <Badge variant="muted" size="xs">
            {features.length} módulos cadastrados
          </Badge>
        </div>

        <Alert variant="info">
          O Kill-Switch desativa a funcionalidade instantaneamente para todos os usuários da plataforma. Para liberar ou bloquear acessos específicos por cliente individual, utilize a aba Usuários.
        </Alert>

        {featuresQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : features.length === 0 ? (
          <EmptyState
            title="Nenhuma funcionalidade encontrada"
            description="O catálogo de módulos do sistema ainda não foi inicializado no banco de dados."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {features.map((feature) => (
              <FeatureToggleCard key={feature.key} feature={feature} />
            ))}
          </div>
        )}
      </section>

      {/* --- SEÇÃO 2: TRILHA DE AUDITORIA DE SEGURANÇA --- */}
      <section aria-label="Logs de Auditoria" className="flex flex-col gap-4 pt-2 border-t border-border/80">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-foreground">Trilha de Auditoria &amp; Segurança</h2>
              <p className="text-xs text-muted-foreground">Histórico de ações administrativas e eventos de controle da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-positive-strong" />
            <span>Últimos 100 registros</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          {auditQuery.isLoading ? (
            <div className="p-6 flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Nenhum registro de auditoria"
                description="Nenhuma ação administrativa ou evento de segurança foi registrado até o momento."
              />
            </div>
          ) : (
            <>
              {/* Visualização em Cards para Mobile (< sm) */}
              <div className="flex flex-col divide-y divide-border/60 sm:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col gap-2 hover:bg-surface-hover/20 transition-colors text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-foreground border border-border">
                        {log.action}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(log.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-muted-foreground pt-1">
                      <span className="font-mono">
                        {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}
                      </span>
                      <span className="font-mono text-[11px]">
                        {log.user_id ? `Ator: ${log.user_id.slice(0, 8)}…` : "Sistema"}
                      </span>
                    </div>

                    {log.payload && Object.keys(log.payload).length > 0 ? (
                      <div className="bg-muted/40 p-2 rounded-lg font-mono text-[10px] text-muted-foreground break-all mt-1 border border-border/40">
                        {JSON.stringify(log.payload)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Visualização em Tabela para Tablets e Desktop (sm+) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-medium">
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Ação</th>
                      <th className="py-3 px-4">Entidade</th>
                      <th className="py-3 px-4">ID Usuário</th>
                      <th className="py-3 px-4">Payload / Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-hover/30 transition-colors">
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
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold text-foreground border border-border">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                          {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground text-[11px] whitespace-nowrap">
                          {log.user_id ? log.user_id.slice(0, 8) : "—"}
                        </td>
                        <td className="py-3 px-4 max-w-[300px]">
                          {log.payload && Object.keys(log.payload).length > 0 ? (
                            <span className="font-mono text-[11px] text-muted-foreground truncate block" title={JSON.stringify(log.payload)}>
                              {JSON.stringify(log.payload)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
