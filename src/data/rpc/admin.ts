import { callRpc, unwrapRpc } from "./client";
import type {
  AdminContactDetails,
  BroadcastAudience,
  BroadcastType,
  UserBroadcastNotification,
} from "@/types";

/**
 * Consulta o mapa de funcionalidades ativas/resolvidas para o usuário atual.
 */
export async function getMyFeatures(): Promise<Record<string, boolean>> {
  return unwrapRpc(callRpc("get_my_features", {}));
}

export interface AdminListUsersParams {
  search?: string | null;
  status?: string | null;
  role?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  suspended_reason: string | null;
  total_count: number;
}

/**
 * Lista usuários para o painel administrativo com paginação e filtros.
 */
export async function adminListUsers(params: AdminListUsersParams = {}): Promise<AdminUserRow[]> {
  return unwrapRpc(
    callRpc("admin_list_users", {
      p_search: params.search ?? null,
      p_status: params.status ?? null,
      p_role: params.role ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    }),
  );
}

/**
 * Altera o status da conta de um usuário (Aprovação, Suspensão, Banimento, Reativação).
 */
export async function adminUpdateUserStatus(params: {
  userId: string;
  status: string;
  reason?: string | null;
  approvedBy?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_update_user_status", {
      p_user_id: params.userId,
      p_status: params.status,
      p_reason: params.reason ?? null,
    }),
    true,
  );
}

/**
 * Altera o papel / role de um usuário (Superadmin only).
 */
export async function adminSetUserRole(params: {
  userId: string;
  role: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_role", {
      p_user_id: params.userId,
      p_role: params.role,
    }),
    true,
  );
}

/**
 * Aplica um override personalizado de feature flag para um usuário.
 */
export async function adminSetFeatureOverride(params: {
  userId: string;
  featureKey: string;
  enabled: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_enabled: params.enabled,
    }),
    true,
  );
}

/**
 * Remove o override de feature flag de um usuário (revertendo ao padrão global).
 */
export async function adminRemoveFeatureOverride(params: {
  userId: string;
  featureKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
    }),
    true,
  );
}

/**
 * Alterna a ativação global de uma funcionalidade (Kill-Switch).
 */
export async function adminToggleGlobalFeature(params: {
  featureKey: string;
  enabled: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_toggle_global_feature", {
      p_feature_key: params.featureKey,
      p_enabled: params.enabled,
    }),
    true,
  );
}

/**
 * Cria um novo convite de acesso na allowlist.
 */
export async function adminCreateInvite(params: {
  code: string;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_invite", {
      p_code: params.code,
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
    }),
  );
}

/**
 * Revoga um convite de acesso.
 */
export async function adminRevokeInvite(params: { inviteId: string }): Promise<void> {
  await unwrapRpc(
    callRpc("admin_revoke_invite", {
      p_invite_id: params.inviteId,
    }),
    true,
  );
}

export interface AdminMetricsResult {
  total_users: number;
  active_users: number;
  pending_users: number;
  suspended_users: number;
  total_invites: number;
  used_invites: number;
}

/**
 * Obtém métricas executivas do SaaS para a aba de Visão Geral.
 */
export async function adminGetMetrics(): Promise<AdminMetricsResult> {
  return unwrapRpc(callRpc("admin_get_metrics", {}));
}

/**
 * Consulta agregada de status da assinatura e permissões do usuário autenticado.
 */
export async function getMySubscription(): Promise<{
  tier: string;
  status: string;
  plan_id: string;
  starts_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  trial_days_remaining: number | null;
  cancel_at_period_end: boolean;
  is_full_access: boolean;
  is_trial: boolean;
  is_pro: boolean;
  is_lifetime: boolean;
  is_read_only: boolean;
  can_write: boolean;
  has_card_registered?: boolean;
  has_auto_renew?: boolean;
  asaas_subscription_id?: string | null;
  module_permissions: Record<string, string>;
} | null> {
  return unwrapRpc(callRpc("get_my_subscription", {}), true);
}

/**
 * Superadmin ou Admin altera o plano/tier/status da assinatura de um usuário.
 */
