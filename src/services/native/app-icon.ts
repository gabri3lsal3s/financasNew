import { registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "./platform";

export type AppIconVariant = "default" | "pro";

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
 * Define o ícone de abertura do aplicativo nativo na gaveta de apps (Android Launcher).
 * Comuta dinamicamente entre a versão Oficial Teal ('default') e a versão Pro Âmbar ('pro').
 */
export async function setNativeAppIcon(iconOrPro: AppIconVariant | boolean): Promise<boolean> {
  const isPro = typeof iconOrPro === "boolean" ? iconOrPro : iconOrPro === "pro";
  const icon: AppIconVariant = isPro ? "pro" : "default";

  try {
    if (!isNativePlatform()) {
      return true;
    }
    const result = await AppIconPlugin.setAppIcon({ icon, isPro });
    return result.success;
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
      return "default";
    }
    const result = await AppIconPlugin.getAppIcon();
    return result.isPro ? "pro" : "default";
  } catch {
    return "default";
  }
}
