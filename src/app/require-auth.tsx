import type { ReactNode } from "react";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { AuthenticatedProviders } from "@/app/authenticated-providers";
import { useAuth, refreshMfaState } from "@/hooks/use-auth";
import { useDeviceSessionSync } from "@/hooks/use-device-session-sync";
import { useIdleSessionTimeout } from "@/hooks/use-idle-session-timeout";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";
import { usePendingSplitExpense } from "@/hooks/use-pending-split-expense";
import { usePendingSimulation } from "@/hooks/use-pending-simulation";
import { useRegisterFcmToken } from "@/state";
import { useUserAccess } from "@/state/queries/use-user-access";
import { getPendingRouteAfterUnlock, isAppLocked, setPendingRouteAfterUnlock, subscribeAppLock } from "@/services/native/app-lock";
import { initDeepLinkListener } from "@/services/native/deep-links";
import { initNotificationActionListener, isRemotePushEnabled } from "@/services/native/local-notifications";
import { isNativePlatform } from "@/services/native/platform";
import { checkNativePushPermission, getStoredFcmToken, initNativePushListeners, registerNativeFcmPush } from "@/services/push/fcm-push";
import { pushToast } from "@/services/toast";

const FloatingCalculator = lazy(() =>
  import("@/components/modules/floating-calculator").then((m) => ({ default: m.FloatingCalculator })),
);
const ApkBetaRestrictedModal = lazy(() =>
  import("@/components/modules/apk-beta-restricted-modal").then((m) => ({ default: m.ApkBetaRestrictedModal })),
);
const IdleSessionWarningModal = lazy(() =>
  import("@/components/modules/idle-session-warning-modal").then((m) => ({
    default: m.IdleSessionWarningModal,
  })),
);

/**
 * Escuta eventos do sistema operacional nativo (atalhos de launcher, deep links e
 * ações de notificações locais) redirecionando suavemente a navegação interna.
 */
function NativeIntegrationsHandler() {
  const navigate = useNavigate();
  const { hasFeature, isLoading: accessLoading, error: accessError } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");
  const { mutate: registerFcmToken } = useRegisterFcmToken();
  const registerFcmTokenRef = useRef(registerFcmToken);

  useEffect(() => {
    registerFcmTokenRef.current = registerFcmToken;
  }, [registerFcmToken]);

  useEffect(() => {
    if (isNativePlatform() && !accessLoading && !accessError && !isBankListenerAllowed) {
      void import("@/services/native/bank-listener").then(({ clearNativeBankMonitoring }) =>
        clearNativeBankMonitoring(),
      );
    }
  }, [accessLoading, accessError, isBankListenerAllowed]);

  useEffect(() => {
    if (!isNativePlatform() || !isRemotePushEnabled() || getStoredFcmToken()) {
      return;
    }
    let cancelled = false;
    void checkNativePushPermission().then(async (perm) => {
      if (cancelled || perm !== "granted") return;
      const result = await registerNativeFcmPush({ requestPermission: false });
      if (!cancelled && result.ok) {
        registerFcmTokenRef.current({
          fcmToken: result.token,
          deviceLabel: "Android App",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const cleanupRemotePush = initNativePushListeners({
      onActionPerformed: handleNativeNavigation,
      onTokenRefresh: (token) => {
        if (isRemotePushEnabled()) {
          registerFcmTokenRef.current({
            fcmToken: token,
            deviceLabel: "Android App",
          });
        }
      },
      onForegroundPush: ({ title, body }) => {
        if (title) {
          pushToast({ title, description: body, variant: "default" });
        }
      },
    });
    let cancelled = false;
    let cleanupBankNotifications: (() => Promise<void> | void) | null = null;
    if (isBankListenerAllowed && isNativePlatform()) {
      void import("@/services/native/bank-listener").then(({ initBankNotificationListener }) => {
        if (!cancelled) {
          cleanupBankNotifications = initBankNotificationListener(handleNativeNavigation);
        }
      });
    }

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
      cancelled = true;
      void cleanupDeepLinks();
      void cleanupNotifications();
      void cleanupRemotePush();
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
  const { session, loading: authLoading, configError, mfaRequired, mfaVerified, mfaError } = useAuth();
  const userAccess = useUserAccess(session?.user?.id);
  const location = useLocation();
  usePendingSplitExpense();
  usePendingSimulation();
  useRoutePrefetch();
  const idleSession = useIdleSessionTimeout();
  useDeviceSessionSync();

  const hasUser = Boolean(session?.user);
  const isAccessPending = hasUser && !userAccess.profile && !userAccess.error;
  const isDataLoading = authLoading || (hasUser && (userAccess.isLoading || isAccessPending));

  const { isShowing: isTransitioning, isClosing } = useMinimumLoading(isDataLoading, 650);

  if (!authLoading && session?.user && mfaError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="max-w-md space-y-4 rounded-xl border border-critical/40 bg-surface p-6 text-center shadow-xs">
          <p className="text-sm font-medium text-foreground">{mfaError}</p>
          <button
            type="button"
            onClick={() => void refreshMfaState()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

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
          <IdleSessionWarningModal
            open={idleSession.isWarningVisible}
            secondsRemaining={idleSession.secondsRemaining}
            onStayConnected={idleSession.stayConnected}
            onSignOutNow={idleSession.signOutNow}
          />
        </Suspense>
        <NativeIntegrationsHandler />
        {children ?? <Outlet />}
      </div>
    </AuthenticatedProviders>
  );
}
