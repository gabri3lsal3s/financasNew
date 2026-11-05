import type { QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import { setActiveUserId, sanitizeLegacyStorage } from "@/services/user-storage";
import { resetVisualCustomization } from "@/hooks/use-visual-customization";
import { resetPrivacyMask } from "@/hooks/use-privacy-mask";
import { resetEnsuredProfiles } from "@/hooks/use-auth";
import { setObservabilityUser } from "@/services/observability";
import { setAppLocked, resetAppLockBackgroundTimer } from "@/services/native/app-lock";
import { setCachedIconTier } from "@/services/native/app-icon";
import { clearRecentReceipts } from "@/services/native/suggestions-store";

/**
 * Rotina centralizada de limpeza e reset do estado da aplicação.
 * Executada ao deslogar (`signOut`) ou ao transicionar entre contas diferentes,
 * garantindo isolamento absoluto de cache, stores em memória e atributos DOM.
 */
export function resetAppState(queryClient?: QueryClient, nextUserId: string | null = null): void {
  // 1. Cancela buscas e mutações em andamento
  if (queryClient) {
    void queryClient.cancelQueries();
    // 2. Limpa completamente todo o QueryCache e MutationCache em memória
    queryClient.clear();
  }

  // 2.1 Reseta o bloqueio biométrico e o ícone de abertura ao encerrar sessão
  if (nextUserId === null) {
    setAppLocked(false);
    resetAppLockBackgroundTimer();
    setCachedIconTier("FREE");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("financas_active_biometric_lock_enabled");
      } catch {
        // no-op
      }
    }
  }

  // 2.2 Desconecta ativamente todos os canais de Realtime do Supabase
  try {
    const supabase = getSupabase();
    if (typeof supabase?.removeAllChannels === "function") {
      void supabase.removeAllChannels();
    }
  } catch {
    // no-op em ambientes de teste
  }

  // 2.3 Purga o buffer volátil de comprovantes bancários em memória
  clearRecentReceipts();

  // 2.4 Limpa registros temporários em sessionStorage (resíduos de checkout, navegação transitória)
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.clear();
    } catch {
      // no-op em ambientes com storage restrito
    }
  }

  // 3. Atualiza o userId ativo para isolamento de storage
  setActiveUserId(nextUserId);

  // 4. Reseta as stores em memória e atributos DOM
  resetVisualCustomization(nextUserId);
  resetPrivacyMask();
  resetEnsuredProfiles();

  // 5. Limpa usuário de observabilidade (Sentry)
  void setObservabilityUser(null);

  // 6. Higieniza chaves legadas no localStorage
  sanitizeLegacyStorage();
}
