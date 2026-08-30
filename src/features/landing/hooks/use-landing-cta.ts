import { useAuth } from "@/hooks/use-auth";

/**
 * Hook de URLs inteligentes para os CTAs da Landing Page.
 *
 * Detecta se o usuário já possui sessão ativa e retorna as URLs corretas:
 * - Logado: "Começar grátis" → "/" (já está no app)
 * - Logado: "Assinar Pro" → "/assinatura?plano=..." (vai direto ao checkout)
 * - Sem sessão: ambos passam pelo /cadastro preservando o parâmetro de plano
 *
 * Mantido na landing feature — zero import de shell/app routes fora da camada pública.
 */
export function useLandingCta() {
  const { session, loading } = useAuth();
  const isLoggedIn = !loading && Boolean(session);

  /**
   * URL do CTA de trial gratuito ("Experimentar 30 Dias Grátis", "Criar Conta Gratuita").
   * Usuário logado vai direto ao app; sem sessão vai para o cadastro.
   */
  const trialUrl = isLoggedIn ? "/" : "/cadastro";

  /**
   * URL do CTA de assinatura Pro.
   * Usuário logado vai direto ao checkout; sem sessão passa pelo cadastro
   * para criar conta antes de pagar.
   */
  function proUrl(plan: "pro-anual" | "pro-mensal" = "pro-anual"): string {
    return isLoggedIn ? `/assinatura?plano=${plan}` : `/cadastro?plano=${plan}`;
  }

  return { trialUrl, proUrl, isLoggedIn };
}
