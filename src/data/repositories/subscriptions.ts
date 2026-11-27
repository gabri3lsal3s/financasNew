import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  adminCreateModularInvite as adminCreateModularInviteRpc,
  adminRemoveUserModulePermission as adminRemoveUserModulePermissionRpc,
  adminSetUserModulePermission as adminSetUserModulePermissionRpc,
  adminSetUserSubscription as adminSetUserSubscriptionRpc,
  getMySubscription as getMySubscriptionRpc,
  type RawMySubscriptionRpc,
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
      .select("id, name, description, price_cents, billing_interval, is_publicly_available, created_at")
      .order("price_cents", { ascending: true }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Converte o payload bruto da RPC `get_my_subscription` no contrato `SubscriptionStatus` da aplicação.
 */
export function mapRawSubscriptionToStatus(raw: RawMySubscriptionRpc | null): SubscriptionStatus | null {
  if (!raw) return null;

  const tier = raw.tier as SubscriptionTier;
  const plan: SubscriptionPlan | null =
    tier === "pro_monthly" ? "monthly" : tier === "pro_annual" ? "annual" : null;
  const rawExtended = raw as {
    billing_start_at?: string | null;
    past_due_since?: string | null;
    past_due_grace_mode?: string | null;
    past_due_block_at?: string | null;
    past_due_reminders_enabled?: boolean | null;
  };

  return {
    tier,
    status: raw.status ?? null,
    billingPhase: raw.billing_phase ?? undefined,
    startsAt: raw.starts_at ?? null,
    billingStartAt: rawExtended.billing_start_at ?? null,
    trialDaysRemaining: raw.trial_days_remaining,
    trialEndsAt: raw.trial_ends_at,
    trialConsumedAt: raw.trial_consumed_at ?? null,
    hasUsedTrial: Boolean(raw.has_used_trial ?? (raw.trial_consumed_at || rawExtended.billing_start_at || raw.is_read_only)),
    currentPeriodEnd: raw.current_period_end,
    plan,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    isFullAccess: raw.is_full_access,
    isTrial: raw.is_trial,
    isPro: raw.is_pro,
    isLifetime: raw.is_lifetime,
    isReadOnly: raw.is_read_only,
    canWrite: raw.can_write,
    hasCardRegistered: Boolean(raw.has_card_registered || raw.asaas_subscription_id || raw.card_last4),
    hasAutoRenew: Boolean(raw.has_auto_renew ?? (raw.asaas_subscription_id && !raw.cancel_at_period_end)),
    cardLast4: raw.card_last4 ?? null,
    cardBrand: raw.card_brand ?? null,
    pendingPlanId: raw.pending_plan_id ?? null,
    pendingPlanEffectiveAt: raw.pending_plan_effective_at ?? null,
    scheduledPlanId: raw.scheduled_plan_id ?? null,
    scheduledFirstChargeAt: raw.scheduled_first_charge_at ?? null,
    asaasSyncStatus: raw.asaas_sync_status ?? null,
    pastDueSince: rawExtended.past_due_since ?? null,
    pastDueGraceMode: rawExtended.past_due_grace_mode === "auto" ? "auto" : "manual",
    pastDueBlockAt: rawExtended.past_due_block_at ?? null,
    pastDueRemindersEnabled: rawExtended.past_due_reminders_enabled ?? true,
    moduleAccess: raw.module_permissions as Record<string, ModuleAccessLevel>,
  };
}

/**
 * Consulta o status de assinatura agregado e permissões do usuário autenticado.
 */
export async function getMySubscription(): Promise<SubscriptionStatus | null> {
  try {
    const raw = await getMySubscriptionRpc();
    return mapRawSubscriptionToStatus(raw);
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
      .select(
        "id, user_id, plan_id, tier, status, starts_at, trial_ends_at, current_period_end, cancel_at_period_end, card_last4, asaas_subscription_id, asaas_customer_id, created_at, updated_at",
      )
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
      .select("id, user_id, module_key, access_level, created_at, updated_at")
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
