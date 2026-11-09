import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  adminCreateInvite as adminCreateInviteRpc,
  adminDeleteUser as adminDeleteUserRpc,
  adminGetMetrics as adminGetMetricsRpc,
  adminListUsers as adminListUsersRpc,
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
  adminLogSystemBackup,
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

/**
 * Consulta logs de auditoria recentes do sistema.
 */
export async function listAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const { data, error } = await resolveQuery<AuditEvent[]>(
    getSupabase()
      .from("audit_events")
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

/**
 * Remove e desativa compulsoriamente os fatores 2FA/MFA de uma conta (Incidente 4 do Runbook).
 */
export async function adminResetUserMFA(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "reset_mfa",
      target_user_id: userId,
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
export async function adminRevokeUserSessions(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "revoke_sessions",
      target_user_id: userId,
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
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-super-action", {
    body: {
      action: "generate_recovery_link",
      target_user_id: userId,
      email,
    },
  });

  if (error || !data?.actionLink) {
    const errorMsg = data?.error || error?.message || "Falha ao gerar link de recuperação.";
    throw new AppError("network", errorMsg);
  }

  return data.actionLink as string;
}

// Re-export das operações administrativas transacionais
export {
  adminCreateInviteRpc as adminCreateInvite,
  adminDeleteUserRpc as adminDeleteUser,
  adminGetMetricsRpc as adminGetMetrics,
  adminListUsersRpc as adminListUsers,
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
  adminLogSystemBackup,
  type AdminListUsersParams,
  type AdminMetricsResult,
  type AdminUserRow,
};


