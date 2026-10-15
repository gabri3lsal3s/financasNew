import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { registerPWA } from "@/app/pwa";
import { initObservability } from "@/services/observability";
import { initOrientationLock } from "@/services/orientation-lock";
import { initVisualCustomization } from "@/hooks/use-visual-customization";
import { hideNativeSplashScreen, initHardwareBackButton } from "@/services/native";

// Aplica preferências visuais (acento, superfície, movimento) imediatamente
initVisualCustomization();
registerPWA();
// Escuta o botão voltar físico do Android respeitando modais e navegação
initHardwareBackButton();
// Bloqueio de orientação mobile (portrait only) — manifest + Screen Orientation API
initOrientationLock();
// Observabilidade (Sentry) — no-op sem VITE_SENTRY_DSN (dev/testes).
void initObservability();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);

// Oculta a Splash Screen nativa suavemente após a montagem do App Shell
void hideNativeSplashScreen(300);
