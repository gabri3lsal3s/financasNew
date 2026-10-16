import { registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "./platform";

export type AppIconVariant = "default" | "pro";
export type CachedIconTier = "FREE" | "PRO";

export const LAST_APPLIED_ICON_TIER_KEY = "last_applied_icon_tier";

export interface AppIconPluginInterface {
  setAppIcon(options: { icon: AppIconVariant; isPro?: boolean }): Promise<{
    success: boolean;
    currentIcon: string;
    isPro: boolean;
  }>;
  getAppIcon(): Promise<{
    currentIcon: string;
    isPro: boolean;
  }>;
}

export const AppIconPlugin = registerPlugin<AppIconPluginInterface>("AppIconPlugin", {
  web: {
    async setAppIcon(options: { icon: AppIconVariant; isPro?: boolean }) {
      return {
        success: true,
        currentIcon: options.icon,
        isPro: options.isPro ?? options.icon === "pro",
      };
    },
    async getAppIcon() {
      return {
        currentIcon: "default",
        isPro: false,
      };
    },
  },
});

/**
 * Lê o último tier de ícone gravado no cache local de forma síncrona.
 * Retorna 'FREE' se não houver registro prévio ou se o ambiente não permitir acesso.
 */
export function getCachedIconTier(): CachedIconTier {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return "FREE";
    }
    const stored = window.localStorage.getItem(LAST_APPLIED_ICON_TIER_KEY);
    if (stored === "PRO") return "PRO";
    return "FREE";
  } catch {
    return "FREE";
  }
}

/**
 * Salva o último tier de ícone no cache local de forma síncrona.
 */
export function setCachedIconTier(tier: CachedIconTier): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LAST_APPLIED_ICON_TIER_KEY, tier);
    }
  } catch {
    // Silencia erros de gravação em ambientes restritos
  }
}

/**
 * Define o ícone de abertura do aplicativo nativo na gaveta de apps (Android Launcher).
 * Comuta dinamicamente entre a versão Oficial Teal ('default') e a versão Pro Âmbar ('pro').
 *
 * Utiliza delta check rigoroso com o cache local ('last_applied_icon_tier'):
 * Se o tier desejado já corresponder ao cache, retorna imediatamente sem invocar a ponte nativa,
 * impedindo crash loops e reinícios indesejados de processo no Android Launcher.
 */
export async function setNativeAppIcon(iconOrPro: AppIconVariant | boolean): Promise<boolean> {
  const isPro = typeof iconOrPro === "boolean" ? iconOrPro : iconOrPro === "pro";
  const icon: AppIconVariant = isPro ? "pro" : "default";
  const targetTier: CachedIconTier = isPro ? "PRO" : "FREE";

  // Delta check com cache local: evita acionar o plugin nativo se já estiver no tier desejado
  const currentTier = getCachedIconTier();
  if (currentTier === targetTier) {
    return true;
  }

  try {
    if (!isNativePlatform()) {
      setCachedIconTier(targetTier);
      return true;
    }

    const result = await AppIconPlugin.setAppIcon({ icon, isPro });
    if (result.success) {
      setCachedIconTier(targetTier);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Obtém o ícone nativo atualmente ativo no Android.
 */
export async function getNativeAppIcon(): Promise<AppIconVariant> {
  try {
    if (!isNativePlatform()) {
      return getCachedIconTier() === "PRO" ? "pro" : "default";
    }
    const result = await AppIconPlugin.getAppIcon();
    const variant: AppIconVariant = result.isPro ? "pro" : "default";
    setCachedIconTier(result.isPro ? "PRO" : "FREE");
    return variant;
  } catch {
    return getCachedIconTier() === "PRO" ? "pro" : "default";
  }
}
