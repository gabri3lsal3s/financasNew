import { useState } from "react";
import { Link } from "react-router";
import { Check, Clock, X } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, Skeleton } from "@/components/ui";
import type { AdminUserRow } from "@/types";

export interface AdminPendingApprovalsCardProps {
  pendingUsers: AdminUserRow[];
  pendingCount: number;
  isLoading: boolean;
  isMutating: boolean;
  onApprove: (userId: string, userName?: string | null) => void;
  onReject: (userId: string, userName?: string | null) => void;
}

/**
 * Seção de aprovações de cadastro pendentes com confirmação obrigatória para recusa/banimento.
 */
export function AdminPendingApprovalsCard({
  pendingUsers,
  pendingCount,
  isLoading,
  isMutating,
  onApprove,
  onReject,
}: AdminPendingApprovalsCardProps) {
  const [rejectTarget, setRejectTarget] = useState<AdminUserRow | null>(null);

  return (
    <section aria-label="Fila de Aprovação" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-bold text-foreground">Aprovações de Cadastro Pendentes</h2>
        </div>
        <Link
          to="/admin/usuarios?status=pending_approval"
          className="text-xs text-primary-strong hover:underline font-semibold"
        >
          Ver todos ({pendingCount})
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : pendingUsers.length === 0 ? (
        <EmptyState
          title="Fila de aprovação vazia"
          description="Todos os cadastros foram avaliados. Nenhuma conta aguarda aprovação no momento."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden divide-y divide-border/80">
          {pendingUsers.map((u) => (
            <div
              key={u.id}
              className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">
                  {u.name || "Nome não informado"}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate">{u.email}</span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  sensoryIntent={false}
                  onClick={() => onApprove(u.id, u.name)}
                  disabled={isMutating}
                >
                  <Check aria-hidden="true" />
                  <span>Aprovar</span>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  sensoryIntent="selection"
                  onClick={() => setRejectTarget(u)}
                  disabled={isMutating}
                >
                  <X aria-hidden="true" />
                  <span>Recusar</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        title="Recusar cadastro do usuário?"
        description={
          rejectTarget
            ? `A conta de ${rejectTarget.name || rejectTarget.email} será bloqueada e não poderá acessar a plataforma.`
            : undefined
        }
        confirmLabel="Recusar cadastro"
        variant="destructive"
        confirmPending={isMutating}
        onConfirm={() => {
          if (!rejectTarget) return;
          onReject(rejectTarget.id, rejectTarget.name);
          setRejectTarget(null);
        }}
      />
    </section>
  );
}