export async function adminSetUserSubscription(params: {
  userId: string;
  planId: string;
  tier: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_subscription", {
      p_user_id: params.userId,
      p_plan_id: params.planId,
      p_tier: params.tier,
      p_status: params.status,
      p_trial_ends_at: params.trialEndsAt ?? null,
      p_current_period_end: params.currentPeriodEnd ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin define override de permissão por módulo para um usuário.
 */
export async function adminSetUserModulePermission(params: {
  userId: string;
  moduleKey: string;
  accessLevel: string;
  expiresAt?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
      p_access_level: params.accessLevel,
      p_expires_at: params.expiresAt ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin remove override de permissão de módulo para um usuário.
 */
export async function adminRemoveUserModulePermission(params: {
  userId: string;
  moduleKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
    }),
    true,
  );
}

/**
 * Criação de convite avançado com preset de plano e matriz de módulos.
 */
export async function adminCreateModularInvite(params: {
  code: string;
  targetTier?: string;
  customTrialDays?: number | null;
  moduleGrants?: Record<string, string>;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
  notes?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_modular_invite", {
      p_code: params.code,
      p_target_tier: params.targetTier ?? "trial",
      p_custom_trial_days: params.customTrialDays ?? null,
      p_module_grants: params.moduleGrants ?? {},
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
      p_notes: params.notes ?? null,
    }),
  );
}

/**
 * Exclui a conta do usuário autenticado e todos os seus dados em ordem topológica reversa (LGPD Art. 18, VI).
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  await unwrapRpc(callRpc("delete_current_user_account", {}), true);
}

/**
 * Alias de retrocompatibilidade para deleteCurrentUserAccount().
 */
export async function deleteOwnAccount(): Promise<void> {
  return deleteCurrentUserAccount();
}

/**
 * Superadmin exclui definitivamente um usuário e todos os seus dados do sistema.
 */
export async function adminDeleteUser(params: { targetUserId: string }): Promise<void> {
  await unwrapRpc(
    callRpc("admin_delete_user", {
      target_user_id: params.targetUserId,
    }),
    true,
  );
}

/**
 * Consulta auditada dos dados de contato de um usuário pelo Administrador (LGPD Art. 18).
 */
export async function adminGetUserContactDetails(userId: string): Promise<AdminContactDetails> {
  return unwrapRpc(
    callRpc("admin_get_user_contact_details" as never, {
      p_user_id: userId,
    } as never),
  );
}

/**
 * Envia uma notificação administrativa de broadcast / push direto aos clientes.
 */
export async function adminSendBroadcastNotification(params: {
  title: string;
  message: string;
  type?: BroadcastType;
  actionUrl?: string | null;
  targetAudience?: BroadcastAudience;
  targetUserIds?: string[] | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_send_broadcast_notification" as never, {
      p_title: params.title,
      p_message: params.message,
      p_type: params.type ?? "info",
      p_action_url: params.actionUrl ?? null,
      p_target_audience: params.targetAudience ?? "all",
      p_target_user_ids: params.targetUserIds ?? null,
    } as never),
  );
}

/**
 * Consulta as notificações de broadcast ativas e relevantes para o usuário autenticado.
 */
export async function getMyBroadcastNotifications(limit = 20): Promise<UserBroadcastNotification[]> {
  const result = await unwrapRpc(
    callRpc("get_my_broadcast_notifications" as never, {
      p_limit: limit,
    } as never),
  );
  return (result ?? []) as UserBroadcastNotification[];
}

/**
 * Marca uma notificação broadcast como lida pelo usuário.
 */
export async function markBroadcastAsRead(notificationId: string): Promise<void> {
  await unwrapRpc(
    callRpc("mark_broadcast_as_read" as never, {
      p_notification_id: notificationId,
    } as never),
  );
}

/**
 * Registra um snapshot/backup do sistema pelo Administrador.
 */
export async function adminLogSystemBackup(params: {
  backupType?: "manual" | "scheduled" | "pre_migration";
  tableCount?: number;
  recordCount?: number;
  fileSizeBytes?: number;
  checksumSha256?: string;
  status?: "in_progress" | "completed" | "failed";
  notes?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_log_system_backup" as never, {
      p_backup_type: params.backupType ?? "manual",
      p_table_count: params.tableCount ?? 0,
      p_record_count: params.recordCount ?? 0,
      p_file_size_bytes: params.fileSizeBytes ?? 0,
      p_checksum_sha256: params.checksumSha256 ?? "",
      p_status: params.status ?? "completed",
      p_notes: params.notes ?? null,
    } as never),
  );
}
