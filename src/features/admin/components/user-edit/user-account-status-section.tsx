import { Shield, Trash2 } from "lucide-react";
import { Button, FormField, Input, Select } from "@/components/ui";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import type { UserRole, UserStatus } from "@/types";

export interface UserAccountStatusSectionProps {
  status: UserStatus;
  reason: string;
  role: UserRole;
  canEditStatus: boolean;
  canEditRole: boolean;
  canDeleteUser: boolean;
  isSuperadminActor: boolean;
  isDeletePending: boolean;
  onStatusChange: (status: UserStatus) => void;
  onReasonChange: (reason: string) => void;
  onRoleChange: (role: UserRole) => void;
  onOpenDeleteConfirm: () => void;
}

/**
 * Seção de status da conta, cargo administrativo (role) e zona de perigo de exclusão.
 */
export function UserAccountStatusSection({
  status,
  reason,
  role,
  canEditStatus,
  canEditRole,
  canDeleteUser,
  isSuperadminActor,
  isDeletePending,
  onStatusChange,
  onReasonChange,
  onRoleChange,
  onOpenDeleteConfirm,
}: UserAccountStatusSectionProps) {
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

      {canDeleteUser && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-critical/30 bg-critical/5 text-xs shadow-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-critical-strong block">
              Zona de Perigo: Exclusão Definitiva
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Remove permanentemente a conta, histórico financeiro e libera o e-mail no sistema.
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onOpenDeleteConfirm}
            disabled={isDeletePending}
            className="shrink-0"
          >
            <Trash2 aria-hidden="true" />
            <span>Excluir Usuário do Sistema</span>
          </Button>
        </div>
      )}
    </div>
  );
}
