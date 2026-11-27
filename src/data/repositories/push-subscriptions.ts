import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { currentUserId } from "@/data/session";
import { AppError, classifyError } from "@/services/errors";
import type { UserPushSubscription } from "@/types";

const PUSH_INSTALLATION_ID_KEY = "axir_push_installation_id";
const PUSH_RECIPIENT_VERSION_PREFIX = "axir_push_recipient_version:";

export interface PushSubscriptionRecord extends UserPushSubscription {
  installation_id: string | null;
  recipient_version: number;
  multi_account_opt_in: boolean;
}

export interface SaveWebPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
  installationId?: string | null;
  multiAccountOptIn?: boolean;
}

export interface SaveFcmSubscriptionInput {
  fcmToken: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
  installationId?: string | null;
  multiAccountOptIn?: boolean;
}

function generateInstallationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `inst_${crypto.randomUUID()}`;
  }
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Obtém ou cria um identificador estável de instalação para isolar assinaturas de push por dispositivo.
 */
export function getOrCreatePushInstallationId(explicitId?: string | null): string {
  const trimmed = explicitId?.trim();
  if (trimmed && trimmed.length >= 8) {
    return trimmed;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(PUSH_INSTALLATION_ID_KEY)?.trim();
      if (existing && existing.length >= 8) {
        return existing;
      }
      const created = generateInstallationId();
      localStorage.setItem(PUSH_INSTALLATION_ID_KEY, created);
      return created;
    }
  } catch {
    // Fallback em memória quando storage não está disponível
  }
  return generateInstallationId();
}

/**
 * Retorna a versão de destinatário conhecida localmente para o usuário nesta instalação.
 */
export function getKnownRecipientVersion(userId?: string | null): number | null {
  if (!userId) return null;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(`${PUSH_RECIPIENT_VERSION_PREFIX}${userId}`);
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
    }
  } catch {
    // no-op
  }
  return null;
}

function persistPushInstallationContext(
  userId: string,
  installationId: string,
  recipientVersion: number,
): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PUSH_INSTALLATION_ID_KEY, installationId);
      localStorage.setItem(`${PUSH_RECIPIENT_VERSION_PREFIX}${userId}`, String(recipientVersion));
    }
  } catch {
    // no-op
  }

  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "AXIR_PUSH_CONTEXT",
        installationId,
        activeUserId: userId,
        userId,
        recipientVersion,
      });
    }
  } catch {
    // no-op
  }
}

/**
 * Lista todas as inscrições de Push Remoto do usuário autenticado.
 */
export async function listMyPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PushSubscriptionRecord[]>(
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

interface BindPushSubscriptionRpcArgs {
  p_platform: "web_push" | "fcm";
  p_installation_id: string;
  p_endpoint: string | null;
  p_p256dh: string | null;
  p_auth: string | null;
  p_fcm_token: string | null;
  p_device_label: string | null;
  p_user_agent: string | null;
  p_multi_account_opt_in: boolean;
}

interface PushInstallationRpcClient {
  rpc(
    fn: "bind_push_subscription_installation",
    args: BindPushSubscriptionRpcArgs,
  ): PromiseLike<{ data: PushSubscriptionRecord | null; error: unknown }>;
}

function callBindPushSubscriptionRpc(
  args: BindPushSubscriptionRpcArgs,
): PromiseLike<{ data: PushSubscriptionRecord | null; error: unknown }> {
  const client = getSupabase() as unknown as PushInstallationRpcClient;
  return client.rpc("bind_push_subscription_installation", args);
}

/**
 * Registra ou reativa atomicamente a inscrição Web Push (VAPID) vinculada à instalação atual.
 */
export async function upsertWebPushSubscription(
  input: SaveWebPushSubscriptionInput,
): Promise<PushSubscriptionRecord> {
  const user_id = await currentUserId();
  const installationId = getOrCreatePushInstallationId(input.installationId);
  const userAgent =
    input.userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null);

  const { data, error } = await resolveQuery<PushSubscriptionRecord>(
    callBindPushSubscriptionRpc({
      p_platform: "web_push",
      p_installation_id: installationId,
      p_endpoint: input.endpoint,
      p_p256dh: input.p256dh,
      p_auth: input.auth,
      p_fcm_token: null,
      p_device_label: input.deviceLabel ?? null,
      p_user_agent: userAgent,
      p_multi_account_opt_in: Boolean(input.multiAccountOptIn),
    }),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  persistPushInstallationContext(user_id, installationId, data.recipient_version ?? 1);
  return data;
}

/**
 * Registra ou reativa atomicamente um token FCM do aplicativo Android nativo vinculado à instalação atual.
 */
export async function upsertFcmPushSubscription(
  input: SaveFcmSubscriptionInput,
): Promise<PushSubscriptionRecord> {
  const user_id = await currentUserId();
  const installationId = getOrCreatePushInstallationId(input.installationId);
  const userAgent =
    input.userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null);

  const { data, error } = await resolveQuery<PushSubscriptionRecord>(
    callBindPushSubscriptionRpc({
      p_platform: "fcm",
      p_installation_id: installationId,
      p_endpoint: null,
      p_p256dh: null,
      p_auth: null,
      p_fcm_token: input.fcmToken,
      p_device_label: input.deviceLabel ?? "Android App",
      p_user_agent: userAgent,
      p_multi_account_opt_in: Boolean(input.multiAccountOptIn),
    }),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  persistPushInstallationContext(user_id, installationId, data.recipient_version ?? 1);
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
 * Desativa uma inscrição FCM específica pelo token do aparelho Android nativo.
 */
export async function deactivatePushSubscriptionByFcmToken(fcmToken: string): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("user_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .eq("fcm_token", fcmToken);

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
