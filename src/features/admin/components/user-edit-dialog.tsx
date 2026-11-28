import { useMemo, useState, type FormEvent } from "react";
import { Activity, Crown, KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import { Button, ConfirmDialog, Modal, ModalFooter, Tabs } from "@/components/ui";
import { canManageRole, canManageUserStatus } from "@/domain/admin";
import { useAuth } from "@/hooks/use-auth";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useAdminDeleteUser,
  useAdminQuarantineUser,
  useAdminRemoveUserModulePermission,
  useAdminRestoreUser,
  useAdminSetUserModulePermission,
  useAdminSetUserRole,
  useAdminSetUserSubscription,
  useAdminSetUserTestFlag,
  useAdminUpdateUserStatus,
  useAdminUserModulePermissions,
  useAdminUserSubscription,
  useUserAccess,
} from "@/state";
import type { AdminUserRow, ModuleAccessLevel, SubscriptionTier, UserModulePermission, UserRole, UserStatus } from "@/types";
import {
  CORE_MODULES,
  INVESTMENT_ONLY_PRESET,
  UserAccountStatusSection,
  UserModulePermissionsMatrix,
  UserPiiAuditVaultCard,
  UserSaasPlanSection,
  UserSuperadminSupportActions,
  UserSupportDiagnosticsCard,
} from "./user-edit";

