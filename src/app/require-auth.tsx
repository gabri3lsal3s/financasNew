import type { ReactNode } from "react";
import { Suspense, lazy, useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { AuthenticatedProviders } from "@/app/authenticated-providers";
import { useAuth } from "@/hooks/use-auth";
import { useIdleSessionTimeout } from "@/hooks/use-idle-session-timeout";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";
import { usePendingSplitExpense } from "@/hooks/use-pending-split-expense";
import { usePendingSimulation } from "@/hooks/use-pending-simulation";
import { useUserAccess } from "@/state";
import {
  getPendingRouteAfterUnlock,
  initBankNotificationListener,
  initDeepLinkListener,
  initNotificationActionListener,
  isAppLocked,
  setPendingRouteAfterUnlock,
  subscribeAppLock,
} from "@/services/native";

const FloatingCalculator = lazy(() =>
  import("@/components/modules/floating-calculator").then((m) => ({ default: m.FloatingCalculator })),
);
const ApkBetaRestrictedModal = lazy(() =>
  import("@/components/modules/apk-beta-restricted-modal").then((m) => ({ default: m.ApkBetaRestrictedModal })),
);

/**
 * Escuta eventos do sistema operacional nativo (atalhos de launcher, deep links e
 * ações de notificações locais) redirecionando suavemente a navegação interna.
 */
function NativeIntegrationsHandler() {
  const navigate = useNavigate();
  const { hasFeature } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");

  useEffect(() => {
    const handleNativeNavigation = (route: string) => {
      if (isAppLocked()) {
        setPendingRouteAfterUnlock(route);
      } else {
        navigate(route);
      }
    };

    const cleanupDeepLinks = initDeepLinkListener(handleNativeNavigation);
    const cleanupNotifications = initNotificationActionListener(handleNativeNavigation);
    const cleanupBankNotifications = isBankListenerAllowed
      ? initBankNotificationListener(handleNativeNavigation)
      : null;

    const cleanupAppLock = subscribeAppLock(() => {
      if (!isAppLocked()) {
        const pending = getPendingRouteAfterUnlock();
        if (pending) {
          setPendingRouteAfterUnlock(null);
          navigate(pending);
        }
      }
    });

    return () => {
      void cleanupDeepLinks();
      void cleanupNotifications();
      if (cleanupBankNotifications) {
        void cleanupBankNotifications();
      }
      cleanupAppLock();
    };
  }, [navigate, isBankListenerAllowed]);

  return null;
}

/**
 * Guard de autenticação e fronteira do App Shell.
 *
 * Este módulo é carregado sob demanda, fora do bundle inicial da landing page.
 * Só chega aqui quem possui token armazenado ou está no app nativo — visitantes
 * nunca baixam/executam stores, prefetch de rotas ou sincronizações de conta.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, loading: authLoading, configError, mfaRequired, mfaVerified } = useAuth();
  const userAccess = useUserAccess(session?.user?.id);
  const location = useLocation();
  usePendingSplitExpense();
  usePendingSimulation();
  useRoutePrefetch();
  useIdleSessionTimeout();

  const hasUser = Boolean(session?.user);
  const isAccessPending = hasUser && !userAccess.profile && !userAccess.error;
  const isDataLoading = authLoading || (hasUser && (userAccess.isLoading || isAccessPending));

  const { isShowing: isTransitioning, isClosing } = useMinimumLoading(isDataLoading, 650);

  if (!authLoading && session?.user && mfaRequired && !mfaVerified) {
    return <Navigate to="/entrar?desafio=totp" replace />;
  }

  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <pre className="max-w-xl whitespace-pre-wrap rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-foreground">
          {configError}
        </pre>
      </div>
    );
  }

  if (isDataLoading || isTransitioning || !session?.user) {
    if (!isDataLoading && !session?.user && !isTransitioning) {
      const isSettingsOrMais =
        location.pathname.startsWith("/configuracoes") || location.pathname === "/mais";
      return <Navigate to="/entrar" replace state={isSettingsOrMais ? undefined : { from: location }} />;
    }

    let targetProgress: number;
    let stageText: string;

    if (isClosing) {
      targetProgress = 100;
      stageText = "Pronto!";
    } else if (authLoading) {
      targetProgress = 35;
      stageText = "Iniciando sessão segura…";
    } else if (userAccess.isLoading) {
      targetProgress = 75;
      stageText = "Sincronizando preferências e categorias…";
    } else {
      targetProgress = 92;
      stageText = "Preparando painel financeiro…";
    }

    return <LoadingScreen progress={targetProgress} statusText={stageText} isClosing={isClosing} />;
  }

  return (
    <AuthenticatedProviders>
      <div key={session.user.id} className="contents">
        <Suspense fallback={null}>
          <FloatingCalculator />
          <ApkBetaRestrictedModal />
        </Suspense>
        <NativeIntegrationsHandler />
        {children ?? <Outlet />}
      </div>
    </AuthenticatedProviders>
  );
}
