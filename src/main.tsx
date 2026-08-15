import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { OrientationLockOverlay } from "@/components/modules/orientation-lock-overlay";
import { registerPWA } from "@/app/pwa";
import { initObservability } from "@/services/observability";
import { initOrientationLock } from "@/services/orientation-lock";
import { initVisualCustomization } from "@/hooks/use-visual-customization";

// Aplica preferências visuais (acento, superfície, movimento) imediatamente
initVisualCustomization();
registerPWA();
// Bloqueio estrito de orientação mobile (portrait only) — manifest + lock JS
// + overlay de fallback para navegadores sem suporte à API.
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
    <OrientationLockOverlay />
  </StrictMode>,
);
