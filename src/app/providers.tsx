import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { checkPWAUpdateNow } from "@/app/pwa";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { AppUpdateToast } from "@/components/modules/app-update-toast";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { initAppLockListener } from "@/services/native/app-lock";
import { clearNativeBankMonitoring } from "@/services/native/bank-listener";
import { cancelDailyReminder, clearAllDueNotifications } from "@/services/native/local-notifications";
import { unregisterNativeFcmPush } from "@/services/push/fcm-push";
import { unsubscribeBrowserWebPush } from "@/services/push/web-push";

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
      const previousUserId = activeUserIdRef.current;

      if (event === "SIGNED_OUT") {
        void Promise.allSettled([
          Promise.resolve(clearNativeBankMonitoring()),
          Promise.resolve(clearAllDueNotifications(previousUserId)),
          Promise.resolve(cancelDailyReminder()),
          Promise.resolve(unsubscribeBrowserWebPush()),
          Promise.resolve(unregisterNativeFcmPush(previousUserId)),
        ]);
        resetAppState(queryClient, null);
        // Ao encerrar sessão, verifica e aplica atualizações pendentes do PWA em ponto seguro
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
      } else if (previousUserId !== newUserId) {
        if (previousUserId && previousUserId !== newUserId) {
          void Promise.allSettled([
            Promise.resolve(clearNativeBankMonitoring()),
            Promise.resolve(clearAllDueNotifications(previousUserId)),
            Promise.resolve(cancelDailyReminder()),
            Promise.resolve(unsubscribeBrowserWebPush()),
            Promise.resolve(unregisterNativeFcmPush(previousUserId)),
          ]);
        }
        resetAppState(queryClient, newUserId);
        void queryClient.invalidateQueries();
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
      } else if (event === "SIGNED_IN") {
        void queryClient.invalidateQueries();
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
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
            <AppUpdateToast />
            <ToastHost />
            <AppErrorBoundary>{children}</AppErrorBoundary>
          </Toaster>
        </ThemeProvider>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
