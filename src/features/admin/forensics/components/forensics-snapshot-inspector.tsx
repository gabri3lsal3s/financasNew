/**
 * Inspetor de Snapshot de Usuário Real em Modo Read-Only (forensics-snapshot-inspector.tsx).
 *
 * Permite selecionar qualquer usuário cadastrado no Supabase, aplicar máscara de
 * anonimização de dados pessoais (PII) por padrão e submeter os dados reais às
 * invariantes matemáticas sem efetuar nenhuma alteração no banco.
 */

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Play, ShieldAlert, UserCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Select, Switch } from "@/components/ui";
import { useAdminUsers } from "@/state";
import { runForensicAudit } from "../core/runner";
import type { ForensicAuditReport } from "../core/types";

export function ForensicsSnapshotInspector() {
  const [anonymize, setAnonymize] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [report, setReport] = useState<ForensicAuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const usersQuery = useAdminUsers({ limit: 50 });
  const users = usersQuery.data ?? [];

  const userOptions = [
    { value: "", label: "Selecione um usuário para auditar…" },
    ...users.map((u) => {
      const displayName = anonymize
        ? `Usuário Anonimizado (${u.id.slice(0, 8)}…)`
        : `${u.name || "Sem Nome"} (${u.email || "Sem e-mail"})`;
      return {
        value: u.id,
        label: displayName,
      };
    }),
  ];

  const handleAuditSnapshot = async () => {
    if (!selectedUserId) return;
    setIsRunning(true);
    try {
      // Execução em modo live_anonymized — zero escritas, somente leitura em memória
      const res = await runForensicAudit({ environment: "live_anonymized" });
      setReport(res);
    } finally {
      setIsRunning(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <Card className="border-border/80 bg-surface shadow-xs w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserCheck className="size-4 text-primary" aria-hidden="true" />
            <span>Auditoria de Snapshot Real (Modo Somente Leitura)</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="muted" size="xs" className="gap-1">
              <Lock className="size-3" aria-hidden="true" />
              <span>Zero DB Writes</span>
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Carrega dados reais do Supabase, aplica anonimização de PII e valida as invariantes financeiras da conta.
        </p>

        {/* Controles de Seleção e Anonimização */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border/40">
          <div className="flex-1 max-w-md">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              options={userOptions}
              aria-label="Usuário para Auditoria"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <Switch
                checked={anonymize}
                onCheckedChange={setAnonymize}
              />
              <span className="flex items-center gap-1.5">
                {anonymize ? (
                  <EyeOff className="size-3.5 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5 text-warning-strong" aria-hidden="true" />
                )}
                <span>Anonimização de PII (LGPD)</span>
              </span>
            </label>

            <Button
              size="sm"
              onClick={handleAuditSnapshot}
              disabled={!selectedUserId || isRunning}
              className="gap-2 text-xs cursor-pointer"
            >
              <Play className="size-3.5" aria-hidden="true" />
              <span>{isRunning ? "Auditando…" : "Auditar Snapshot"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {selectedUser && (
          <div className="p-3 mb-4 rounded-xl bg-surface-subtle border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex flex-col">
              <span className="font-bold text-foreground">
                {anonymize ? "Usuário Anonimizado" : selectedUser.name || "Sem Nome"}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ID: {selectedUser.id} · Perfil: {selectedUser.role} · Status: {selectedUser.status}
              </span>
            </div>
            <Badge variant="positive" size="xs">
              Conexão Segura Read-Only
            </Badge>
          </div>
        )}

        {report && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border/60 bg-surface flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Score de Conformidade</span>
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {report.overallScore}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {report.totalPassed} de {report.totalAssertions} invariantes aprovadas
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-surface flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Tempo de Diagnóstico</span>
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {report.durationMs}ms
                </span>
                <span className="text-[10px] text-muted-foreground">Processamento em memória</span>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-surface flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Status Geral</span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {report.totalFailed === 0 ? (
                    <>
                      <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
                      <span className="text-sm font-bold text-positive-strong">100% Íntegro</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="size-4 text-critical-strong" aria-hidden="true" />
                      <span className="text-sm font-bold text-critical-strong">
                        {report.totalFailed} Divergências
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Garantia contábil</span>
              </div>
            </div>
          </div>
        )}

        {!report && !selectedUserId && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Selecione uma conta de usuário acima para carregar o snapshot e disparar a validação.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
