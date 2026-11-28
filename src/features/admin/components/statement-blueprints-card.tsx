import { useMemo, useState } from "react";
import { Check, FileSpreadsheet, ShieldOff } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, KeyValueGrid, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useAdminApproveStatementBlueprint,
  useAdminStatementBlueprints,
  useAdminSuspendStatementBlueprint,
} from "@/state";
import type {
  StatementLayoutBlueprintRow,
  StatementLayoutBlueprintStatus,
} from "@/types";
import { AdminHelpTip } from "./admin-help-tip";

const STATUS_META: Record<
  StatementLayoutBlueprintStatus,
  { label: string; variant: "warning" | "positive" | "muted"; priority: number }
> = {
  pending_review: { label: "Aguardando aprovação", variant: "warning", priority: 0 },
  active: { label: "Ativo global", variant: "positive", priority: 1 },
  suspended: { label: "Suspenso", variant: "muted", priority: 2 },
};

/**
 * Curadoria Admin de Layouts de Fatura aprendidos na nuvem (D16):
 * aprova `pending_review` / `suspended` ou suspende layouts globais em 1 clique.
 */
export function StatementBlueprintsCard() {
  const blueprintsQuery = useAdminStatementBlueprints();
  const approveMutation = useAdminApproveStatementBlueprint();
  const suspendMutation = useAdminSuspendStatementBlueprint();
  const [suspendTarget, setSuspendTarget] = useState<StatementLayoutBlueprintRow | null>(null);

  const sortedRows = useMemo(() => {
    const rows = blueprintsQuery.data ?? [];
    return [...rows].sort((a, b) => {
      const pDiff = STATUS_META[a.status].priority - STATUS_META[b.status].priority;
      if (pDiff !== 0) return pDiff;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [blueprintsQuery.data]);

  const pendingCount = useMemo(
    () => sortedRows.filter((row) => row.status === "pending_review").length,
    [sortedRows],
  );
  const isMutating = approveMutation.isPending || suspendMutation.isPending;

  const handleApprove = async (row: StatementLayoutBlueprintRow) => {
    try {
      await approveMutation.mutateAsync({ blueprintId: row.id });
      triggerSensory("success");
      pushToast({
        title: "Layout promovido para uso global",
        description: `${row.issuer_name} já está ativo para leitura instantânea.`,
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível aprovar o layout",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    const target = suspendTarget;
    setSuspendTarget(null);
    try {
      await suspendMutation.mutateAsync(target.id);
      triggerSensory("success");
      pushToast({
        title: "Layout suspenso",
        description: `${target.issuer_name} não será mais aplicado automaticamente.`,
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível suspender o layout",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileSpreadsheet
            className="size-4 text-muted-foreground shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="text-base font-bold text-foreground line-clamp-2 break-words">
                Layouts de Fatura
              </h2>
              <AdminHelpTip
                title="indicadores dos layouts de fatura"
                what="Um acerto determinístico ocorre quando os valores lidos passam na conferência exata. O mesmo usuário pode gerar vários acertos."
                when="Use os contadores de usuários para ver quantas pessoas tiveram sucesso ou falha. Falhas consecutivas mostram quantas falhas ocorreram em sequência."
                impact="Uma conferência exata reinicia a sequência de falhas."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Curadoria de layouts aprendidos na nuvem para leitura instantânea de PDFs
            </p>
          </div>
        </div>
        <Badge variant={pendingCount > 0 ? "warning" : "muted"} size="xs">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "pendente" : "pendentes"}`
            : `${sortedRows.length} cadastrados`}
        </Badge>
      </div>

      {blueprintsQuery.isLoading ? (
        <div
          className="rounded-xl border border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-3"
          aria-hidden="true"
        >
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : blueprintsQuery.isError ? (
        <Alert variant="error">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span>{getErrorMessage(blueprintsQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void blueprintsQuery.refetch()}
              className="shrink-0"
            >
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : sortedRows.length === 0 ? (
        <EmptyState
          tone="default"
          title="Nenhum layout na fila"
          description="Os layouts aprendidos com conferência exata aparecerão aqui para aprovação ou revisão."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden divide-y divide-border/80">
          {sortedRows.map((row) => {
            const meta = STATUS_META[row.status];
            const canApprove =
              row.status === "pending_review" || row.status === "suspended";
            const canSuspend = row.status === "active" && row.scope === "global";

            return (
              <div
                key={row.id}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground line-clamp-2 break-words">
                      {row.issuer_name}
                    </span>
                    <Badge variant={meta.variant} size="xs">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{row.file_kind}</p>
                  <KeyValueGrid
                    variant="borderless"
                    className="py-2"
                    items={[
                      { label: "Conferências exatas", value: row.exact_checksum_hits },
                      { label: "Usuários com validação", value: row.distinct_users_verified },
                      { label: "Usuários com falha", value: row.distinct_users_failed },
                      { label: "Falhas consecutivas", value: row.consecutive_failures },
                    ]}
                  />
                  <p className="text-[11px] font-mono text-muted-foreground break-all">
                    {row.fingerprint}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {canApprove ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      sensoryIntent={false}
                      disabled={isMutating}
                      onClick={() => void handleApprove(row)}
                      className="gap-1.5 text-xs"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Aprovar global</span>
                    </Button>
                  ) : null}
                  {canSuspend ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => setSuspendTarget(row)}
                      className="gap-1.5 text-xs text-critical-strong hover:bg-critical/10"
                    >
                      <ShieldOff className="size-3.5" aria-hidden="true" />
                      <span>Suspender</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
        title="Suspender layout global?"
        description={
          suspendTarget
            ? `O layout "${suspendTarget.issuer_name}" deixará de ser aplicado automaticamente aos novos envios até nova aprovação.`
            : undefined
        }
        confirmLabel="Suspender layout"
        variant="destructive"
        confirmPending={suspendMutation.isPending}
        onConfirm={() => void handleConfirmSuspend()}
      />
    </div>
  );
}
