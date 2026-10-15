import { App } from "@capacitor/app";
import { isNativePlatform } from "./platform";

export type DeepLinkHandler = (path: string) => void;

const listeners = new Set<DeepLinkHandler>();
let isListenerActive = false;

/**
 * Converte URLs nativas completas (https://com.guiafinanceiro.app/..., com.guiafinanceiro.app://...)
 * em caminho de rota interna do React Router (/transacoes?novo=despesa).
 */
export function parseAppUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "/";
  if (rawUrl.startsWith("/")) return rawUrl;

  try {
    let normalized = rawUrl;
    const customSchemeMatch = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/);
    if (customSchemeMatch && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      const rest = customSchemeMatch[2] ?? "";
      normalized = rest.startsWith("/") ? `https://app${rest}` : `https://app/${rest}`;
    }

    const parsed = new URL(normalized);
    const pathname = parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`;
    const search = parsed.search || "";
    const hash = parsed.hash || "";
    return `${pathname}${search}${hash}`;
  } catch {
    return "/";
  }
}

/**
 * Notifica todos os manipuladores registrados com o caminho da rota.
 */
export function notifyDeepLink(path: string): void {
  for (const listener of listeners) {
    listener(path);
  }
}

/**
 * Registra um assinante para navegações de links profundos.
 */
export function subscribeDeepLink(handler: DeepLinkHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/**
 * Inicializa a escuta de URLs externas e atalhos de launcher no Android/iOS nativo.
 */
export function initDeepLinkListener(onNavigate?: DeepLinkHandler): () => Promise<void> {
  if (onNavigate) {
    listeners.add(onNavigate);
  }

  if (!isNativePlatform() || isListenerActive) {
    return async () => {
      if (onNavigate) listeners.delete(onNavigate);
    };
  }

  isListenerActive = true;
  const listenerPromise = App.addListener("appUrlOpen", ({ url }) => {
    const route = parseAppUrl(url);
    notifyDeepLink(route);
  });

  return async () => {
    isListenerActive = false;
    if (onNavigate) listeners.delete(onNavigate);
    const handle = await listenerPromise;
    void handle.remove();
  };
}
