import { useCallback, useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { clearDeviceSessionSync } from "@/services/native/device-info";

export interface SignOutOptions {
  scope?: "global" | "local" | "others";
}

/**
 * Hook padronizado para encerramento de sessão (Logout / SignOut).
 * Por padrão, adota scope: 'local' para garantir suporte multi-sessão
 * (autenticar a mesma conta em múltiplos aparelhos mantém ambos conectados).
 */
export function useSignOut() {
  const queryClient = useContext(QueryClientContext);

  const signOut = useCallback(
    async (options?: SignOutOptions): Promise<void> => {
      clearDeviceSessionSync();
      const scope = options?.scope ?? "local";
      try {
        resetAppState(queryClient, null);
        const supabase = getSupabase();
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
