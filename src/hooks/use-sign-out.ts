import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";

/**
 * Hook padronizado para encerramento de sessão (Logout / SignOut).
 * Coordena o cancelamento de requisições, limpeza de cache, reset de stores
 * e desconexão segura no Supabase Auth.
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  const signOut = useCallback(async (): Promise<void> => {
    try {
      resetAppState(queryClient, null);
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // Garante reset mesmo em caso de falha de rede ao deslogar
      resetAppState(queryClient, null);
    }
  }, [queryClient]);

  return { signOut };
}
