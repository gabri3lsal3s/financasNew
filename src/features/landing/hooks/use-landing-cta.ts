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
   * URL do fluxo secundário de cadastro gratuito (sem cartão).
   * Usuário logado vai direto ao app; sem sessão vai para o formulário de cadastro gratuito.
   */
  const freeRegisterUrl = isLoggedIn ? "/" : "/cadastro";
  const trialUrl = freeRegisterUrl;

  /**
   * URL do fluxo principal guiado de assinatura Pro.
   * Leva diretamente ao checkout de assinatura (/assinatura?plano=...),
   * onde visitantes sem sessão criam a conta de forma integrada no próprio pagamento.
   */
  function proUrl(plan: "pro-anual" | "pro-mensal" = "pro-anual"): string {
    return `/assinatura?plano=${plan}`;
  }

  /**
   * CTA principal padrão da Landing Page (fluxo guiado de assinatura Pro).
   */
  const primaryCtaUrl = isLoggedIn ? "/" : proUrl("pro-anual");

  return { trialUrl, freeRegisterUrl, proUrl, primaryCtaUrl, isLoggedIn };
}
