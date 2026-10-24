import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";
import { PWAUpdateToast } from "@/components/modules/pwa-update-toast";
import { NativeUpdateToast } from "@/components/modules/native-update-toast";
import { getSupabase } from "@/data/client";
import { resetAppState } from "@/services/auth-cleanup";
import { syncMerchantLearningFromCloud } from "@/services/merchant-learning";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { syncVisualWithCloud } from "@/hooks/use-visual-customization";
import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { useDynamicAppIcon } from "@/hooks/use-dynamic-app-icon";
import { SubscriptionProvider, useIsPro } from "@/state/subscription-context";
import { AppLockOverlay } from "@/app/app-lock-overlay";
import { AppErrorBoundary } from "@/components/layout";
import { initAppLockListener, setPrivacyShieldEnabled, syncDueReminderNotifications } from "@/services/native";
import { useReminders } from "@/state";
import { useAuth } from "@/hooks/use-auth";

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

      // Evento de Logout explícito
      if (event === "SIGNED_OUT") {
        resetAppState(queryClient, null);
      } else if (activeUserIdRef.current !== newUserId) {
        // Ao transicionar entre usuários ou de visitante (null) para logado:
        // Purgar cache não autenticado em memória para isolamento total
        resetAppState(queryClient, newUserId);
        void queryClient.invalidateQueries();
      } else if (event === "SIGNED_IN") {
        // Re-autenticação explícita: invalida todas as queries do app
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
 * Sincroniza preferências customizadas salvas na nuvem com o estado local do app.
 * Só é executado quando há usuário autenticado ativo para evitar queries não autorizadas.
 */
function CloudPreferencesSync({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return <CloudPreferencesSyncInner>{children}</CloudPreferencesSyncInner>;
}

function CloudPreferencesSyncInner({ children }: { children: ReactNode }) {
  const { data: preferences } = useUserPreferences();

  useEffect(() => {
    if (preferences?.custom_settings) {
      syncVisualWithCloud(preferences.custom_settings);
      if (preferences.custom_settings.privacyShieldEnabled !== undefined) {
        setPrivacyShieldEnabled(preferences.custom_settings.privacyShieldEnabled);
      }
      if (preferences.custom_settings.merchantLearning) {
        syncMerchantLearningFromCloud(preferences.custom_settings.merchantLearning);
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
 * Só é executado quando há usuário autenticado ativo para evitar queries prematuras.
 */
function RemindersNotificationSync() {
  const { user } = useAuth();
  if (!user) return null;
  return <RemindersNotificationSyncInner userId={user.id} />;
}

function RemindersNotificationSyncInner({ userId }: { userId: string }) {
  const { allItems, preferences } = useReminders();

  useEffect(() => {
    if (preferences.enabled && allItems.length > 0) {
      void syncDueReminderNotifications(allItems, userId);
    }
  }, [preferences.enabled, allItems, userId]);

  return null;
}

/**
 * Providers globais. A política de retry materializa a regra Online First
 * (docs/ARCHITECTURE.md §5.1): leituras com retry limitado (1 tentativa com backoff);
 * mutações NUNCA com retry automático (evita dupla submissão — o botão fica em isPending).
 * Calibração anti-storm (alta concorrência): refetchOnWindowFocus desabilitado,
 * refetchOnReconnect "always", staleTime padrão de 60s e gcTime de 10 minutos.
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
        <CloudPreferencesSync>
          <SubscriptionProvider>
            <DynamicBrandSync />
            <RemindersNotificationSync />
            <ThemeProvider>
              <Toaster>
                {/* Toast global de nova versão PWA (autoUpdate) — PWA_GUIDELINES §6 */}
                <PWAUpdateToast />
                {/* Toast global de nova versão Android nativa (Cloudflare R2 + APK in-app installer) */}
                <NativeUpdateToast />
                {/* Host do bus de toasts (services/toast) — rollbacks otimistas etc. */}
                <ToastHost />
                {/* Overlay de bloqueio biométrico do aplicativo */}
                <AppLockOverlay />
                <AppErrorBoundary>
                  {children}
                </AppErrorBoundary>
              </Toaster>
            </ThemeProvider>
          </SubscriptionProvider>
        </CloudPreferencesSync>
      </AuthQuerySync>
    </QueryClientProvider>
  );
}
