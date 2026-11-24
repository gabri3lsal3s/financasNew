import { useCallback, useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { revokeOtherDevices } from "@/data/repositories/devices";
import {
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
} from "@/data/repositories/push-subscriptions";
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

export interface SignOutOptions {
  scope?: "global" | "local" | "others";
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
        // Remove assinaturas Web Push e FCM nativo do dispositivo (best-effort; tolera 401/403 pós-revogação)
        try {
          const { endpoint } = await unsubscribeBrowserWebPush();
          if (endpoint) {
            await deactivatePushSubscriptionByEndpoint(endpoint);
          }
        } catch {
          // Não bloqueia logout em caso de falha de rede ou token já revogado (401/403)
        }

        try {
          const { token } = await unregisterNativeFcmPush(previousUserId);
          if (token) {
            await deactivatePushSubscriptionByFcmToken(token);
          }
        } catch {
          // Não bloqueia logout em caso de falha de rede ou token já revogado (401/403)
        }

        // Aguarda limpeza dos agendamentos locais com previousUserId antes de resetar activeUserId
        await Promise.allSettled([
          Promise.resolve(clearNativeBankMonitoring()),
          Promise.resolve(clearAllDueNotifications(previousUserId)),
          Promise.resolve(cancelDailyReminder()),
        ]);

        try {
          await supabase.auth.signOut({ scope });
        } catch {
          // Tolera 401/403 caso a sessão já tenha sido excluída em `auth.sessions`
        }
      } finally {
        resetAppState(queryClient ?? undefined, null);
      }
    },
    [queryClient],
  );

  return { signOut };
}
