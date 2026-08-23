import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  adminCreateInvite as adminCreateInviteRpc,
  adminGetMetrics as adminGetMetricsRpc,
  adminListUsers as adminListUsersRpc,
  adminRemoveFeatureOverride as adminRemoveFeatureOverrideRpc,
  adminRevokeInvite as adminRevokeInviteRpc,
  adminSetFeatureOverride as adminSetFeatureOverrideRpc,
  adminSetUserRole as adminSetUserRoleRpc,
  adminToggleGlobalFeature as adminToggleGlobalFeatureRpc,
  adminUpdateUserStatus as adminUpdateUserStatusRpc,
  type AdminListUsersParams,
  type AdminMetricsResult,
  type AdminUserRow,
} from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { AccessInvite, AuditEvent, SystemFeature, UserFeatureOverride } from "@/types";

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

// Re-export das operações administrativas transacionais
export {
  adminCreateInviteRpc as adminCreateInvite,
  adminGetMetricsRpc as adminGetMetrics,
  adminListUsersRpc as adminListUsers,
  adminRemoveFeatureOverrideRpc as adminRemoveFeatureOverride,
  adminRevokeInviteRpc as adminRevokeInvite,
  adminSetFeatureOverrideRpc as adminSetFeatureOverride,
  adminSetUserRoleRpc as adminSetUserRole,
  adminToggleGlobalFeatureRpc as adminToggleGlobalFeature,
  adminUpdateUserStatusRpc as adminUpdateUserStatus,
  type AdminListUsersParams,
  type AdminMetricsResult,
  type AdminUserRow,
};
