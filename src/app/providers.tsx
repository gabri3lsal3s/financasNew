import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";

/**
 * Providers globais. A política de retry materializa a regra Online First
 * (docs/ARCHITECTURE.md §5.1): leituras com retry limitado; mutações NUNCA
 * com retry automático (evita dupla submissão — o botão fica em isPending).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster>
          {/* Toast global de nova versão PWA (autoUpdate) — PWA_GUIDELINES §6 */}
          <PWAUpdateToast />
          {/* Host do bus de toasts (services/toast) — rollbacks otimistas etc. */}
          <ToastHost />
          {children}
        </Toaster>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
