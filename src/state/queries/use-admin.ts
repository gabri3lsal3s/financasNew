import { useQuery } from "@tanstack/react-query";
import {
  adminGetMetrics,
  adminGetUserContactDetails,
  adminListUsers,
  listAccessInvites,
  listAuditEvents,
  listBroadcastNotifications,
  listSystemBackups,
  listSystemFeatures,
  listUserFeatureOverrides,
  getMyBroadcastNotifications,
  type AdminListUsersParams,
} from "@/data/repositories/admin";
import {
  getPlans,
  getUserModulePermissions,
  getUserSubscription,
} from "@/data/repositories/subscriptions";

export const ADMIN_METRICS_KEY = ["admin_metrics"] as const;
export const ADMIN_USERS_KEY = ["admin_users"] as const;
export const ADMIN_FEATURES_KEY = ["admin_features"] as const;
export const ADMIN_INVITES_KEY = ["admin_invites"] as const;
export const ADMIN_AUDIT_KEY = ["admin_audit"] as const;
export const ADMIN_USER_OVERRIDES_KEY = ["admin_user_overrides"] as const;
export const ADMIN_PLANS_KEY = ["admin_plans"] as const;
export const ADMIN_USER_SUBSCRIPTION_KEY = ["admin_user_subscription"] as const;
export const ADMIN_USER_MODULE_PERMISSIONS_KEY = ["admin_user_module_permissions"] as const;
export const ADMIN_BACKUPS_KEY = ["admin_backups"] as const;
export const ADMIN_BROADCASTS_KEY = ["admin_broadcasts"] as const;
export const ADMIN_USER_CONTACT_KEY = ["admin_user_contact"] as const;
export const MY_BROADCASTS_KEY = ["my_broadcasts"] as const;

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

export function useAdminPlans() {
  return useQuery({
    queryKey: ADMIN_PLANS_KEY,
    queryFn: getPlans,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useAdminUserSubscription(userId: string | null | undefined) {
  return useQuery({
    queryKey: [...ADMIN_USER_SUBSCRIPTION_KEY, userId],
    queryFn: () => (userId ? getUserSubscription(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
    staleTime: 1000 * 10,
  });
}

export function useAdminUserModulePermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: [...ADMIN_USER_MODULE_PERMISSIONS_KEY, userId],
    queryFn: () => (userId ? getUserModulePermissions(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 1000 * 10,
  });
}

export function useAdminSystemBackups(limit = 50) {
  return useQuery({
    queryKey: [...ADMIN_BACKUPS_KEY, limit],
    queryFn: () => listSystemBackups(limit),
    staleTime: 1000 * 30,
  });
}

export function useAdminBroadcastNotifications(limit = 50) {
  return useQuery({
    queryKey: [...ADMIN_BROADCASTS_KEY, limit],
    queryFn: () => listBroadcastNotifications(limit),
    staleTime: 1000 * 30,
  });
}

export function useAdminUserContact(userId: string | null | undefined, enabled = false) {
  return useQuery({
    queryKey: [...ADMIN_USER_CONTACT_KEY, userId],
    queryFn: () => (userId ? adminGetUserContactDetails(userId) : Promise.resolve(null)),
    enabled: Boolean(userId) && enabled,
    staleTime: 1000 * 60, // 1 min
  });
}

export function useMyBroadcastNotifications(limit = 20) {
  return useQuery({
    queryKey: [...MY_BROADCASTS_KEY, limit],
    queryFn: () => getMyBroadcastNotifications(limit),
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

