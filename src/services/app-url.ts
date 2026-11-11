import { isNativePlatform } from "@/services/native/platform";

/**
 * Domínio público oficial canônico da aplicação em produção.
 */
export const CANONICAL_PUBLIC_DOMAIN = "https://axir.com.br";

/**
 * Helper universal de resolução de URL pública da aplicação.
 *
 * Garante que redirecionamentos de autenticação (confirmação de e-mail,
 * redefinição de senha), links públicos compartilháveis (Racha de Contas /r/:token,
 * Convites Familiares /convite-familiar/:token, Metas Coletivas /meta/:token,
 * Orçamento Familiar /orcamento-familiar/:token, Modo Viagem /viagem/:token e Simuladores) apontem para
 * o domínio público canônico oficial (https://axir.com.br) de forma padronizada:
 *
 * 1. Web Localhost (http://localhost:* ou 127.0.0.1:*): usa a própria origem do dev server apenas quando VITE_PUBLIC_SITE_URL não estiver configurado.
 * 2. Domínios legados de nuvem (*.workers.dev, *.pages.dev): normaliza estritamente para o domínio canônico (https://axir.com.br).
 * 3. Mobile Nativo (Capacitor Android): como a origem interna é capacitor://localhost ou https://localhost,
 *    prioriza o domínio canônico de produção (https://axir.com.br).
 */
export function getPublicAppUrl(path = ""): string {
  const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();

  let base = publicSiteUrl;

  // Se a URL pública configurada for um domínio de desenvolvimento interno da Cloudflare (*.workers.dev ou *.pages.dev),
  // normaliza imediatamente para o domínio canônico oficial
  if (base && (base.includes("workers.dev") || base.includes("pages.dev"))) {
    base = CANONICAL_PUBLIC_DOMAIN;
  }

  const isNative =
    isNativePlatform() ||
    (typeof window !== "undefined" &&
      (window.location.origin === "https://localhost" ||
        window.location.origin === "capacitor://localhost" ||
        window.location.protocol === "capacitor:"));

  // 1. Ambiente Web / PWA (navegador comum, não-nativo) sem VITE_PUBLIC_SITE_URL explícita
  if (
    !base &&
    typeof window !== "undefined" &&
    !isNative &&
    window.location.origin.startsWith("http")
  ) {
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      base = origin;
    } else if (origin.includes("workers.dev") || origin.includes("pages.dev") || origin.includes("axir.com.br")) {
      base = CANONICAL_PUBLIC_DOMAIN;
    } else {
      base = origin;
    }
  }

  // 2. Ambiente Mobile Nativo (Capacitor) ou runtime sem window (testes/SSR)
  if (!base) {
    base = CANONICAL_PUBLIC_DOMAIN;
  }

  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${cleanBase}${cleanPath}`;
}

