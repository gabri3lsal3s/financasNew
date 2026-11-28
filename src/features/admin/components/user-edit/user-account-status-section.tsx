import { RotateCcw, Shield, ShieldAlert, Trash2 } from "lucide-react";
import { Button, FormField, Input, Select, Switch } from "@/components/ui";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { formatDateBR } from "@/lib/date";
import type { UserRole, UserStatus } from "@/types";

export interface UserAccountStatusSectionProps {
  status: UserStatus;
  reason: string;
  role: UserRole;
  isTest: boolean;
  deletedAt?: string | null;
  quarantineReason?: string | null;
  canEditStatus: boolean;
  canEditRole: boolean;
  canDeleteUser: boolean;
  isSuperadminActor: boolean;
  isTestPending?: boolean;
  isQuarantinePending?: boolean;
  isRestorePending?: boolean;
  isDeletePending: boolean;
  onStatusChange: (status: UserStatus) => void;
  onReasonChange: (reason: string) => void;
  onRoleChange: (role: UserRole) => void;
  onToggleTestFlag: (isTest: boolean) => void;
  onOpenQuarantineConfirm: () => void;
  onOpenRestoreConfirm: () => void;
  onOpenDeleteConfirm: () => void;
}

/**
 * Seção de status da conta, cargo administrativo (role), marcação de teste e zona de perigo.
 */
export function UserAccountStatusSection({
  status,
  reason,
  role,
  isTest,
  deletedAt,
  quarantineReason,
  canEditStatus,
  canEditRole,
  canDeleteUser,
  isSuperadminActor,
  isTestPending = false,
  isQuarantinePending = false,
  isRestorePending = false,
  isDeletePending,
  onStatusChange,
  onReasonChange,
  onRoleChange,
  onToggleTestFlag,
  onOpenQuarantineConfirm,
  onOpenRestoreConfirm,
  onOpenDeleteConfirm,
}: UserAccountStatusSectionProps) {
  const isQuarantined = Boolean(deletedAt);

  return (
    <div className="flex flex-col gap-4 pt-2 border-t border-border/80">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField
          label="Status da Conta na Plataforma"
          htmlFor="user-status"
          helperText={
            !canEditStatus
              ? "Você não tem permissão para alterar o status de um Superadministrador."
              : undefined
          }
        >
          <Select
            id="user-status"
            value={status}
            onValueChange={(val) => onStatusChange(val as UserStatus)}
            disabled={!canEditStatus}
            options={[
              { value: "active", label: STATUS_LABELS.active },
              { value: "pending_approval", label: STATUS_LABELS.pending_approval },
              { value: "suspended", label: STATUS_LABELS.suspended },
              { value: "banned", label: STATUS_LABELS.banned },
            ]}
          />
        </FormField>

        <FormField
          label={
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Nível de Permissão Administrativa (Role)</span>
            </span>
          }
          htmlFor="user-role"
          helperText={
            !isSuperadminActor
              ? "Apenas um Superadministrador pode alterar cargos e privilégios."
              : undefined
          }
        >
          <Select
            id="user-role"
            value={role}
            onValueChange={(val) => onRoleChange(val as UserRole)}
            disabled={!canEditRole}
            options={[
              { value: "user", label: ROLE_LABELS.user },
              { value: "admin", label: ROLE_LABELS.admin },
              { value: "superadmin", label: ROLE_LABELS.superadmin },
            ]}
          />
        </FormField>
      </div>

      {(status === "suspended" || status === "banned") && (
        <FormField
          label="Motivo da Suspensão / Banimento"
          htmlFor="user-reason"
          labelClassName="text-critical-strong"
        >
          <Input
            id="user-reason"
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ex: Violação dos termos de uso / Inadimplência"
            required
          />
        </FormField>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <div className="space-y-0.5 min-w-0">
          <span className="text-xs font-semibold text-foreground block">
            Conta de teste (QA/Interna)
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Contas marcadas como teste são excluídas das métricas de engajamento e faturamento real.
          </span>
        </div>
        <Switch
          checked={isTest}
          onCheckedChange={onToggleTestFlag}
          disabled={isTestPending}
          aria-label="Conta de teste (QA/Interna)"
        />
      </div>

      {canDeleteUser && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-critical/30 bg-critical/5 text-xs shadow-xs">
          {isQuarantined && deletedAt && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
              <ShieldAlert className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <span className="font-semibold text-foreground block">
                  Conta em quarentena desde {formatDateBR(deletedAt)}
                </span>
                {quarantineReason ? (
                  <span className="text-[11px] text-muted-foreground block">
                    Motivo: {quarantineReason}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground block">
                    O acesso está bloqueado e os dados preservados até restauração ou exclusão definitiva.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-semibold text-critical-strong block">
                {isQuarantined ? "Zona de Perigo: Quarentena & Exclusão" : "Zona de Perigo: Quarentena & Exclusão Definitiva"}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {isQuarantined
                  ? "Restaure o acesso da conta ou remova permanentemente todos os dados e libere o e-mail."
                  : "Coloque em quarentena para bloquear o acesso preservando os dados, ou exclua definitivamente."}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isQuarantined ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenRestoreConfirm}
                  disabled={isRestorePending || isDeletePending}
                >
                  <RotateCcw aria-hidden="true" />
                  <span>Restaurar Acesso</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenQuarantineConfirm}
                  disabled={isQuarantinePending || isDeletePending}
                >
                  <ShieldAlert aria-hidden="true" />
                  <span>Colocar em Quarentena</span>
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onOpenDeleteConfirm}
                disabled={isDeletePending || isQuarantinePending || isRestorePending}
              >
                <Trash2 aria-hidden="true" />
                <span>Excluir Usuário do Sistema</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
