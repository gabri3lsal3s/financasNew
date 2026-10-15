import { SplashScreen } from "@capacitor/splash-screen";
import { isNativePlatform } from "./platform";

/**
 * Oculta a Splash Screen nativa suavemente após a montagem do App Shell.
 * Na Web/PWA, opera como no-op seguro pois o HTML #app-splash cuida da transição via CSS.
 */
export async function hideNativeSplashScreen(fadeOutDuration = 300): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await SplashScreen.hide({ fadeOutDuration });
  } catch {
    // Falha silenciosa caso o plugin não esteja disponível no ambiente
  }
}
