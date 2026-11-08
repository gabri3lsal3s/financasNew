import { isNativePlatform } from "@/services/native/platform";

/**
 * Helper universal de resolução de URL pública da aplicação.
 *
 * Garante que redirecionamentos de autenticação (confirmação de e-mail,
 * redefinição de senha), links públicos compartilháveis (Racha de Contas /r/:token,
 * Convites Familiares /convite-familiar/:token, Metas Coletivas /meta/:token,
 * Orçamento Familiar /orcamento-familiar/:token, Modo Viagem /viagem/:token e Simuladores) apontem para
 * uma URL pública acessível de acordo com o ambiente ativo:
 *
 * 1. Web Localhost (http://localhost:* ou 127.0.0.1:*): usa a própria origem do dev server.
 * 2. Web Cloud / Domínio Próprio (*.workers.dev, *.pages.dev ou domínio customizado): adota dinamicamente a origem do navegador.
 * 3. Mobile Nativo (Capacitor Android): como a origem interna é capacitor://localhost ou https://localhost,
 *    prioriza VITE_PUBLIC_SITE_URL ou adota o fallback canônico de nuvem (https://financasnew.gabrielisaacsales.workers.dev).
 */
export function getPublicAppUrl(path = ""): string {
  const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();

  let base = publicSiteUrl;

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
    base = window.location.origin;
  }

  // 2. Ambiente Mobile Nativo (Capacitor) ou runtime sem window (testes/SSR)
  if (!base) {
    base = "https://financasnew.gabrielisaacsales.workers.dev";
  }

  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${cleanBase}${cleanPath}`;
}

