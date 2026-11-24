import { useCallback, useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { revokeOtherDevices } from "@/data/repositories/devices";
import {
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
} from "@/data/repositories/push-subscriptions";
import { clearGlobalAuthSession } from "@/hooks/use-auth";
import { resetAppState } from "@/services/auth-cleanup";
import { clearNativeBankMonitoring } from "@/services/native/bank-listener";
import { clearDeviceSessionSync, getOrCreateDeviceId } from "@/services/native/device-info";
import { cancelDailyReminder, clearAllDueNotifications } from "@/services/native/local-notifications";
import {
  unsubscribeBrowserWebPush,
  unregisterNativeFcmPush,
} from "@/services/push";
import { getActiveUserId } from "@/services/user-storage";
import { userDevicesKey } from "@/state/queries/use-devices";

const NATIVE_CLEANUP_TIMEOUT_MS = 2_000;
const SUPABASE_SIGN_OUT_TIMEOUT_MS = 2_500;

export interface SignOutOptions {
  scope?: "global" | "local" | "others";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => {
      setTimeout(() => resolve(undefined), timeoutMs);
    }),
  ]);
}

function clearResidualSupabaseTokens(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // no-op
  }
}

/**
 * Hook padronizado para encerramento de sessão (Logout / SignOut).
 * Por padrão, adota scope: 'local' para suporte multi-sessão.
 * Quando `scope === 'others'`, encerra sessões remotas e marca os demais dispositivos
 * como revogados em `user_devices`, sem destruir dados locais do aparelho atual.
 */
export function useSignOut() {
  const queryClient = useContext(QueryClientContext);

  const signOut = useCallback(
    async (options?: SignOutOptions): Promise<void> => {
      const scope = options?.scope ?? "local";
      const supabase = getSupabase();

      if (scope === "others") {
        await supabase.auth.signOut({ scope: "others" });
        try {
          await revokeOtherDevices(getOrCreateDeviceId());
          void queryClient?.invalidateQueries({ queryKey: userDevicesKey });
        } catch {
          // Não bloqueia caso a sincronização da lista falhe pontualmente
        }
        return;
      }

      const previousUserId = getActiveUserId();
      clearDeviceSessionSync();

      try {
        // Executa limpezas de push e plugins nativos em paralelo com timeout estrito,
        // impedindo que bridges Android (ex.: PushNotifications.unregister) travem o logout no APK.
        const cleanupTasks = Promise.allSettled([
          (async () => {
            const { endpoint } = await unsubscribeBrowserWebPush();
            if (endpoint) {
              await deactivatePushSubscriptionByEndpoint(endpoint);
            }
          })(),
          (async () => {
            const { token } = await unregisterNativeFcmPush(previousUserId);
            if (token) {
              await deactivatePushSubscriptionByFcmToken(token);
            }
          })(),
          Promise.resolve(clearNativeBankMonitoring()),
          Promise.resolve(clearAllDueNotifications(previousUserId)),
          Promise.resolve(cancelDailyReminder()),
        ]);

        await withTimeout(cleanupTasks, NATIVE_CLEANUP_TIMEOUT_MS);

        try {
          await withTimeout(supabase.auth.signOut({ scope }), SUPABASE_SIGN_OUT_TIMEOUT_MS);
        } catch {
          // Tolera 401/403 ou erro de rede caso a sessão já tenha sido removida no servidor
        }
      } finally {
        clearResidualSupabaseTokens();
        clearGlobalAuthSession();
        resetAppState(queryClient ?? undefined, null);
      }
    },
    [queryClient],
  );

  return { signOut };
}
