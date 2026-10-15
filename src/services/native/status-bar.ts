import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform } from "./platform";

export type AppTheme = "light" | "dark" | "oled";

export const THEME_STATUS_BAR_CONFIG: Record<AppTheme, { color: string; style: Style }> = {
  light: { color: "#F4F7F9", style: Style.Light },
  dark: { color: "#0C1923", style: Style.Dark },
  oled: { color: "#000000", style: Style.Dark },
};

/**
 * Sincroniza a cor de fundo e o contraste dos ícones da barra de status
 * nativa conforme o tema ativo (light #F4F7F9, dark #0C1923, oled #000000).
 * Em Web/PWA, opera como no-op seguro.
 */
export async function syncStatusBarTheme(theme: AppTheme): Promise<void> {
  if (!isNativePlatform()) return;

  const config = THEME_STATUS_BAR_CONFIG[theme];
  if (!config) return;

  try {
    await StatusBar.setStyle({ style: config.style });
    await StatusBar.setBackgroundColor({ color: config.color });
  } catch {
    // Falha silenciosa em navegadores de teste ou SO sem suporte a tinting direto
  }
}
