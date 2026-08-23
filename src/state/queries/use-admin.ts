import { useQuery } from "@tanstack/react-query";
import {
  adminGetMetrics,
  adminListUsers,
  listAccessInvites,
  listAuditEvents,
  listSystemFeatures,
  listUserFeatureOverrides,
  type AdminListUsersParams,
} from "@/data/repositories/admin";

export const ADMIN_METRICS_KEY = ["admin_metrics"] as const;
export const ADMIN_USERS_KEY = ["admin_users"] as const;
export const ADMIN_FEATURES_KEY = ["admin_features"] as const;
export const ADMIN_INVITES_KEY = ["admin_invites"] as const;
export const ADMIN_AUDIT_KEY = ["admin_audit"] as const;
export const ADMIN_USER_OVERRIDES_KEY = ["admin_user_overrides"] as const;

export function useAdminMetrics() {
  return useQuery({
    queryKey: ADMIN_METRICS_KEY,
    queryFn: adminGetMetrics,
    staleTime: 1000 * 30, // 30s
  });
}

export function useAdminUsers(params: AdminListUsersParams = {}) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, params],
    queryFn: () => adminListUsers(params),
    staleTime: 1000 * 30,
  });
}

export function useAdminFeatures() {
  return useQuery({
    queryKey: ADMIN_FEATURES_KEY,
    queryFn: listSystemFeatures,
    staleTime: 1000 * 60,
  });
}

export function useAdminInvites() {
  return useQuery({
    queryKey: ADMIN_INVITES_KEY,
    queryFn: listAccessInvites,
    staleTime: 1000 * 30,
  });
}

export function useAdminAuditLogs(limit = 100) {
  return useQuery({
    queryKey: [...ADMIN_AUDIT_KEY, limit],
    queryFn: () => listAuditEvents(limit),
    staleTime: 1000 * 30,
  });
}

export function useUserOverrides(userId: string | null | undefined) {
  return useQuery({
    queryKey: [...ADMIN_USER_OVERRIDES_KEY, userId],
    queryFn: () => (userId ? listUserFeatureOverrides(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 1000 * 10,
  });
}
