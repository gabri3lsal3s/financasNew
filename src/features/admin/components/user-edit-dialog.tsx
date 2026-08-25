import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { Check, RotateCcw, Shield, UserCheck, X } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  canManageRole,
  canManageUserStatus,
  getFeatureStatusInfo,
} from "@/domain/admin";
import {
  useAdminFeatures,
  useAdminRemoveFeatureOverride,
  useAdminSetFeatureOverride,
  useAdminSetUserRole,
  useAdminUpdateUserStatus,
  useUserAccess,
  useUserOverrides,
} from "@/state";
import type { AdminUserRow, UserFeatureOverride, UserRole, UserStatus } from "@/types";



export interface UserEditDialogProps {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({ user, open, onOpenChange }: UserEditDialogProps) {
  const { role: currentUserRole } = useUserAccess();
  const updateStatusMutation = useAdminUpdateUserStatus();
  const setRoleMutation = useAdminSetUserRole();
  const setOverrideMutation = useAdminSetFeatureOverride();
  const removeOverrideMutation = useAdminRemoveFeatureOverride();
  const featuresQuery = useAdminFeatures();
  const overridesQuery = useUserOverrides(user?.id);

  const [status, setStatus] = useState<UserStatus>((user?.status as UserStatus) || "active");
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) || "user");
  const [reason, setReason] = useState(user?.suspended_reason || "");

  const overridesMap = useMemo(() => {
    const map = new Map<string, UserFeatureOverride>();
    for (const ov of overridesQuery.data ?? []) {
      map.set(ov.feature_key, ov);
    }
    return map;
  }, [overridesQuery.data]);

  if (!user) return null;

  const targetRole = user.role as UserRole;
  const isSuperadminActor = currentUserRole === "superadmin";
  const canEditStatus = canManageUserStatus(currentUserRole, targetRole);
  const canEditRole = canManageRole(currentUserRole, targetRole);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (status !== user.status && canEditStatus) {
        await updateStatusMutation.mutateAsync({
          userId: user.id,
          status,
          reason: reason.trim() ? reason.trim() : null,
        });
      }

      if (role !== user.role && canEditRole) {
        await setRoleMutation.mutateAsync({
          userId: user.id,
          role,
        });
      }

      onOpenChange(false);
    } catch {
      // Erros tratados nos hooks
    }
  };

  const handleToggleUserFeature = async (featureKey: string, enabled: boolean) => {
    await setOverrideMutation.mutateAsync({
      userId: user.id,
      featureKey,
      enabled,
    });
  };

  const handleRemoveOverride = async (featureKey: string) => {
    await removeOverrideMutation.mutateAsync({
      userId: user.id,
      featureKey,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerenciar Usuário"
      description={`Configurações de acesso, permissões e status da conta para ${user.name || user.email}.`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Identificação Básica */}
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-semibold text-foreground">{user.name || "Não informado"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail:</span>
            <span className="font-mono text-foreground">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cadastrado em:</span>
            <span className="text-foreground">{new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        {/* Status da Conta */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="user-status" className="text-xs font-semibold text-foreground">
            Status da Conta
          </label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as UserStatus)}
            disabled={!canEditStatus}
            options={[
              { value: "active", label: STATUS_LABELS.active },
              { value: "pending_approval", label: STATUS_LABELS.pending_approval },
              { value: "suspended", label: STATUS_LABELS.suspended },
              { value: "banned", label: STATUS_LABELS.banned },
            ]}
          />
          {!canEditStatus ? (
            <span className="text-[11px] text-muted-foreground">
              Você não tem permissão para alterar o status de um Superadministrador.
            </span>
          ) : null}
        </div>

        {/* Justificativa em caso de suspensão/banimento */}
        {status === "suspended" || status === "banned" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="user-reason" className="text-xs font-semibold text-critical">
              Motivo da Suspensão / Banimento
            </label>
            <Input
              id="user-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Violação dos termos de uso / Inadimplência"
              required
            />
          </div>
        ) : null}

        {/* Nível de Acesso (Role) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Shield className="size-3.5 text-portfolio" aria-hidden="true" />
            <label htmlFor="user-role" className="text-xs font-semibold text-foreground">
              Nível de Permissão (Role)
            </label>
          </div>
          <Select
            value={role}
            onValueChange={(val) => setRole(val as UserRole)}
            disabled={!canEditRole}
            options={[
              { value: "user", label: ROLE_LABELS.user },
              { value: "admin", label: ROLE_LABELS.admin },
              { value: "superadmin", label: ROLE_LABELS.superadmin },
            ]}
          />
          {!isSuperadminActor ? (
            <span className="text-[11px] text-muted-foreground">
              Apenas um Superadministrador pode alterar cargos e privilégios.
            </span>
          ) : null}
        </div>

        {/* Overrides de Funcionalidades */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Acesso a Funcionalidades Específicas
            </span>
            <span className="text-[11px] text-muted-foreground">
              Veja o status efetivo do usuário para cada módulo e configure liberações ou bloqueios personalizados.
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {(featuresQuery.data ?? []).map((feature) => {
              const override = overridesMap.get(feature.key);
              const statusInfo = getFeatureStatusInfo(feature, override);

              return (
                <div
                  key={feature.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border/80 bg-surface/80 text-xs shadow-2xs"
                >
                  <div className="flex flex-col gap-1 max-w-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{feature.name}</span>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          statusInfo.badgeVariant === "positive"
                            ? "bg-positive/10 text-positive-strong border border-positive/25 font-bold"
                            : statusInfo.badgeVariant === "critical"
                              ? "bg-critical/10 text-critical border border-critical/25 font-bold"
                              : "bg-surface-hover text-muted-foreground border border-border"
                        }`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{feature.description}</span>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-1 sm:pt-0">
                    <Button
                      type="button"
                      variant={statusInfo.kind === "override_enabled" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleUserFeature(feature.key, true)}
                      disabled={setOverrideMutation.isPending || !feature.is_globally_enabled}
                      className={`gap-1 text-xs h-7 px-2.5 flex-1 sm:flex-initial justify-center ${
                        statusInfo.kind === "override_enabled"
                          ? "bg-positive text-white hover:bg-positive/90"
                          : "text-positive-strong hover:bg-positive/10 border-positive/30"
                      }`}
                      title="Forçar liberação para este usuário"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Liberar</span>
                    </Button>

                    <Button
                      type="button"
                      variant={statusInfo.kind === "override_disabled" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleToggleUserFeature(feature.key, false)}
                      disabled={setOverrideMutation.isPending || !feature.is_globally_enabled}
                      className={`gap-1 text-xs h-7 px-2.5 flex-1 sm:flex-initial justify-center ${
                        statusInfo.kind === "override_disabled"
                          ? "bg-critical text-white hover:bg-critical/90"
                          : "text-critical hover:bg-critical/10 border-critical/30"
                      }`}
                      title="Forçar bloqueio para este usuário"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      <span>Bloquear</span>
                    </Button>

                    {statusInfo.hasOverride && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOverride(feature.key)}
                        disabled={removeOverrideMutation.isPending}
                        className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Restaurar regra padrão global"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-border mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto justify-center">
            Fechar
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={updateStatusMutation.isPending || setRoleMutation.isPending}
            className="gap-1.5 w-full sm:w-auto justify-center"
          >
            <UserCheck className="size-4" aria-hidden="true" />
            Salvar Alterações
          </Button>
        </div>

      </form>
    </Modal>
  );
}
