import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  adminCreateInvite as adminCreateInviteRpc,
  adminDeleteUser as adminDeleteUserRpc,
  adminGetMetrics as adminGetMetricsRpc,
  adminListPastDueSubscriptions,
  adminListUsers as adminListUsersRpc,
  adminPreviewGlobalFeatureImpact,
  adminRemoveFeatureOverride as adminRemoveFeatureOverrideRpc,
  adminRevokeInvite as adminRevokeInviteRpc,
  adminSetFeatureOverride as adminSetFeatureOverrideRpc,
  adminSetUserRole as adminSetUserRoleRpc,
  adminToggleGlobalFeature as adminToggleGlobalFeatureRpc,
  adminUpdateUserStatus as adminUpdateUserStatusRpc,
  adminGetUserContactDetails,
  adminSendBroadcastNotification,
  getMyBroadcastNotifications,
  markBroadcastAsRead,
  dismissBroadcastNotification,
  adminLogSystemBackup,
  adminGetConnectionsHealth,
  adminGetAiUsageSummary,
  adminGetUserSupportDiagnostics,
  adminGetRetentionRadar,
  type AdminAiUsageSummaryParams,
  type AdminListUsersParams,
  type AdminMetricsResult,
  type AdminUserRow,
} from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type {
  AccessInvite,
  AuditEvent,
  SystemFeature,
  UserFeatureOverride,
  SystemBackup,
  AdminBroadcastNotification,
  SubscriptionTier,
} from "@/types";

/**
 * Consulta todas as funcionalidades do sistema cadastradas.
 */
