import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { syncVisualWithCloud } from "@/hooks/use-visual-customization";

/**
 * Sincroniza o ciclo de vida do TanStack Query e das stores locais
 * com a sessão de autenticação do Supabase.
 * Ao deslogar (`SIGNED_OUT`) ou na troca de usuário (`userId` distinto),
 * invoca `resetAppState` cancelando requisições, limpando cache e restaurando
 * os padrões de fábrica no DOM e na memória.
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
        resetAppState(queryClient, newUserId);
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
 * Sincroniza preferências customizadas salvas na nuvem com o estado local do app.
 */
function CloudPreferencesSync({ children }: { children: ReactNode }) {
  const { data: preferences } = useUserPreferences();

  useEffect(() => {
    if (preferences?.custom_settings) {
      syncVisualWithCloud(preferences.custom_settings);
    }
  }, [preferences?.custom_settings]);

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
        <CloudPreferencesSync>
          <ThemeProvider>
            <Toaster>
              {/* Toast global de nova versão PWA (autoUpdate) — PWA_GUIDELINES §6 */}
              <PWAUpdateToast />
              {/* Host do bus de toasts (services/toast) — rollbacks otimistas etc. */}
              <ToastHost />
              {children}
            </Toaster>
          </ThemeProvider>
        </CloudPreferencesSync>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
