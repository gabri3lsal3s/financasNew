import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  adminCreateModularInvite as adminCreateModularInviteRpc,
  adminRemoveUserModulePermission as adminRemoveUserModulePermissionRpc,
  adminSetUserModulePermission as adminSetUserModulePermissionRpc,
  adminSetUserSubscription as adminSetUserSubscriptionRpc,
  getMySubscription as getMySubscriptionRpc,
} from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type {
  ModuleAccessLevel,
  Plan,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionTier,
  UserModulePermission,
  UserSubscription,
} from "@/types";

/**
 * Consulta a lista oficial de planos SaaS disponíveis.
 */
export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await resolveQuery<Plan[]>(
    getSupabase()
      .from("plans")
      .select("*")
      .order("price_cents", { ascending: true }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Consulta o status de assinatura agregado e permissões do usuário autenticado.
 */
export async function getMySubscription(): Promise<SubscriptionStatus | null> {
  try {
    const raw = await getMySubscriptionRpc();
    if (!raw) return null;

    const tier = raw.tier as SubscriptionTier;
    const plan: SubscriptionPlan | null =
      tier === "pro_monthly" ? "monthly" : tier === "pro_annual" ? "annual" : null;

    return {
      tier,
      trialDaysRemaining: raw.trial_days_remaining,
      trialEndsAt: raw.trial_ends_at,
      currentPeriodEnd: raw.current_period_end,
      plan,
      cancelAtPeriodEnd: raw.cancel_at_period_end,
      isFullAccess: raw.is_full_access,
      isTrial: raw.is_trial,
      isPro: raw.is_pro,
      isLifetime: raw.is_lifetime,
      isReadOnly: raw.is_read_only,
      canWrite: raw.can_write,
      moduleAccess: raw.module_permissions as Record<string, ModuleAccessLevel>,
    };
  } catch (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Consulta a assinatura bruta de um usuário específico (uso administrativo).
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await resolveQuery<UserSubscription>(
    getSupabase()
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}

/**
 * Consulta as permissões modulares de um usuário específico (uso administrativo).
 */
export async function getUserModulePermissions(userId: string): Promise<UserModulePermission[]> {
  const { data, error } = await resolveQuery<UserModulePermission[]>(
    getSupabase()
      .from("user_module_permissions")
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
 * Superadmin ou Admin altera o plano e status da assinatura de um usuário.
 */
export async function adminSetUserSubscription(params: {
  userId: string;
  planId: string;
  tier: SubscriptionTier;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<void> {
  await adminSetUserSubscriptionRpc(params);
}

/**
 * Superadmin ou Admin define override de permissão por módulo para um usuário.
 */
export async function adminSetUserModulePermission(params: {
  userId: string;
  moduleKey: string;
  accessLevel: ModuleAccessLevel;
  expiresAt?: string | null;
}): Promise<void> {
  await adminSetUserModulePermissionRpc(params);
}

/**
 * Superadmin ou Admin remove override de permissão de módulo para um usuário.
 */
export async function adminRemoveUserModulePermission(params: {
  userId: string;
  moduleKey: string;
}): Promise<void> {
  await adminRemoveUserModulePermissionRpc(params);
}

/**
 * Criação de convite com presets de plano e matriz de permissões modulares.
 */
export async function adminCreateModularInvite(params: {
  code: string;
  targetTier?: SubscriptionTier;
  customTrialDays?: number | null;
  moduleGrants?: Record<string, ModuleAccessLevel>;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
  notes?: string | null;
}): Promise<string> {
  return adminCreateModularInviteRpc(params);
}
