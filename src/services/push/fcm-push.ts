import type { PluginListenerHandle } from "@capacitor/core";
import { isNativePlatform } from "@/services/native/platform";
import {
  getUserStorageItem,
  removeUserStorageItem,
  setUserStorageItem,
} from "@/services/user-storage";

export const KEY_FCM_TOKEN = "fcm_push_token";
export const DEFAULT_FCM_CHANNEL_ID = "due_reminders";

const DEFAULT_REGISTRATION_TIMEOUT_MS = 15_000;

export type RegisterNativeFcmResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: "unsupported" | "permission_denied" | "timeout" | "error";
      message: string;
    };

export interface NativePushListenerCallbacks {
  onTokenRefresh?: (token: string) => void;
  onActionPerformed?: (url: string) => void;
  onForegroundPush?: (payload: {
    title?: string;
    body?: string;
    url?: string;
  }) => void;
}

async function loadPushNotifications() {
  const mod = await import("@capacitor/push-notifications");
  return mod.PushNotifications;
}

function extractNotificationDataField(
  data: unknown,
  field: string,
): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Indica se o dispositivo executa no wrapper nativo (Android/iOS Capacitor) com suporte a FCM/APNs.
 */
export function isNativePushSupported(): boolean {
  return isNativePlatform();
}

/**
 * Lê o último token FCM salvo localmente para o usuário informado.
 */
