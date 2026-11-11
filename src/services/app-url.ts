import { isNativePlatform } from "@/services/native/platform";

/**
 * Domínio público oficial canônico da aplicação para ambiente nativo (APK) e fallbacks.
 */
export const CANONICAL_PUBLIC_DOMAIN = "https://axir.com.br";

/**
 * Helper universal de resolução de URL pública da aplicação.
 *
 * 1. Web / PWA (navegador comum, não-nativo): adota estritamente window.location.origin
 *    com base no domínio que está sendo acessado (suporta múltiplos domínios, previews e dev local).
 * 2. Mobile Nativo (Capacitor Android / APK): como a origem interna é capacitor://localhost ou
 *    https://localhost, prioriza o domínio canônico oficial de produção (https://axir.com.br)
 *    para geração de links de Modo Viagem, Racha de Contas, Convites e Metas compartilhadas.
 */
export function getPublicAppUrl(path = ""): string {
  const isNative =
    isNativePlatform() ||
    (typeof window !== "undefined" &&
      (window.location.origin === "https://localhost" ||
        window.location.origin === "capacitor://localhost" ||
        window.location.protocol === "capacitor:"));

  let base: string;

  // 1. Ambiente Web / PWA (navegador comum): adota diretamente o window.location.origin
  // com base no domínio que está sendo acessado pelo usuário.
  if (!isNative && typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")) {
    base = window.location.origin;
  } else {
    // 2. Ambiente Mobile Nativo (Capacitor Android / APK) ou runtime sem window (testes / SSR):
    // Como a origem interna do WebView é https://localhost ou capacitor://localhost,
    // prioriza VITE_PUBLIC_SITE_URL (se for domínio de produção customizado) ou adota o domínio oficial canônico.
    const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
    if (publicSiteUrl && !publicSiteUrl.includes("workers.dev") && !publicSiteUrl.includes("pages.dev")) {
      base = publicSiteUrl;
    } else {
      base = CANONICAL_PUBLIC_DOMAIN;
    }
  }

  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${cleanBase}${cleanPath}`;
}

