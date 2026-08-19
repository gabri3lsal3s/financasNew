import type { QueryClient } from "@tanstack/react-query";
import { setActiveUserId, sanitizeLegacyStorage } from "@/services/user-storage";
import { resetVisualCustomization } from "@/hooks/use-visual-customization";
import { resetDensity } from "@/hooks/use-density";
import { resetPrivacyMask } from "@/hooks/use-privacy-mask";
import { resetEnsuredProfiles } from "@/hooks/use-auth";
import { setObservabilityUser } from "@/services/observability";

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

  // 3. Atualiza o userId ativo para isolamento de storage
  setActiveUserId(nextUserId);

  // 4. Reseta as stores em memória e atributos DOM
  resetVisualCustomization(nextUserId);
  resetDensity(nextUserId);
  resetPrivacyMask();
  resetEnsuredProfiles();

  // 5. Limpa usuário de observabilidade (Sentry)
  void setObservabilityUser(null);

  // 6. Higieniza chaves legadas no localStorage
  sanitizeLegacyStorage();
}
