import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { checkPWAUpdateNow } from "@/app/pwa";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { initAppLockListener } from "@/services/native/app-lock";
import { isNativePlatform } from "@/services/native/platform";

function clearSessionNotifications(previousUserId: string | null) {
  void Promise.allSettled([
    import("@/services/push/web-push").then(({ unsubscribeBrowserWebPush }) =>
      unsubscribeBrowserWebPush(),
    ),
    import("@/services/native/local-notifications").then(
      ({ clearAllDueNotifications, cancelDailyReminder }) =>
        Promise.allSettled([clearAllDueNotifications(previousUserId), cancelDailyReminder()]),
    ),
    ...(isNativePlatform()
      ? [
          import("@/services/native/bank-listener").then(({ clearNativeBankMonitoring }) =>
            clearNativeBankMonitoring(),
          ),
          import("@/services/push/fcm-push").then(({ unregisterNativeFcmPush }) =>
            unregisterNativeFcmPush(previousUserId),
          ),
        ]
      : []),
  ]);
}

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

    const parseJwtAal = (token?: string): string | null => {
      if (!token) return null;
      try {
        const parts = token.split(".");
        if (parts.length !== 3 || !parts[1]) return null;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(b64)) as { aal?: unknown };
        return typeof payload.aal === "string" ? payload.aal : null;
      } catch {
        return null;
      }
    };
    let lastAal: string | null = null;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      const previousUserId = activeUserIdRef.current;
      const nextAal = parseJwtAal(session?.access_token);

      if (event === "SIGNED_OUT") {
        clearSessionNotifications(previousUserId);
        resetAppState(queryClient, null);
        lastAal = null;
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
      } else if (previousUserId !== newUserId) {
        if (previousUserId && previousUserId !== newUserId) {
          clearSessionNotifications(previousUserId);
        }
        resetAppState(queryClient, newUserId);
        void queryClient.invalidateQueries();
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
        lastAal = nextAal;
      } else if (event === "MFA_CHALLENGE_VERIFIED" || (lastAal !== "aal2" && nextAal === "aal2")) {
        void queryClient.invalidateQueries();
        lastAal = nextAal;
      } else if (nextAal) {
        lastAal = nextAal;
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
 * Provedores de dados das rotas com sessão ou consultas, incluindo login,
 * checkout e compartilhamentos públicos. O shell editorial não importa este módulo.
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
      <AuthQuerySync>{children}</AuthQuerySync>
    </QueryClientProvider>
  );
}
