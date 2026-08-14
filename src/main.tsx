import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { registerPWA } from "@/app/pwa";
import { initObservability } from "@/services/observability";

registerPWA();
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
