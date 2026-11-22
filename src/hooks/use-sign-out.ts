import { useCallback, useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { deactivatePushSubscriptionByEndpoint } from "@/data/repositories/push-subscriptions";
import { resetAppState } from "@/services/auth-cleanup";
import { clearNativeBankMonitoring } from "@/services/native/bank-listener";
import { clearDeviceSessionSync } from "@/services/native/device-info";
import { cancelDailyReminder, clearAllDueNotifications } from "@/services/native/local-notifications";
import { unsubscribeBrowserWebPush } from "@/services/push/web-push";
import { getActiveUserId } from "@/services/user-storage";

export interface SignOutOptions {
  scope?: "global" | "local" | "others";
}

/**
 * Hook padronizado para encerramento de sessão (Logout / SignOut).
 * Por padrão, adota scope: 'local' para suporte multi-sessão.
 * Quando `scope === 'others'`, encerra apenas sessões remotas sem destruir os dados
 * e lembretes locais do aparelho atual.
 */
export function useSignOut() {
  const queryClient = useContext(QueryClientContext);

  const signOut = useCallback(
    async (options?: SignOutOptions): Promise<void> => {
      const scope = options?.scope ?? "local";
      const supabase = getSupabase();

      if (scope === "others") {
        await supabase.auth.signOut({ scope: "others" });
        return;
      }

      const previousUserId = getActiveUserId();
      clearDeviceSessionSync();

      // Remove assinatura Web Push do navegador e desativa no backend enquanto o JWT ainda está válido
      try {
        const { endpoint } = await unsubscribeBrowserWebPush();
        if (endpoint) {
          await deactivatePushSubscriptionByEndpoint(endpoint);
        }
      } catch {
        // Não bloqueia logout em caso de falha de rede ou ausência de suporte
      }

      // Aguarda limpeza dos agendamentos locais com previousUserId antes de resetar activeUserId
      await Promise.allSettled([
        Promise.resolve(clearNativeBankMonitoring()),
        Promise.resolve(clearAllDueNotifications(previousUserId)),
        Promise.resolve(cancelDailyReminder()),
      ]);

      try {
        resetAppState(queryClient, null);
        await supabase.auth.signOut({ scope });
      } catch {
        // Garante reset mesmo em caso de falha de rede ao deslogar
        resetAppState(queryClient, null);
      }
    },
    [queryClient],
  );

  return { signOut };
}
