import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { Check, Crown, RotateCcw, Shield, Sparkles, UserCheck, X } from "lucide-react";
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
  useAdminRemoveUserModulePermission,
  useAdminSetFeatureOverride,
  useAdminSetUserModulePermission,
  useAdminSetUserRole,
  useAdminSetUserSubscription,
  useAdminUpdateUserStatus,
  useAdminUserModulePermissions,
  useAdminUserSubscription,
  useUserAccess,
  useUserOverrides,
} from "@/state";
import type {
  AdminUserRow,
  ModuleAccessLevel,
  SubscriptionTier,
  UserFeatureOverride,
  UserModulePermission,
  UserRole,
  UserStatus,
} from "@/types";

export interface UserEditDialogProps {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_MODULES = [
  { key: "transactions", label: "Transações & Extrato", desc: "Receitas, despesas e lançamentos" },
  { key: "cards", label: "Cartões de Crédito", desc: "Faturas, limites e carteira" },
  { key: "debts", label: "Dívidas & Empréstimos", desc: "Contas a pagar, receber e contratos" },
  { key: "budgets", label: "Orçamentos & Metas", desc: "Limites de gastos e metas de renda" },
  { key: "investments", label: "Investimentos & Carteira", desc: "Posição, proventos e rebalanceamento" },
  { key: "reports", label: "Relatórios Executivos", desc: "DRE, balanço e informes fiscais" },
  { key: "insights", label: "Inteligência & Insights", desc: "Diagnósticos e recomendações" },
  { key: "reminders", label: "Central de Lembretes", desc: "Vencimentos e avisos de contas" },
] as const;

export function UserEditDialog({ user, open, onOpenChange }: UserEditDialogProps) {
  const { role: currentUserRole } = useUserAccess();
  const updateStatusMutation = useAdminUpdateUserStatus();
  const setRoleMutation = useAdminSetUserRole();
  const setOverrideMutation = useAdminSetFeatureOverride();
  const removeOverrideMutation = useAdminRemoveFeatureOverride();
  const featuresQuery = useAdminFeatures();
  const overridesQuery = useUserOverrides(user?.id);

  // Subscriptions & Modular Access
  const subscriptionQuery = useAdminUserSubscription(user?.id);
  const modulePermissionsQuery = useAdminUserModulePermissions(user?.id);
  const setSubscriptionMutation = useAdminSetUserSubscription();
  const setModulePermissionMutation = useAdminSetUserModulePermission();
  const removeModulePermissionMutation = useAdminRemoveUserModulePermission();

  const [status, setStatus] = useState<UserStatus>((user?.status as UserStatus) || "active");
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) || "user");
  const [reason, setReason] = useState(user?.suspended_reason || "");

  // Local state for subscription editing overrides
  const [overrideTier, setOverrideTier] = useState<SubscriptionTier | null>(null);
  const [overridePlanId, setOverridePlanId] = useState<string | null>(null);
  const [overrideSubStatus, setOverrideSubStatus] = useState<string | null>(null);

  const effectiveTier = overrideTier ?? subscriptionQuery.data?.tier ?? "trial";
  const effectivePlanId = overridePlanId ?? subscriptionQuery.data?.plan_id ?? "free";
  const effectiveSubStatus = overrideSubStatus ?? subscriptionQuery.data?.status ?? "active";

  const overridesMap = useMemo(() => {
    const map = new Map<string, UserFeatureOverride>();
    for (const ov of overridesQuery.data ?? []) {
      map.set(ov.feature_key, ov);
    }
    return map;
  }, [overridesQuery.data]);

  const modulePermissionsMap = useMemo(() => {
    const map = new Map<string, UserModulePermission>();
    for (const p of modulePermissionsQuery.data ?? []) {
      map.set(p.module_key, p);
    }
    return map;
  }, [modulePermissionsQuery.data]);

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

  const handleSaveSubscription = async () => {
    try {
      await setSubscriptionMutation.mutateAsync({
        userId: user.id,
        planId: effectivePlanId,
        tier: effectiveTier,
        status: effectiveSubStatus,
      });
    } catch {
      // no-op
    }
  };

  const handleSetModulePermission = async (moduleKey: string, accessLevel: ModuleAccessLevel) => {
    await setModulePermissionMutation.mutateAsync({
      userId: user.id,
      moduleKey,
      accessLevel,
    });
  };

  const handleRemoveModulePermission = async (moduleKey: string) => {
    await removeModulePermissionMutation.mutateAsync({
      userId: user.id,
      moduleKey,
    });
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
      description={`Configurações de plano SaaS, permissões modulares e status da conta para ${user.name || user.email}.`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">
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

        {/* Gestão de Plano & Assinatura SaaS */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/80 bg-surface/80 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-portfolio" aria-hidden="true" />
              <span className="text-xs font-bold text-foreground">
                Plano SaaS &amp; Assinatura
              </span>
            </div>
            {subscriptionQuery.data?.tier === "lifetime" ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-portfolio/10 text-portfolio border border-portfolio/25">
                <Sparkles className="size-3" aria-hidden="true" />
                Vitalício VIP
              </span>
            ) : (
              <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold bg-surface-hover text-muted-foreground border border-border">
                Tier: {subscriptionQuery.data?.tier || "trial"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label htmlFor="target-tier" className="text-xs font-semibold text-foreground">
                Tier de Assinatura
              </label>
              <Select
                value={effectiveTier}
                onValueChange={(val) => {
                  const newTier = val as SubscriptionTier;
                  setOverrideTier(newTier);
                  if (newTier === "lifetime") setOverridePlanId("lifetime_vip");
                  else if (newTier === "pro_monthly") setOverridePlanId("pro_monthly");
                  else if (newTier === "pro_annual") setOverridePlanId("pro_annual");
                  else if (newTier === "trial" || newTier === "read_only") setOverridePlanId("free");
                }}
                options={[
                  { value: "trial", label: "Trial Pro (Período de Teste)" },
                  { value: "lifetime", label: "Plano Vitalício VIP" },
                  { value: "pro_annual", label: "Pro Anual" },
                  { value: "pro_monthly", label: "Pro Mensal" },
                  { value: "read_only", label: "Somente Leitura (Expirado)" },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="target-sub-status" className="text-xs font-semibold text-foreground">
                Status da Assinatura
              </label>
              <Select
                value={effectiveSubStatus}
                onValueChange={(val) => setOverrideSubStatus(val)}
                options={[
                  { value: "active", label: "Ativa (active)" },
                  { value: "trialing", label: "Em Teste (trialing)" },
                  { value: "past_due", label: "Inadimplente (past_due)" },
                  { value: "canceled", label: "Cancelada (canceled)" },
                  { value: "read_only_expired", label: "Modo Leitura (read_only_expired)" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSaveSubscription}
              disabled={setSubscriptionMutation.isPending}
              className="gap-1.5 text-xs h-8 px-3"
            >
              <Crown className="size-3.5" aria-hidden="true" />
              {setSubscriptionMutation.isPending ? "Salvando…" : "Atualizar Plano / Tier"}
            </Button>
          </div>
        </div>

        {/* Permissões Modulares Granulares */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Permissões Modulares Granulares
            </span>
            <span className="text-[11px] text-muted-foreground">
              Permite conceder ou restringir acesso por módulo (ex: Vitalício com apenas Investimentos ou Bloqueio de Cartões).
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {AVAILABLE_MODULES.map((mod) => {
              const override = modulePermissionsMap.get(mod.key);
              const hasOverride = Boolean(override);
              const currentLevel = override?.access_level;

              return (
                <div
                  key={mod.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border/80 bg-surface/80 text-xs shadow-2xs"
                >
                  <div className="flex flex-col gap-1 max-w-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{mod.label}</span>
                      {hasOverride ? (
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            currentLevel === "write" || currentLevel === "admin"
                              ? "bg-positive/10 text-positive-strong border border-positive/25"
                              : currentLevel === "read"
                                ? "bg-warning/10 text-warning border border-warning/25"
                                : "bg-critical/10 text-critical border border-critical/25"
                          }`}
                        >
                          Override: {currentLevel === "write" || currentLevel === "admin" ? "Acesso Total" : currentLevel === "read" ? "Somente Leitura" : "Bloqueado"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold bg-surface-hover text-muted-foreground border border-border">
                          Padrão do Plano
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-1 sm:pt-0">
                    <Button
                      type="button"
                      variant={currentLevel === "write" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSetModulePermission(mod.key, "write")}
                      disabled={setModulePermissionMutation.isPending}
                      className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${
                        currentLevel === "write"
                          ? "bg-positive text-white hover:bg-positive/90"
                          : "text-positive-strong hover:bg-positive/10 border-positive/30"
                      }`}
                      title="Liberar escrita e leitura neste módulo"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Total</span>
                    </Button>

                    <Button
                      type="button"
                      variant={currentLevel === "read" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSetModulePermission(mod.key, "read")}
                      disabled={setModulePermissionMutation.isPending}
                      className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${
                        currentLevel === "read"
                          ? "bg-warning text-white hover:bg-warning/90"
                          : "text-warning hover:bg-warning/10 border-warning/30"
                      }`}
                      title="Restringir a somente leitura neste módulo"
                    >
                      <span>Leitura</span>
                    </Button>

                    <Button
                      type="button"
                      variant={currentLevel === "none" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleSetModulePermission(mod.key, "none")}
                      disabled={setModulePermissionMutation.isPending}
                      className={`gap-1 text-xs h-7 px-2 flex-1 sm:flex-initial justify-center ${
                        currentLevel === "none"
                          ? "bg-critical text-white hover:bg-critical/90"
                          : "text-critical hover:bg-critical/10 border-critical/30"
                      }`}
                      title="Bloquear completamente o módulo para este usuário"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      <span>Bloquear</span>
                    </Button>

                    {hasOverride && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveModulePermission(mod.key)}
                        disabled={removeModulePermissionMutation.isPending}
                        className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Restaurar regra padrão do plano"
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

        {/* Status da Conta */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
          <label htmlFor="user-status" className="text-xs font-semibold text-foreground">
            Status da Conta na Plataforma
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
              Nível de Permissão Administrativa (Role)
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

        {/* Overrides de Kill-Switches e Features Globais */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Kill-Switches &amp; Features do Sistema
            </span>
            <span className="text-[11px] text-muted-foreground">
              Overrides individuais de Kill-Switches de sistema.
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
            Salvar Status &amp; Cargo
          </Button>
        </div>

      </form>
    </Modal>
  );
}
