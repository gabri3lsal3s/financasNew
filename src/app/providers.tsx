import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";
import { getSupabase } from "@/data/client";

/**
 * Sincroniza o ciclo de vida do TanStack Query com a sessão de autenticação do Supabase.
 * Cancela requisições em andamento e limpa TODO o cache em memória no logout (`SIGNED_OUT`)
 * ou na transição entre diferentes contas de usuário (`userId` distinto), impedindo
 * retenção de dados ou colisão de cache entre sessões.
 */
function AuthQuerySync({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;

      // Evento de Logout explícito ou troca de usuário
      if (
        event === "SIGNED_OUT" ||
        (activeUserIdRef.current !== null && activeUserIdRef.current !== newUserId)
      ) {
        // 1. Cancela buscas em andamento para não gravar dados da conta anterior
        void queryClient.cancelQueries();
        // 2. Limpa completamente todo o QueryCache e MutationCache em memória
        queryClient.clear();
      }

      activeUserIdRef.current = newUserId;
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <>{children}</>;
}

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
      <AuthQuerySync>
        <ThemeProvider>
          <Toaster>
            {/* Toast global de nova versão PWA (autoUpdate) — PWA_GUIDELINES §6 */}
            <PWAUpdateToast />
            {/* Host do bus de toasts (services/toast) — rollbacks otimistas etc. */}
            <ToastHost />
            {children}
          </Toaster>
        </ThemeProvider>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
