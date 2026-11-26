import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, History } from "lucide-react";
import { Badge, Button, DatePicker, EmptyState, SearchInput, Select, SkeletonList } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { toCsv } from "@/domain/export/csv";
import { formatDateTimeBR } from "@/lib/date";
import { downloadCsv, downloadJson } from "@/services/export-actions";
import { pushToast } from "@/services/toast";
import { useAdminAuditLogs } from "@/state";
import type { AuditEvent } from "@/types";

const PAGE_SIZE = 50;

export function AdminSecurityPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);

  const auditQuery = useAdminAuditLogs({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    action: actionFilter.trim() ? actionFilter.trim() : null,
    entityType: entityType !== "all" ? entityType : null,
    fromDate: fromDate || null,
    toDate: toDate || null,
  });

  const logs: AuditEvent[] = auditQuery.data ?? [];
  const hasNextPage = logs.length === PAGE_SIZE;

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const csvContent = toCsv(
      ["id", "created_at", "action", "entity_type", "entity_id", "user_id", "payload"],
      logs.map((log) => [
        log.id,
        log.created_at,
        log.action,
        log.entity_type,
        log.entity_id ?? "",
        log.user_id ?? "",
        JSON.stringify(log.payload ?? {}),
      ]),
    );
    void downloadCsv(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, csvContent, {
      silentToast: true,
    }).then(() => {
      pushToast({ title: "CSV exportado", description: `${logs.length} registros exportados.`, variant: "success" });
    });
  };

  const handleExportJson = () => {
    if (logs.length === 0) return;
    void downloadJson(`auditoria-${new Date().toISOString().slice(0, 10)}.json`, logs, {
      silentToast: true,
    }).then(() => {
      pushToast({ title: "JSON exportado", description: `${logs.length} registros exportados.`, variant: "success" });
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Auditoria"
        description="Trilha de eventos administrativos e exportação de logs"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
              onClick={handleExportCsv}
            >
              <Download aria-hidden="true" />
              <span>Exportar CSV</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
              onClick={handleExportJson}
            >
              <Download aria-hidden="true" />
              <span>Exportar JSON</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SearchInput
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          onClear={() => {
            setActionFilter("");
            setPage(0);
          }}
          placeholder="Filtrar por ação…"
          aria-label="Filtrar por ação"
        />

        <Select
          value={entityType}
          onValueChange={(val) => {
            setEntityType(val);
            setPage(0);
          }}
          ariaLabel="Filtrar por entidade"
          options={[
            { value: "all", label: "Entidade: Todas" },
            { value: "profile", label: "Perfil (profile)" },
            { value: "user_subscription", label: "Assinatura" },
            { value: "system_feature", label: "Feature Flag" },
            { value: "access_invite", label: "Convite" },
            { value: "support_ticket", label: "Chamado" },
            { value: "broadcast_notification", label: "Comunicado" },
          ]}
        />

        <DatePicker
          value={fromDate}
          onValueChange={(val) => {
            setFromDate(val);
            setPage(0);
          }}
          placeholder="Data inicial"
          ariaLabel="Data inicial"
        />

        <DatePicker
          value={toDate}
          onValueChange={(val) => {
            setToDate(val);
            setPage(0);
          }}
          placeholder="Data final"
          ariaLabel="Data final"
        />
      </div>

      <section aria-label="Logs de Auditoria" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Trilha de Auditoria do Sistema</h2>
          </div>
          <Badge variant="muted" size="xs">
            Página {page + 1}
          </Badge>
        </div>

        {auditQuery.isError ? (
          <EmptyState
            icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
            tone="negative"
            title="Não foi possível carregar os logs"
            description="Ocorreu um erro ao buscar a trilha de auditoria. Tente novamente."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void auditQuery.refetch()}
              >
                Tentar novamente
              </Button>
            }
          />
        ) : auditQuery.isLoading ? (
          <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <SkeletonList rows={4} className="p-6" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="Nenhum evento localizado"
            description="Nenhuma ação corresponde aos filtros informados."
          />
        ) : (
          <>
            <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden divide-y divide-border/80">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 flex flex-col gap-2 hover:bg-surface-hover/20 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="muted" size="xs" className="font-mono">
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground text-[11px] font-mono">
                      {formatDateTimeBR(log.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px] flex-wrap">
                    <span>
                      Entidade: <strong className="text-foreground">{log.entity_type}</strong>
                    </span>
                    {log.entity_id && <span className="truncate">ID: {log.entity_id}</span>}
                  </div>

                  {log.payload && Object.keys(log.payload).length > 0 && (
                    <pre className="p-2.5 rounded-lg bg-surface-raised border border-border/80 font-mono text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            {(page > 0 || hasNextPage) && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {page + 1}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || auditQuery.isLoading}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft aria-hidden="true" />
                    <span>Anterior</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasNextPage || auditQuery.isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span>Próxima</span>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
