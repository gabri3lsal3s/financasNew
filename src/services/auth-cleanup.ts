import type { QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/data/client";
import {
  getActiveUserId,
  purgeAccountStorage,
  sanitizeLegacyStorage,
  setActiveUserId,
} from "@/services/user-storage";
import { clearSessionContext } from "@/services/session-context";
import { resetVisualCustomization } from "@/hooks/use-visual-customization";
import { resetPrivacyMask } from "@/hooks/use-privacy-mask";
import { resetEnsuredProfiles, resetGlobalMfaState } from "@/hooks/use-auth";
import { setObservabilityUser } from "@/services/observability";
import { setAppLocked, resetAppLockBackgroundTimer } from "@/services/native/app-lock";
import { setCachedIconTier } from "@/services/native/app-icon";
import { clearRecentReceipts } from "@/services/native/suggestions-store";
import { resetUpdateDismissedForSession } from "@/domain/native/update-toast-policy";

export { purgeAccountStorage };

export interface ResetAppStateOptions {
  /** Conta específica cujo armazenamento local deve ser expurgado seletivamente. */
  purgeAccountKey?: string | null;
}

/**
 * Rotina centralizada de limpeza e reset do estado da aplicação.
 * Executada ao deslogar (`signOut`) ou ao transicionar entre contas diferentes,
 * garantindo isolamento absoluto de cache, stores em memória e atributos DOM.
 */
export function resetAppState(
  queryClient?: QueryClient,
  nextUserId: string | null = null,
  options?: ResetAppStateOptions,
): void {
  // 0. Invalida o contexto de sessão da aba para descartar respostas tardias em voo
  clearSessionContext("neutral");

  // 1. Cancela buscas e mutações em andamento
  if (queryClient) {
    void queryClient.cancelQueries();
    // 2. Limpa completamente todo o QueryCache e MutationCache em memória
    queryClient.clear();
  }

  // 2.1 Reseta o bloqueio biométrico ao encerrar sessão e o ícone em cache em qualquer troca de conta
  setCachedIconTier("FREE");
  if (nextUserId === null) {
    setAppLocked(false);
    resetAppLockBackgroundTimer();
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

  // 3. Atualiza o userId ativo e executa expurgo seletivo da conta se solicitado
  const accountToPurge = options?.purgeAccountKey?.trim() || null;
  if (accountToPurge) {
    if (nextUserId && nextUserId !== accountToPurge) {
      setActiveUserId(nextUserId);
      purgeAccountStorage(accountToPurge);
    } else {
      purgeAccountStorage(accountToPurge);
      setActiveUserId(nextUserId);
    }
  } else {
    setActiveUserId(nextUserId);
  }

  // 4. Reseta as stores em memória e atributos DOM
  resetVisualCustomization(nextUserId);
  resetPrivacyMask();
  resetEnsuredProfiles();
  resetGlobalMfaState();
  resetUpdateDismissedForSession();

  // 5. Limpa usuário de observabilidade (Sentry)
  void setObservabilityUser(null);

  // 6. Higieniza chaves legadas no localStorage
  sanitizeLegacyStorage();
}

/**
 * Expurga seletivamente os dados locais de uma conta específica (`accountKey`),
 * preservando integralmente preferências e estado de outras contas.
 * Se a conta expurgada for a ativa no momento (ou se `nextUserId` for informado),
 * executa também o reset completo da sessão ativa na aba.
 */
export function purgeAccountState(
  accountKey: string,
  queryClient?: QueryClient,
  nextUserId?: string | null,
): number {
  const normalizedKey = accountKey.trim();
  if (!normalizedKey) return 0;

  const activeId = getActiveUserId();
  if (activeId === normalizedKey || nextUserId !== undefined) {
    const removedCount = purgeAccountStorage(normalizedKey);
    resetAppState(queryClient, nextUserId ?? null);
    return removedCount;
  }

  return purgeAccountStorage(normalizedKey);
}
