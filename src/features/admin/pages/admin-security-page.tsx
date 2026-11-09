import { useState } from "react";
import {
  FileText,
  History,
  Lock,
  Search,
  ShieldCheck,
  UserX,
} from "lucide-react";
import {
  Badge,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ui";
import { useAdminAuditLogs } from "@/state";

export function AdminSecurityPage() {
  const [search, setSearch] = useState("");
  const auditQuery = useAdminAuditLogs(100);
  const logs = auditQuery.data ?? [];

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Auditoria, Segurança &amp; Governança LGPD
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Trilha imutável de eventos administrativos e console do encarregado de dados (DPO)
        </p>
      </div>

      {/* --- SEÇÃO 1: CONSOLE DPO & CONFORMIDADE LGPD --- */}
      <section aria-label="Console DPO" className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">Console de Proteção de Dados (LGPD Art. 18 &amp; 19)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <UserX className="size-3.5 text-critical-strong" aria-hidden="true" />
              <span>Direito ao Esquecimento</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Expurgo topológico atômico em cascata reversa via <code>delete_current_user_account()</code>, eliminando despesas, cartões, viagens e auth.users.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText className="size-3.5 text-primary-strong" aria-hidden="true" />
              <span>Portabilidade dos Dados</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Download do histórico patrimonial e transacional integral em JSON versionado e CSV Excel com trava biométrica e confirmação modal.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Lock className="size-3.5 text-warning-strong" aria-hidden="true" />
              <span>Sigilo de PII &amp; Cofre</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              CPF e Telefone com leitura revogada para clientes e revelação sob demanda com auditoria compulsória no cofre administrativo.
            </p>
          </div>
        </div>
      </section>

      {/* --- SEÇÃO 2: TRILHA DE AUDITORIA DE SEGURANÇA --- */}
      <section aria-label="Logs de Auditoria" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Trilha de Auditoria do Sistema</h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por ação ou entidade…"
              className="pl-8 text-xs h-8"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          {auditQuery.isLoading ? (
            <div className="p-6 flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Nenhum evento localizado"
                description="Nenhuma ação corresponde aos filtros informados."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col gap-2 hover:bg-surface-hover/20 transition-colors text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="muted" size="xs" className="font-mono">
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground text-[11px] font-mono">
                      {new Date(log.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                    <span>Entidade: <strong className="text-foreground">{log.entity_type}</strong></span>
                    {log.entity_id && (
                      <span className="truncate">ID: {log.entity_id}</span>
                    )}
                  </div>

                  {log.payload && Object.keys(log.payload).length > 0 && (
                    <pre className="p-2.5 rounded-lg bg-background/80 border border-border/60 font-mono text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
