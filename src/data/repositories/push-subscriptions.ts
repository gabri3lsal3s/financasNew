import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { currentUserId } from "@/data/session";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, UserPushSubscription } from "@/types";

export interface SaveWebPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
}

export interface SaveFcmSubscriptionInput {
  fcmToken: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
}

/**
 * Lista todas as inscrições de Push Remoto do usuário autenticado.
 */
export async function listMyPushSubscriptions(): Promise<UserPushSubscription[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<UserPushSubscription[]>(
    getSupabase()
      .from("user_push_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .order("updated_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ?? [];
}

/**
 * Registra ou reativa a inscrição Web Push (VAPID) do navegador atual.
 */
export async function upsertWebPushSubscription(
  input: SaveWebPushSubscriptionInput,
): Promise<UserPushSubscription> {
  const user_id = await currentUserId();
  const now = new Date().toISOString();
  const row: DbInsert<UserPushSubscription> = {
    user_id,
    platform: "web_push",
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    fcm_token: null,
    device_label: input.deviceLabel ?? null,
    user_agent:
      input.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null),
    is_active: true,
    last_used_at: now,
    updated_at: now,
  };

  const { data, error } = await resolveQuery<UserPushSubscription>(
    getSupabase()
      .from("user_push_subscriptions")
      .upsert(row, { onConflict: "user_id,endpoint" })
      .select("*")
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data;
}

/**
 * Registra ou reativa um token FCM do aplicativo Android nativo.
 */
export async function upsertFcmPushSubscription(
  input: SaveFcmSubscriptionInput,
): Promise<UserPushSubscription> {
  const user_id = await currentUserId();
  const now = new Date().toISOString();
  const row: DbInsert<UserPushSubscription> = {
    user_id,
    platform: "fcm",
    endpoint: null,
    p256dh: null,
    auth: null,
    fcm_token: input.fcmToken,
    device_label: input.deviceLabel ?? "Android App",
    user_agent:
      input.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null),
    is_active: true,
    last_used_at: now,
    updated_at: now,
  };

  const { data, error } = await resolveQuery<UserPushSubscription>(
    getSupabase()
      .from("user_push_subscriptions")
      .upsert(row, { onConflict: "user_id,fcm_token" })
      .select("*")
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data;
}

/**
 * Desativa uma inscrição Web Push específica pelo endpoint.
 */
export async function deactivatePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("user_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .eq("endpoint", endpoint);

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Desativa todas as inscrições de Push Remoto do usuário autenticado.
 */
export async function deactivateAllMyPushSubscriptions(): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("user_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .eq("is_active", true);

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
