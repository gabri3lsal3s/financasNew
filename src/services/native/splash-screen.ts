import { SplashScreen } from "@capacitor/splash-screen";
import { isNativePlatform } from "./platform";

/**
 * Oculta a Splash Screen suavemente (Web/PWA e Nativo Android) com transição de fade.
 * Na Web/PWA, aciona a animação de fade-out do elemento #app-splash e o remove do DOM.
 * No ambiente nativo (Capacitor/Android), invoca o plugin oficial com fadeOutDuration.
 */
export async function hideSplashScreen(fadeOutDuration = 350): Promise<void> {
  // 1. Web/PWA: fade suave do elemento #app-splash
  if (typeof document !== "undefined") {
    const splash = document.getElementById("app-splash");
    if (splash) {
      splash.classList.add("splash-fade-out");
      document.body.classList.add("app-mounted");
      setTimeout(() => {
        splash.style.display = "none";
        try {
          splash.remove();
        } catch {
          // No-op defensivo
        }
      }, fadeOutDuration);
    }
  }

  // 2. Mobile Nativo (Capacitor / Android)
  if (isNativePlatform()) {
    try {
      await SplashScreen.hide({ fadeOutDuration });
    } catch {
      // Falha silenciosa caso o plugin não esteja disponível no ambiente
    }
  }
}

/**
 * Alias retrocompatível com a API nativa anterior.
 */
export const hideNativeSplashScreen = hideSplashScreen;