export interface UserEditDialogProps {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Diálogo administrativo de edição completa de usuário, plano, permissões e suporte. */
export function UserEditDialog({ user, open, onOpenChange }: UserEditDialogProps) {
  if (!user) return null;
  return <UserEditDialogContent key={user.id} user={user} open={open} onOpenChange={onOpenChange} />;
}

function UserEditDialogContent({ user, open, onOpenChange }: { user: AdminUserRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user: authUser } = useAuth();
  const { role: currentUserRole, profile: currentProfile, inspectedAccessSources } = useUserAccess(
    undefined,
    { inspectUserId: open ? user.id : undefined },
  );
  const updateStatusMutation = useAdminUpdateUserStatus();
  const setRoleMutation = useAdminSetUserRole();
  const setTestFlagMutation = useAdminSetUserTestFlag();
  const quarantineUserMutation = useAdminQuarantineUser();
  const restoreUserMutation = useAdminRestoreUser();
  const deleteUserMutation = useAdminDeleteUser();
  const subscriptionQuery = useAdminUserSubscription(user.id);
  const modulePermissionsQuery = useAdminUserModulePermissions(user.id);
  const setSubscriptionMutation = useAdminSetUserSubscription();
  const setModulePermissionMutation = useAdminSetUserModulePermission();
  const removeModulePermissionMutation = useAdminRemoveUserModulePermission();

  const [activeTab, setActiveTab] = useState("plan");
  const [status, setStatus] = useState<UserStatus>((user.status as UserStatus) || "active");
  const [role, setRole] = useState<UserRole>((user.role as UserRole) || "user");
  const [reason, setReason] = useState(user.suspended_reason || "");
  const [isTest, setIsTest] = useState(Boolean(user.is_test));
  const [isQuarantineDialogOpen, setIsQuarantineDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [revealContact, setRevealContact] = useState(false);
  const [overrideTier, setOverrideTier] = useState<SubscriptionTier | null>(null);
  const [overridePlanId, setOverridePlanId] = useState<string | null>(null);
  const [overrideSubStatus, setOverrideSubStatus] = useState<string | null>(null);
  const [overrideTrialEndsAt, setOverrideTrialEndsAt] = useState<string | undefined>(undefined);
  const [overridePeriodEnd, setOverridePeriodEnd] = useState<string | undefined>(undefined);
  const [isQuickActionPending, setIsQuickActionPending] = useState(false);
  const [prevKey, setPrevKey] = useState(`${open}:${user.id}`);

  if (prevKey !== `${open}:${user.id}`) {
    setPrevKey(`${open}:${user.id}`);
    setActiveTab("plan");
    setStatus((user.status as UserStatus) || "active");
    setRole((user.role as UserRole) || "user");
    setReason(user.suspended_reason || "");
    setIsTest(Boolean(user.is_test));
    setRevealContact(false);
    setOverrideTier(null);
    setOverridePlanId(null);
    setOverrideSubStatus(null);
    setOverrideTrialEndsAt(undefined);
    setOverridePeriodEnd(undefined);
    setIsQuarantineDialogOpen(false);
    setIsRestoreDialogOpen(false);
    setIsDeleteDialogOpen(false);
  }

  const effectiveTier = overrideTier ?? subscriptionQuery.data?.tier ?? "trial";
  const effectivePlanId = overridePlanId ?? subscriptionQuery.data?.plan_id ?? "trial";
  const effectiveSubStatus = overrideSubStatus ?? subscriptionQuery.data?.status ?? "active";
  const effectiveTrialEndsAt = overrideTrialEndsAt ?? toDateInputValue(subscriptionQuery.data?.trial_ends_at);
  const effectivePeriodEnd = overridePeriodEnd ?? toDateInputValue(subscriptionQuery.data?.current_period_end);

  const userModulePermissions = useMemo(() => modulePermissionsQuery.data ?? [], [modulePermissionsQuery.data]);
  const coreOverrides = useMemo(() => userModulePermissions.filter((p) => CORE_MODULES.some((c) => c.key === p.module_key)), [userModulePermissions]);
  const modulePermissionsMap = useMemo(() => {
    const map = new Map<string, UserModulePermission>();
    for (const p of userModulePermissions) map.set(p.module_key, p);
    return map;
  }, [userModulePermissions]);

  const targetRole = user.role as UserRole;
  const isSuperadminActor = currentUserRole === "superadmin";
  const isSelf = user.id === authUser?.id || user.id === currentProfile?.id;
  const canEditStatus = canManageUserStatus(currentUserRole, targetRole);
  const canEditRole = canManageRole(currentUserRole, targetRole);
  const displayName = user.name || user.email;
  const aiOverride = inspectedAccessSources?.overrides?.find((item) => item.feature_key === "ai_extraction");

  const handleSetModulePermission = (moduleKey: string, accessLevel: ModuleAccessLevel) => {
    const params = moduleKey === "ai_extraction"
      ? { userId: user.id, featureKey: moduleKey, enabled: accessLevel !== "none" } as const
      : { userId: user.id, moduleKey, accessLevel };
    setModulePermissionMutation.mutateAsync(params).catch(() => undefined);
  };

  const handleRemoveModulePermission = (moduleKey: string) => {
    const params = moduleKey === "ai_extraction" && aiOverride
      ? { userId: user.id, featureKey: moduleKey } as const
      : { userId: user.id, moduleKey };
    removeModulePermissionMutation.mutateAsync(params).catch(() => undefined);
  };


  const handleToggleTestFlag = async (nextIsTest: boolean) => {
    setIsTest(nextIsTest);
    try {
      await setTestFlagMutation.mutateAsync({ userId: user.id, isTest: nextIsTest });
    } catch {
      setIsTest(!nextIsTest);
      triggerSensory("destructive");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (status !== user.status && canEditStatus) {
        await updateStatusMutation.mutateAsync({ userId: user.id, status, reason: reason.trim() || null });
      }
      if (role !== user.role && canEditRole) await setRoleMutation.mutateAsync({ userId: user.id, role });
      triggerSensory("success");
      pushToast({ title: "Usuário atualizado", description: `Status e privilégios de ${displayName} salvos com sucesso.` });
      onOpenChange(false);
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleSaveSubscription = async () => {
    try {
      await setSubscriptionMutation.mutateAsync({
        userId: user.id,
        planId: effectivePlanId,
        tier: effectiveTier,
        status: effectiveSubStatus,
        ...(overrideTrialEndsAt !== undefined
          ? { trialEndsAt: overrideTrialEndsAt ? `${overrideTrialEndsAt}T23:59:59.000Z` : null }
          : {}),
        ...(overridePeriodEnd !== undefined
          ? { currentPeriodEnd: overridePeriodEnd ? `${overridePeriodEnd}T23:59:59.000Z` : null }
          : {}),
      });
      if (coreOverrides.length > 0) {
        await Promise.all(coreOverrides.map((p) => removeModulePermissionMutation.mutateAsync({ userId: user.id, moduleKey: p.module_key })));
      }
      triggerSensory("success");
      pushToast({ title: "Plano SaaS atualizado", description: `Assinatura de ${displayName} atualizada para ${effectiveTier}. Permissões atualizadas automaticamente.` });
    } catch {
      triggerSensory("destructive");
    }
  };

  const runQuickPreset = async (fn: () => Promise<unknown>, title: string, description: string) => {
    setIsQuickActionPending(true);
    try {
      await fn();
      triggerSensory("success");
      pushToast({ title, description });
    } catch {
      triggerSensory("destructive");
    } finally {
      setIsQuickActionPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerenciar Usuário"
      description={`Configurações de plano SaaS, permissões modulares e status da conta para ${displayName}.`}
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button type="submit" form="user-edit-form" variant="default" sensoryIntent={false} disabled={updateStatusMutation.isPending || setRoleMutation.isPending}>
            <UserCheck aria-hidden="true" />
            <span>Salvar Status &amp; Cargo</span>
          </Button>
        </ModalFooter>
      }
    >
      <form id="user-edit-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          forceMount
          ariaLabel="Seções de edição do usuário"
          items={[
            {
              value: "plan",
              label: "Resumo & Plano",
              shortLabel: "Plano",
              icon: <Crown aria-hidden="true" />,
              content: (
                <div className="flex flex-col gap-4">
                  <UserPiiAuditVaultCard user={user} revealContact={revealContact} onRevealChange={setRevealContact} />
                  <UserSaasPlanSection
                    currentTier={subscriptionQuery.data?.tier}
                    effectiveTier={effectiveTier}
                    effectiveSubStatus={effectiveSubStatus}
                    isSaving={setSubscriptionMutation.isPending}
                    currentPeriodEnd={subscriptionQuery.data?.current_period_end}
                    trialEndsAt={subscriptionQuery.data?.trial_ends_at}
                    effectiveTrialEndsAt={effectiveTrialEndsAt}
                    effectivePeriodEnd={effectivePeriodEnd}
                    cardLast4={subscriptionQuery.data?.card_last4}
                    asaasSubscriptionId={subscriptionQuery.data?.asaas_subscription_id}
                    onTierChange={(newTier, planId) => { setOverrideTier(newTier); setOverridePlanId(planId); }}
                    onSubStatusChange={setOverrideSubStatus}
                    onTrialEndsAtChange={setOverrideTrialEndsAt}
                    onPeriodEndChange={setOverridePeriodEnd}
                    onSaveSubscription={handleSaveSubscription}
                  />
                </div>
              ),
            },
            {
              value: "permissions",
              label: "Permissões",
              icon: <KeyRound aria-hidden="true" />,
              content: (
                <UserModulePermissionsMatrix
                  effectiveSubStatus={subscriptionQuery.data?.status ?? "active"}
                  hasAnyModuleOverride={userModulePermissions.length > 0 || Boolean(aiOverride)}
                  hasCoreOverrides={coreOverrides.length > 0}
                  modulePermissionsMap={modulePermissionsMap}
                  accessSources={inspectedAccessSources}
                  isQuickActionPending={isQuickActionPending}
                  isMutating={setModulePermissionMutation.isPending || removeModulePermissionMutation.isPending}
                  onSetModulePermission={handleSetModulePermission}
                  onRemoveModulePermission={handleRemoveModulePermission}
                  onQuickOnlyInvestments={() => void runQuickPreset(() => Promise.all(INVESTMENT_ONLY_PRESET.map((item) => setModulePermissionMutation.mutateAsync({ userId: user.id, moduleKey: item.moduleKey, accessLevel: item.accessLevel }))), "Apenas Investimentos configurado", `Usuário ${displayName} configurado em Apenas Investimentos. Modo Viagem e Familiar restritos; relatórios de carteira liberados.`)}
                  onQuickRestorePlanDefaults={() => void runQuickPreset(
                    () => Promise.all([
                      ...userModulePermissions.map((permission) => removeModulePermissionMutation.mutateAsync({
                        userId: user.id,
                        moduleKey: permission.module_key,
                      })),
                      ...(aiOverride ? [removeModulePermissionMutation.mutateAsync({
                        userId: user.id,
                        featureKey: "ai_extraction",
                      })] : []),
                    ]),
                    "Padrão do plano restaurado",
                    `As permissões de ${displayName} voltaram ao plano base.`,
                  )}
                />
              ),
            },
            {
              value: "account",
              label: "Conta & Suporte",
              shortLabel: "Conta",
              icon: <ShieldCheck aria-hidden="true" />,
              content: (
                <div className="flex flex-col gap-4">
                  <UserAccountStatusSection
                    status={status}
                    reason={reason}
                    role={role}
                    isTest={isTest}
                    deletedAt={user.deleted_at}
                    quarantineReason={user.suspended_reason}
                    canEditStatus={canEditStatus}
                    canEditRole={canEditRole}
                    canDeleteUser={isSuperadminActor && !isSelf}
                    isSuperadminActor={isSuperadminActor}
                    isTestPending={setTestFlagMutation.isPending}
                    isQuarantinePending={quarantineUserMutation.isPending}
                    isRestorePending={restoreUserMutation.isPending}
                    isDeletePending={deleteUserMutation.isPending}
                    onStatusChange={setStatus}
                    onReasonChange={setReason}
                    onRoleChange={setRole}
                    onToggleTestFlag={(nextIsTest) => void handleToggleTestFlag(nextIsTest)}
                    onOpenQuarantineConfirm={() => setIsQuarantineDialogOpen(true)}
                    onOpenRestoreConfirm={() => setIsRestoreDialogOpen(true)}
                    onOpenDeleteConfirm={() => setIsDeleteDialogOpen(true)}
                  />
                  {isSuperadminActor && <UserSuperadminSupportActions user={user} revealContact={revealContact} />}
                </div>
              ),
            },
            {
              value: "diagnostics",
              label: "Raio-X",
              icon: <Activity aria-hidden="true" />,
              content: <UserSupportDiagnosticsCard userId={user.id} enabled={open && activeTab === "diagnostics"} />,
            },
          ]}
        />
      </form>
      <ConfirmDialog
        open={isQuarantineDialogOpen}
        onOpenChange={setIsQuarantineDialogOpen}
        title="Colocar Usuário em Quarentena"
        description={`Tem certeza que deseja colocar ${displayName} em quarentena? O acesso será bloqueado imediatamente e os dados financeiros serão preservados até uma eventual restauração ou exclusão definitiva.`}
        confirmLabel={quarantineUserMutation.isPending ? "Colocando em quarentena…" : "Colocar em Quarentena"}
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={quarantineUserMutation.isPending}
        elevated
        onConfirm={async () => {
          try {
            await quarantineUserMutation.mutateAsync({ targetUserId: user.id, reason: reason.trim() || null });
            setIsQuarantineDialogOpen(false);
            onOpenChange(false);
          } catch {
            triggerSensory("destructive");
          }
        }}
      />
      <ConfirmDialog
        open={isRestoreDialogOpen}
        onOpenChange={setIsRestoreDialogOpen}
        title="Restaurar Acesso do Usuário"
        description={`Deseja restaurar o acesso da conta de ${displayName}? O usuário sairá da quarentena e poderá voltar a acessar a plataforma.`}
        confirmLabel={restoreUserMutation.isPending ? "Restaurando…" : "Restaurar Acesso"}
        cancelLabel="Cancelar"
        variant="default"
        confirmPending={restoreUserMutation.isPending}
        elevated
        onConfirm={async () => {
          try {
            await restoreUserMutation.mutateAsync({ targetUserId: user.id });
            setIsRestoreDialogOpen(false);
            onOpenChange(false);
          } catch {
            triggerSensory("destructive");
          }
        }}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Excluir Usuário do Sistema"
        description={`Tem certeza que deseja excluir permanentemente o usuário ${displayName}? Todos os dados financeiros, cartões, dívidas, categorias e histórico deste usuário serão permanentemente apagados e o e-mail será liberado no banco de dados. Esta ação não poderá ser desfeita.`}
        confirmLabel={deleteUserMutation.isPending ? "Excluindo…" : "Excluir Definitivamente"}
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={deleteUserMutation.isPending}
        elevated
        onConfirm={async () => {
          try {
            await deleteUserMutation.mutateAsync({ targetUserId: user.id });
            setIsDeleteDialogOpen(false);
            onOpenChange(false);
          } catch {
            triggerSensory("destructive");
          }
        }}
      />
    </Modal>
  );
}
