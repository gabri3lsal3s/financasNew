import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { initAppLockListener } from "@/services/native/app-lock";

/**
 * Sincroniza o ciclo de vida do TanStack Query e das stores locais
 * com a sessão de autenticação do Supabase.
 * Ao deslogar (`SIGNED_OUT`), troca de conta ou autenticação de novo usuário,
 * invoca `resetAppState` cancelando requisições, limpando cache e restaurando
 * os padrões de fábrica no DOM e na memória para isolamento total.
 * No login (`SIGNED_IN`), invalida todas as queries para garantir dados frescos.
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

      if (event === "SIGNED_OUT") {
        resetAppState(queryClient, null);
      } else if (activeUserIdRef.current !== newUserId) {
        resetAppState(queryClient, newUserId);
        void queryClient.invalidateQueries();
      } else if (event === "SIGNED_IN") {
        void queryClient.invalidateQueries();
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
 * Providers globais mínimos do App Shell público.
 *
 * A sincronização de sessão permanece global (segurança/isolamento de cache),
 * mas tudo que depende de usuário autenticado (preferências em nuvem,
 * assinatura, lembretes, bloqueio biométrico e ícone dinâmico) vive em
 * `AuthenticatedProviders`, carregado apenas após o guard de autenticação.
 * Isso evita que a landing page baixe stores e sincronizações de conta.
 *
 * Política de retry Online First (docs/ARCHITECTURE.md §5.1): leituras com
 * retry limitado; mutações nunca com retry automático.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: "always",
            staleTime: 60_000,
            gcTime: 600_000,
            retry: 1,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    const cleanup = initAppLockListener();
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQuerySync>
        <ThemeProvider>
          <Toaster>
            <PWAUpdateToast />
            <ToastHost />
            <AppErrorBoundary>{children}</AppErrorBoundary>
          </Toaster>
        </ThemeProvider>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
