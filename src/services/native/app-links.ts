import { getPlatform } from "./platform";

declare const __APP_VERSION__: string | undefined;

/**
 * Versão oficial vigente do aplicativo Axir (sincronizada dinamicamente com package.json via Vite define).
 */
export const AXIR_APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "3.13.0";

/**
 * Nome canônico do produto.
 */
export const AXIR_APP_NAME = "Axir";

/**
 * Nome padronizado do arquivo instalador Android distribuído aos usuários.
 */
export const AXIR_APK_FILENAME = "axir-pro.apk";

/**
 * URL canônica oficial para download direto do APK Android Pro do Axir.
 */
export const AXIR_APK_DOWNLOAD_URL =
  "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk";

/**
 * Esquema de deep-link canônico da marca Axir.
 */
export const AXIR_DEEP_LINK_SCHEME = "axir://";

/**
 * Esquema legado ainda suportado no AndroidManifest para retrocompatibilidade de intent-filters.
 */
export const AXIR_LEGACY_DEEP_LINK_SCHEME = "com.guiafinanceiro.app://";

/**
 * Constrói uma URI de deep-link nativa normalizando barras iniciais do caminho.
 */
export function buildAppDeepLink(
  path = "",
  scheme: string = AXIR_DEEP_LINK_SCHEME,
): string {
  const normalizedScheme = scheme.endsWith("://") ? scheme : `${scheme.replace(/:+\/*$/, "")}://`;
  const cleanPath = path.replace(/^\/+/, "");
  return `${normalizedScheme}${cleanPath}`;
}

/**
 * Indica se o ambiente atual é elegível para oferta do instalador APK Android (M10).
 *
 * Retorna `true` exclusivamente quando o runtime é Capacitor Android ou navegador Android Web.
 * Retorna `false` em dispositivos Apple (iPhone/iPad/iPadOS) e Desktops (Windows/macOS/Linux).
 */
export function shouldOfferAndroidApk(userAgent?: string): boolean {
  let ua: string;

  if (userAgent === undefined) {
    const platform = getPlatform();
    if (platform === "android") return true;
    if (platform === "ios") return false;
    if (typeof navigator === "undefined") return false;
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      return false;
    }
    ua = navigator.userAgent || "";
  } else {
    ua = userAgent;
  }

  if (!ua || /iPad|iPhone|iPod|Windows Phone/i.test(ua)) {
    return false;
  }

  return /Android/i.test(ua);
}