export function getStoredFcmToken(userId?: string | null): string | null {
  const raw = getUserStorageItem(KEY_FCM_TOKEN, userId);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Persiste ou remove o token FCM no armazenamento isolado do usuário.
 */
export function setStoredFcmToken(
  token: string | null,
  userId?: string | null,
): void {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (trimmed.length > 0) {
    setUserStorageItem(KEY_FCM_TOKEN, trimmed, userId);
    return;
  }
  removeUserStorageItem(KEY_FCM_TOKEN, userId);
}

/**
 * Garante navegação interna segura ao tocar em uma notificação remota recebida via FCM.
 */
export function sanitizeNotificationRoute(raw: unknown): string {
  if (typeof raw !== "string") return "/lembretes";
  const trimmed = raw.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/lembretes";
}

/**
 * Consulta o estado atual da permissão nativa para notificações push sem abrir prompt ao usuário.
 */
export async function checkNativePushPermission(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  if (!isNativePushSupported()) return "unsupported";
  try {
    const PushNotifications = await loadPushNotifications();
    const status = await PushNotifications.checkPermissions();
    if (status.receive === "granted") return "granted";
    if (status.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

/**
 * Garante permissão, canal padrão Android e registra o aparelho no Firebase Cloud Messaging.
 */
export async function registerNativeFcmPush(options?: {
  requestPermission?: boolean;
  timeoutMs?: number;
  userId?: string | null;
}): Promise<RegisterNativeFcmResult> {
  if (!isNativePushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Disponível apenas no aplicativo Android nativo.",
    };
  }

  const listenerHandles: PluginListenerHandle[] = [];
  const timerState: { id: ReturnType<typeof setTimeout> | null } = { id: null };

  try {
    const PushNotifications = await loadPushNotifications();
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive !== "granted") {
      if (options?.requestPermission === false) {
        return {
          ok: false,
          reason: "permission_denied",
          message: "Permissão de notificações não concedida no aparelho.",
        };
      }
      permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") {
        return {
          ok: false,
          reason: "permission_denied",
          message:
            "Permissão negada no aparelho. Libere as notificações nas configurações do Android.",
        };
      }
    }

    try {
      await PushNotifications.createChannel({
        id: DEFAULT_FCM_CHANNEL_ID,
        name: "Lembretes e Avisos Axir",
        description: "Alertas de contas, cobranças e comunicados importantes.",
        importance: 4,
        visibility: 1,
      });
    } catch {
      // iOS e versões antigas do Android ignoram criação de canal
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_REGISTRATION_TIMEOUT_MS;

    return await new Promise<RegisterNativeFcmResult>((resolve) => {
      let settled = false;
      const finish = (res: RegisterNativeFcmResult) => {
        if (settled) return;
        settled = true;
        if (timerState.id) {
          clearTimeout(timerState.id);
          timerState.id = null;
        }
        resolve(res);
      };

      void (async () => {
        try {
          listenerHandles.push(
            await PushNotifications.addListener("registration", (token) => {
              const cleanToken =
                typeof token?.value === "string" ? token.value.trim() : "";
              if (!cleanToken) {
                finish({
                  ok: false,
                  reason: "error",
                  message:
                    "Não foi possível registrar o dispositivo no serviço de notificações.",
                });
                return;
              }
              setStoredFcmToken(cleanToken, options?.userId);
              finish({ ok: true, token: cleanToken });
            }),
          );

          listenerHandles.push(
            await PushNotifications.addListener("registrationError", () => {
              finish({
                ok: false,
                reason: "error",
                message:
                  "Não foi possível registrar o dispositivo no serviço de notificações.",
              });
            }),
          );

          timerState.id = setTimeout(() => {
            finish({
              ok: false,
              reason: "timeout",
              message:
                "Tempo esgotado ao registrar notificações no aparelho. Verifique a conexão e tente novamente.",
            });
          }, timeoutMs);

          await PushNotifications.register();
        } catch {
          finish({
            ok: false,
            reason: "error",
            message:
              "Não foi possível registrar o dispositivo no serviço de notificações.",
          });
        }
      })();
    });
  } catch {
    return {
      ok: false,
      reason: "error",
      message:
        "Não foi possível registrar o dispositivo no serviço de notificações.",
    };
  } finally {
    if (timerState.id) {
      clearTimeout(timerState.id);
      timerState.id = null;
    }
    await Promise.allSettled(listenerHandles.map((handle) => handle.remove()));
  }
}

/**
 * Remove o token FCM local e cancela o registro nativo do dispositivo no Firebase.
 */
export async function unregisterNativeFcmPush(
  userId?: string | null,
): Promise<{ unregistered: boolean; token: string | null }> {
  const token = getStoredFcmToken(userId);
  setStoredFcmToken(null, userId);

  if (!isNativePushSupported()) {
    return { unregistered: false, token };
  }

  try {
    const PushNotifications = await loadPushNotifications();
    await PushNotifications.unregister();
    return { unregistered: true, token };
  } catch {
    return { unregistered: false, token };
  }
}

/**
 * Registra listeners globais de refresh de token, recebimento em primeiro plano e toque em notificações FCM.
 */
export function initNativePushListeners(
  callbacks: NativePushListenerCallbacks,
): () => Promise<void> {
  if (!isNativePushSupported()) {
    return async () => undefined;
  }

  let disposed = false;
  const handlesPromise: Promise<PluginListenerHandle[]> = (async () => {
    const PushNotifications = await loadPushNotifications();
    if (disposed) return [];

    const created: PluginListenerHandle[] = [];
    const registerSafe = async (handlePromise: Promise<PluginListenerHandle>) => {
      const handle = await handlePromise;
      if (disposed) {
        await handle.remove().catch(() => undefined);
      } else {
        created.push(handle);
      }
    };

    await Promise.all([
      registerSafe(
        PushNotifications.addListener("registration", (token) => {
          const nextToken =
            typeof token?.value === "string" ? token.value.trim() : "";
          if (!nextToken) return;
          setStoredFcmToken(nextToken);
          callbacks.onTokenRefresh?.(nextToken);
        }),
      ),
      registerSafe(
        PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const rawUrl =
              extractNotificationDataField(action.notification?.data, "url") ??
              action.notification?.link;
            callbacks.onActionPerformed?.(sanitizeNotificationRoute(rawUrl));
          },
        ),
      ),
      registerSafe(
        PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            const rawUrl = extractNotificationDataField(
              notification.data,
              "url",
            );
            callbacks.onForegroundPush?.({
              title: notification.title,
              body: notification.body,
              url:
                rawUrl !== undefined
                  ? sanitizeNotificationRoute(rawUrl)
                  : undefined,
            });
          },
        ),
      ),
    ]);

    return created;
  })();

  return async () => {
    disposed = true;
    const handles = await handlesPromise.catch(() => [] as PluginListenerHandle[]);
    await Promise.allSettled(handles.map((handle) => handle.remove()));
  };
}
