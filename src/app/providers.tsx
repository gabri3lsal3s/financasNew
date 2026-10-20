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
import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { useDynamicAppIcon } from "@/hooks/use-dynamic-app-icon";
import { SubscriptionProvider, useIsPro } from "@/state/subscription-context";
import { AppLockOverlay } from "@/app/app-lock-overlay";
import { initAppLockListener, setPrivacyShieldEnabled, syncDueReminderNotifications } from "@/services/native";
import { useReminders } from "@/state";

import {
  USER_ACCESS_KEY,
  USER_FEATURES_KEY,
  USER_SUBSCRIPTION_KEY,
} from "@/state";

/**
 * Sincroniza o ciclo de vida do TanStack Query e das stores locais
 * com a sessão de autenticação do Supabase.
 * Ao deslogar (`SIGNED_OUT`) ou na troca de usuário (`userId` distinto),
 * invoca `resetAppState` cancelando requisições, limpando cache e restaurando
 * os padrões de fábrica no DOM e na memória.
 * No login (`SIGNED_IN`) ou identificação de novo usuário ativo, invalida queries
 * de controle de acesso para garantir dados frescos e atualizados.
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
      } else if (event === "SIGNED_IN" || (newUserId && activeUserIdRef.current !== newUserId)) {
        // Ao autenticar ou inicializar com usuário ativo, invalida queries de acesso/permissão
        // garantindo que dados frescos e autenticados sejam carregados imediatamente
        void queryClient.invalidateQueries({ queryKey: USER_ACCESS_KEY });
        void queryClient.invalidateQueries({ queryKey: USER_FEATURES_KEY });
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
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
      if (preferences.custom_settings.privacyShieldEnabled !== undefined) {
        setPrivacyShieldEnabled(preferences.custom_settings.privacyShieldEnabled);
      }
    }
  }, [preferences?.custom_settings]);

  return <>{children}</>;
}

function DynamicBrandSync() {
  const isPro = useIsPro();
  useDynamicFavicon(isPro);
  useDynamicAppIcon(isPro);
  return null;
}

/**
 * Sincroniza e despacha lembretes de contas e faturas para o sistema operacional
 * (Android via LocalNotifications ou PWA via Web Notification API) quando autorizado.
 */
function RemindersNotificationSync() {
  const { allItems, preferences } = useReminders();

  useEffect(() => {
    if (preferences.enabled && allItems.length > 0) {
      void syncDueReminderNotifications(allItems);
    }
  }, [preferences.enabled, allItems]);

  return null;
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

  useEffect(() => {
    const cleanup = initAppLockListener();
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQuerySync>
        <CloudPreferencesSync>
          <SubscriptionProvider>
            <DynamicBrandSync />
            <RemindersNotificationSync />
            <ThemeProvider>
              <Toaster>
                {/* Toast global de nova versão PWA (autoUpdate) — PWA_GUIDELINES §6 */}
                <PWAUpdateToast />
                {/* Host do bus de toasts (services/toast) — rollbacks otimistas etc. */}
                <ToastHost />
                {/* Overlay de bloqueio biométrico do aplicativo */}
                <AppLockOverlay />
                {children}
              </Toaster>
            </ThemeProvider>
          </SubscriptionProvider>
        </CloudPreferencesSync>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
