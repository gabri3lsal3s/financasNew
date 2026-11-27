import "@/lib/zod-config";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { AppRouter } from "@/app/router";
import { initObservability } from "@/services/observability";

// Portal administrativo isolado: nunca registra service worker nem instala handlers PWA.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    window.location.reload();
  });
}

void initObservability();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Toaster>
        <ToastHost />
        <AppErrorBoundary>
          <AppRouter />
        </AppErrorBoundary>
      </Toaster>
    </ThemeProvider>
  </StrictMode>,
);
