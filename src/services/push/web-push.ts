import { getSupabase } from "@/data/client";
import { isNativePlatform } from "@/services/native/platform";

export interface WebPushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SubscribeWebPushResult =
  | { ok: true; subscription: WebPushSubscriptionPayload }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "missing_vapid_key"
        | "permission_denied"
        | "service_worker_unavailable"
        | "error";
      message: string;
    };

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string | null {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Converte chave pública VAPID base64url para `Uint8Array<ArrayBuffer>` exigida pelo `PushManager.subscribe`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica se o ambiente atual suporta notificações em segundo plano (fora do WebView nativo Capacitor).
 */
export function isWebPushSupported(): boolean {
  if (isNativePlatform()) return false;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Retorna o estado atual da permissão de notificações do navegador.
 */
export function getWebPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  return window.Notification.permission;
}

/**
 * Retorna a chave pública configurada em `VITE_VAPID_PUBLIC_KEY`.
 */
export function getVapidPublicKey(): string | null {
  const raw = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extrai endpoint e chaves criptográficas (`p256dh`, `auth`) de uma `PushSubscription`.
 */
export function extractWebPushKeys(
  sub: PushSubscription | null | undefined,
): WebPushSubscriptionPayload | null {
  if (!sub || !sub.endpoint) return null;
  const jsonKeys = typeof sub.toJSON === "function" ? sub.toJSON()?.keys : undefined;
  const p256dh =
    jsonKeys?.p256dh ??
    arrayBufferToBase64Url(typeof sub.getKey === "function" ? sub.getKey("p256dh") : null);
  const auth =
    jsonKeys?.auth ??
    arrayBufferToBase64Url(typeof sub.getKey === "function" ? sub.getKey("auth") : null);
  if (!p256dh || !auth) return null;
  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
  };
}

/**
 * Lê a assinatura de push ativa atual do navegador, se existir.
 */
export async function getCurrentWebPushSubscription(): Promise<WebPushSubscriptionPayload | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    return extractWebPushKeys(subscription);
  } catch {
    return null;
  }
}

/**
 * Solicita permissão e registra (ou renova em rotação de chave) a assinatura de segundo plano do navegador.
 */
export async function subscribeBrowserWebPush(
  explicitVapidKey?: string | null,
): Promise<SubscribeWebPushResult> {
  if (!isWebPushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Alertas com a aba fechada não estão disponíveis neste navegador.",
    };
  }

  const vapidKey = (explicitVapidKey ?? getVapidPublicKey() ?? "").trim();
  if (!vapidKey) {
    return {
      ok: false,
      reason: "missing_vapid_key",
      message: "O envio em segundo plano ainda está sendo finalizado no servidor.",
    };
  }

  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        reason: "permission_denied",
        message: "Permissão bloqueada. Libere as notificações nas configurações do navegador para este site.",
      };
    }

    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.ready.catch(() => undefined));

    if (!registration?.pushManager) {
      return {
        ok: false,
        reason: "service_worker_unavailable",
        message: "Recarregue o aplicativo uma vez para concluir o preparo em segundo plano.",
      };
    }

    const expectedKeyBytes = urlBase64ToUint8Array(vapidKey);
    let pushSub = await registration.pushManager.getSubscription();
    if (pushSub?.options?.applicationServerKey) {
      const currentKeyBytes = new Uint8Array(pushSub.options.applicationServerKey);
      if (!bytesEqual(currentKeyBytes, expectedKeyBytes)) {
        await pushSub.unsubscribe().catch(() => false);
        pushSub = null;
      }
    }

    if (!pushSub) {
      pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKeyBytes,
      });
    }

    const extracted = extractWebPushKeys(pushSub);
    if (!extracted) {
      return {
        ok: false,
        reason: "error",
        message: "Não foi possível concluir o vínculo de notificação deste navegador.",
      };
    }

    return { ok: true, subscription: extracted };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Não foi possível ativar os alertas em segundo plano neste navegador.",
    };
  }
}

/**
 * Cancela a inscrição de push ativa no navegador, retornando o endpoint removido.
 */
export async function unsubscribeBrowserWebPush(): Promise<{
  unsubscribed: boolean;
  endpoint: string | null;
}> {
  if (!isWebPushSupported()) {
    return { unsubscribed: false, endpoint: null };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) {
      return { unsubscribed: false, endpoint: null };
    }
    const endpoint = subscription.endpoint;
    const ok = await subscription.unsubscribe();
    return { unsubscribed: ok, endpoint };
  } catch {
    return { unsubscribed: false, endpoint: null };
  }
}

/**
 * Dispara um teste real de entrega remota pelo `push-dispatcher` para o próprio usuário autenticado.
 */
export async function dispatchRemoteTestPush(): Promise<boolean> {
  if (!isWebPushSupported() && !isNativePlatform()) return false;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke("push-dispatcher", {
      body: {
        eventType: "test_push",
        title: "Axir · Teste em segundo plano",
        body: "Se você recebeu este aviso, alertas remotos com o app fechado estão funcionando.",
        url: "/configuracoes?tab=notifications",
        tag: "axir_remote_test",
      },
    });
    if (error) return false;
    const delivered =
      data && typeof data === "object" && "delivered" in data
        ? Number((data as { delivered?: number }).delivered ?? 0)
        : 0;
    return delivered > 0;
  } catch {
    return false;
  }
}
