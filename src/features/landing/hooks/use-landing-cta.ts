import { useState } from "react";
import { buildCheckoutUrl } from "@/domain/subscription/plans";

/**
 * Verifica de forma síncrona e ultraleve se existe uma sessão válida persistida no localStorage.
 * Não inicializa o cliente Supabase, não carrega SDKs externos e não gera tráfego de rede.
 */
function hasStoredSession(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const item = window.localStorage.getItem(key);
        if (item && item.includes("access_token")) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Hook de URLs inteligentes para os CTAs da Landing Page.
 *
 * Detecta se o usuário já possui sessão ativa de forma puramente local e síncrona,
 * desacoplando a Landing Page do bundle pesado do cliente Supabase e TanStack Query:
 * - Logado: "Começar grátis" → "/" (já está no app)
 * - Logado: "Assinar Pro" → "/assinatura?plano=..." (vai direto ao checkout)
 * - Sem sessão: ambos passam pelo /cadastro preservando o parâmetro de plano
 *
 * Mantido na landing feature — zero import de shell/app routes fora da camada pública.
 */
export function useLandingCta() {
  // Leitura síncrona do storage na inicialização — sem efeito de sincronização
  const [isLoggedIn] = useState(hasStoredSession);

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
    return buildCheckoutUrl({ plan });
  }

  /**
   * CTA principal padrão da Landing Page (fluxo guiado de assinatura Pro).
   */
  const primaryCtaUrl = isLoggedIn ? "/" : proUrl("pro-anual");

  return { trialUrl, freeRegisterUrl, proUrl, primaryCtaUrl, isLoggedIn };
}