export async function listSystemFeatures(): Promise<SystemFeature[]> {
  const { data, error } = await resolveQuery<SystemFeature[]>(
    getSupabase()
      .from("system_features")
      .select("*")
      .order("name", { ascending: true }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Consulta os overrides de features de um usuário específico.
 */
export async function listUserFeatureOverrides(userId: string): Promise<UserFeatureOverride[]> {
  const { data, error } = await resolveQuery<UserFeatureOverride[]>(
    getSupabase()
      .from("user_feature_overrides")
      .select("*")
      .eq("user_id", userId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Lista todos os convites de acesso gerados.
 */
export async function listAccessInvites(): Promise<AccessInvite[]> {
  const { data, error } = await resolveQuery<AccessInvite[]>(
    getSupabase()
      .from("access_invites")
      .select("*")
      .order("created_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

export interface ListAuditEventsParams {
  limit?: number;
  offset?: number;
  action?: string | null;
  entityType?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}

/**
 * Consulta logs de auditoria do sistema com filtros e paginação.
 */
export async function listAuditEvents(
  paramsOrLimit: number | ListAuditEventsParams = 100,
): Promise<AuditEvent[]> {
  const params: ListAuditEventsParams =
    typeof paramsOrLimit === "number" ? { limit: paramsOrLimit } : paramsOrLimit;
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  let query = getSupabase()
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.action) {
    query = query.ilike("action", `%${params.action}%`);
  }
  if (params.entityType) {
    query = query.eq("entity_type", params.entityType);
  }
  if (params.fromDate) {
    query = query.gte("created_at", `${params.fromDate}T00:00:00.000Z`);
  }
  if (params.toDate) {
    query = query.lte("created_at", `${params.toDate}T23:59:59.999Z`);
  }

  const { data, error } = await resolveQuery<AuditEvent[]>(
    query.range(offset, offset + limit - 1),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Consulta o histórico de backups registrados na plataforma.
 */
export async function listSystemBackups(limit = 50): Promise<SystemBackup[]> {
  const { data, error } = await resolveQuery<SystemBackup[]>(
    getSupabase()
      .from("system_backups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Consulta as notificações de broadcast cadastradas pelo administrador.
 */
export async function listBroadcastNotifications(limit = 50): Promise<AdminBroadcastNotification[]> {
  const { data, error } = await resolveQuery<AdminBroadcastNotification[]>(
    getSupabase()
      .from("admin_broadcast_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

export interface AdminProvisionUserParams {
  name: string;
  email: string;
  phone?: string | null;
  role?: "user" | "admin" | "superadmin";
  plan_id?: string;
  status?: "active" | "pending_approval";
}

export interface AdminProvisionUserResult {
  success: boolean;
  userId: string;
  email: string;
  actionLink: string | null;
}

/**
 * Provisiona um novo usuário diretamente pelo Superadmin com geração de link de ativação/senha.
 */
export async function adminProvisionUser(
  params: AdminProvisionUserParams,
): Promise<AdminProvisionUserResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "provision_user",
      ...params,
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao provisionar usuário.";
    throw new AppError("network", errorMsg);
  }

  return data as AdminProvisionUserResult;
}

export interface AdminPortalGrantStatus {
  granted: boolean;
  portalScope: string | null;
  expiresAt: string | null;
  reason: string | null;
}

export type AdminStepUpOperation =
  | "delete_user"
  | "restore_user"
  | "reset_mfa"
  | "revoke_sessions";

export interface AdminStepUpChallenge {
  challengeId: string;
  stepUpToken: string;
  operation: AdminStepUpOperation;
  targetRef: string;
  expiresAt: string;
}

/**
 * Valida se a sessão administrativa atual possui concessão ativa no portal isolado (private_auth).
 * Opera em modo fail-closed: retorna `granted: false` em caso de ausência de concessão ou erro.
 */
export async function checkAdminPortalGrant(): Promise<AdminPortalGrantStatus> {
  const { data, error } = await resolveQuery<{
    granted?: boolean;
    portal_scope?: string | null;
    expires_at?: string | null;
    reason?: string | null;
  }>(getSupabase().rpc("admin_check_portal_grant" as never));

  if (error || !data?.granted) {
    return {
      granted: false,
      portalScope: null,
      expiresAt: null,
      reason: error ? "rpc_error" : (data?.reason ?? "portal_grant_missing"),
    };
  }

  return {
    granted: true,
    portalScope: data.portal_scope ?? "admin_portal",
    expiresAt: data.expires_at ?? null,
    reason: null,
  };
}

/**
 * Emite um desafio de step-up de uso único (validade de 5 minutos) vinculado à operação e ao alvo.
 */
export async function issueAdminStepUpChallenge(
  operation: AdminStepUpOperation,
  targetRef: string,
): Promise<AdminStepUpChallenge> {
  const { data, error } = await resolveQuery<{
    challenge_id: string;
    step_up_token: string;
    operation: AdminStepUpOperation;
    target_ref: string;
    expires_at: string;
  }>(
    getSupabase().rpc(
      "admin_issue_step_up_challenge" as never,
      { p_operation: operation, p_target_ref: targetRef } as never,
    ),
  );

  if (error || !data?.step_up_token) {
    const classified = classifyError(error ?? new Error("Falha ao emitir desafio step-up."));
    throw new AppError(classified.kind, classified.message, error);
  }

  return {
    challengeId: data.challenge_id,
    stepUpToken: data.step_up_token,
    operation: data.operation,
    targetRef: data.target_ref,
    expiresAt: data.expires_at,
  };
}

/**
 * Remove e desativa compulsoriamente os fatores 2FA/MFA de uma conta (Incidente 4 do Runbook).
 */
export async function adminResetUserMFA(userId: string, stepUpToken?: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "reset_mfa",
      target_user_id: userId,
      ...(stepUpToken ? { step_up_token: stepUpToken } : {}),
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao resetar autenticador 2FA.";
    throw new AppError("network", errorMsg);
  }

  return true;
}

/**
 * Encerra todas as sessões ativas (tokens de acesso) de um usuário específico em todos os dispositivos.
 */
export async function adminRevokeUserSessions(userId: string, stepUpToken?: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "revoke_sessions",
      target_user_id: userId,
      ...(stepUpToken ? { step_up_token: stepUpToken } : {}),
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao revogar sessões ativas.";
    throw new AppError("network", errorMsg);
  }

  return true;
}

/**
 * Gera um link temporário assinado de recuperação/acesso para suporte técnico via WhatsApp.
 */
export async function adminGenerateRecoveryLink(
  userId: string,
  email: string,
): Promise<{ sentToVerifiedEmail: boolean }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "generate_recovery_link",
      target_user_id: userId,
      email,
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao enviar recuperação para o e-mail verificado.";
    throw new AppError("network", errorMsg);
  }

  return { sentToVerifiedEmail: Boolean(data.sentToVerifiedEmail ?? true) };
}

/**
 * Configura a política de tolerância (manual vs. bloqueio automático em N dias) e lembretes semanais.
 */
export async function adminSetPastDuePolicy(params: {
  userId: string;
  graceMode: "manual" | "auto";
  autoBlockDays?: number | null;
  remindersEnabled?: boolean;
}): Promise<{ message: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "set_past_due_policy",
      target_user_id: params.userId,
      grace_mode: params.graceMode,
      auto_block_days: params.autoBlockDays ?? null,
      reminders_enabled: params.remindersEnabled,
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao atualizar política de carência.";
    throw new AppError("network", errorMsg);
  }

  return { message: data.message as string };
}

/**
 * Força o bloqueio imediato de uma assinatura em atraso para modo somente-leitura.
 */
export async function adminBlockPastDueNow(userId: string): Promise<{ message: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "block_past_due_now",
      target_user_id: userId,
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao bloquear conta em atraso.";
    throw new AppError("network", errorMsg);
  }

  return { message: data.message as string };
}

/**
 * Envia um aviso oficial do aplicativo (template pré-pronto) para usuário em atraso.
 */
export async function adminSendPastDueReminder(params: {
  userId: string;
  preset: "friendly" | "update_card" | "final_warning";
}): Promise<{ message: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "send_past_due_reminder",
      target_user_id: params.userId,
      preset: params.preset,
    },
  });

  if (error || !data?.success) {
    const errorMsg = data?.error || error?.message || "Falha ao enviar lembrete oficial.";
    throw new AppError("network", errorMsg);
  }

  return { message: data.message as string };
}


export interface AdminSubscriptionSummaryRow {
  id: string;
  user_id: string;
  plan_id: string;
  tier: SubscriptionTier;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  asaas_subscription_id: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * Lista assinaturas da plataforma para visão consolidada de faturamento.
 */
export async function listAdminSubscriptions(limit = 200): Promise<AdminSubscriptionSummaryRow[]> {
  const { data, error } = await resolveQuery<AdminSubscriptionSummaryRow[]>(
    getSupabase()
      .from("user_subscriptions")
      .select("id, user_id, plan_id, tier, status, trial_ends_at, current_period_end, asaas_subscription_id, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Encerra imediatamente um comunicado broadcast definindo expires_at para agora.
 */
export async function adminExpireBroadcastNotification(notificationId: string): Promise<void> {
  const { error } = await resolveQuery<unknown>(
    getSupabase()
      .from("admin_broadcast_notifications")
      .update({ expires_at: new Date().toISOString() } as never)
      .eq("id", notificationId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Exclui permanentemente um comunicado broadcast.
 */
export async function adminDeleteBroadcastNotification(notificationId: string): Promise<void> {
  const { error } = await resolveQuery<unknown>(
    getSupabase()
      .from("admin_broadcast_notifications")
      .delete()
      .eq("id", notificationId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

// Re-export das operações administrativas transacionais
export {
  adminCreateInviteRpc as adminCreateInvite,
  adminDeleteUserRpc as adminDeleteUser,
  adminGetMetricsRpc as adminGetMetrics,
  adminListPastDueSubscriptions,
  adminListUsersRpc as adminListUsers,
  adminPreviewGlobalFeatureImpact,
  adminRemoveFeatureOverrideRpc as adminRemoveFeatureOverride,
  adminRevokeInviteRpc as adminRevokeInvite,
  adminSetFeatureOverrideRpc as adminSetFeatureOverride,
  adminSetUserRoleRpc as adminSetUserRole,
  adminToggleGlobalFeatureRpc as adminToggleGlobalFeature,
  adminUpdateUserStatusRpc as adminUpdateUserStatus,
  adminGetUserContactDetails,
  adminSendBroadcastNotification,
  getMyBroadcastNotifications,
  markBroadcastAsRead,
  dismissBroadcastNotification,
  adminLogSystemBackup,
  adminGetConnectionsHealth,
  adminGetAiUsageSummary,
  adminGetUserSupportDiagnostics,
  adminGetRetentionRadar,
  type AdminAiUsageSummaryParams,
  type AdminListUsersParams,
  type AdminMetricsResult,
  type AdminUserRow,
};


