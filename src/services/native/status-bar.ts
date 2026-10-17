import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform, isAndroidNative } from "./platform";

export type AppTheme = "light" | "dark" | "oled";

export const THEME_STATUS_BAR_CONFIG: Record<AppTheme, { color: string; style: Style }> = {
  light: { color: "#F4F7F9", style: Style.Light },
  dark: { color: "#0C1923", style: Style.Dark },
  oled: { color: "#000000", style: Style.Dark },
};

let safeAreaListenersAttached = false;

/**
 * Mede e aplica variáveis CSS de safe area (`--safe-area-top`, `--safe-area-bottom`).
 * No Android nativo, se o Chromium WebView falhar ao calcular `env(safe-area-inset-top)`
 * (resultando em 0px), injeta valores mínimos seguros (32px no topo e 16px na base),
 * garantindo que a barra de status ou gestos não sobreponham o conteúdo da aplicação.
 */
export function applySafeAreaInsets(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (isAndroidNative()) {
    try {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden;z-index:-1;";
      document.documentElement.appendChild(probe);
      const measuredHeight = probe.getBoundingClientRect().height;
      probe.remove();

      if (measuredHeight <= 0) {
        document.documentElement.style.setProperty("--safe-area-top", "32px");
        document.documentElement.style.setProperty("--safe-area-bottom", "16px");
      } else {
        document.documentElement.style.setProperty("--safe-area-top", `${measuredHeight}px`);
      }
    } catch {
      document.documentElement.style.setProperty("--safe-area-top", "32px");
      document.documentElement.style.setProperty("--safe-area-bottom", "16px");
    }
  }
}

/**
 * Inicializa a escuta de insets seguros e reavalia quando a orientação ou tamanho de tela mudar.
 */
export function initSafeAreaInsets(): void {
  applySafeAreaInsets();

  if (!safeAreaListenersAttached && typeof window !== "undefined") {
    safeAreaListenersAttached = true;
    window.addEventListener("resize", applySafeAreaInsets, { passive: true });
    window.addEventListener("orientationchange", applySafeAreaInsets, { passive: true });
  }
}

/**
 * Sincroniza a cor de fundo e o contraste dos ícones da barra de status
 * nativa conforme o tema ativo (light #F4F7F9, dark #0C1923, oled #000000).
 * Em Web/PWA, opera como no-op seguro.
 */
export async function syncStatusBarTheme(theme: AppTheme): Promise<void> {
  if (!isNativePlatform()) return;

  applySafeAreaInsets();

  const config = THEME_STATUS_BAR_CONFIG[theme];
  if (!config) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: config.style });
    await StatusBar.setBackgroundColor({ color: config.color });
  } catch {
    // Falha silenciosa em navegadores de teste ou SO sem suporte a tinting direto
  }
}
