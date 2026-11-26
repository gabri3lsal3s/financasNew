import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { AppUpdateToast } from "@/components/modules/app-update-toast";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { AppRouter } from "@/app/router";
import { registerPWA } from "@/app/pwa";
import { initObservability } from "@/services/observability";
import { initOrientationLock } from "@/services/orientation-lock";
import { initVisualCustomization } from "@/hooks/use-visual-customization";
import { hideNativeSplashScreen } from "@/services/native/splash-screen";
import { initHardwareBackButton } from "@/services/native/back-button";
import { initSafeAreaInsets } from "@/services/native/status-bar";

// Aplica preferências visuais (acento, superfície, movimento) imediatamente
initVisualCustomization();
registerPWA();
// Escuta o botão voltar físico do Android respeitando modais e navegação
initHardwareBackButton();
// Inicializa compensação de safe area insets (status bar e gestos no Android)
initSafeAreaInsets();
// Bloqueio de orientação mobile (portrait only) — manifest + Screen Orientation API
initOrientationLock();
// Auto-recuperação de chunks dinâmicos do Vite após novos deploys na Cloudflare Pages
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    window.location.reload();
  });
}
// Observabilidade (Sentry) — no-op sem VITE_SENTRY_DSN (dev/testes).
void initObservability();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Toaster>
        <AppUpdateToast />
        <ToastHost />
        <AppErrorBoundary>
          <AppRouter />
        </AppErrorBoundary>
      </Toaster>
    </ThemeProvider>
  </StrictMode>,
);

// Oculta a Splash Screen nativa suavemente após a montagem do primeiro frame do React
if (typeof window !== "undefined") {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void hideNativeSplashScreen(350);
    });
  });
}
