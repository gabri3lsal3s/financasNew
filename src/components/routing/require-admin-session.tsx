import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { IdleSessionWarningModal } from "@/components/modules/idle-session-warning-modal";
import { verifyAdminPortalGrant } from "@/state/queries/use-admin-portal-grant";
import { useAuth } from "@/hooks/use-auth";
import { useIdleSessionTimeout } from "@/hooks/use-idle-session-timeout";
import { useUserAccess } from "@/state/queries/use-user-access";

/**
 * Guarda de rota estrita que restringe o acesso exclusivamente a administradores e superadministradores.
 * Exige sessão autenticada, AAL2 verificado e concessão ativa do portal administrativo (private_auth).
 * Redireciona usuários desautenticados ou sem concessão para o portal exclusivo /admin/login.
 * Impõe política estrita de inatividade de 30 minutos com aviso prévio de 60 segundos.
 */
const GRANT_CHECK_TIMEOUT_MS = 10_000;

export function RequireAdminSession() {
  const { session, loading: authLoading, mfaRequired, mfaVerified, mfaError } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);
  const location = useLocation();
  const mfaPending = (mfaRequired && !mfaVerified) || Boolean(mfaError);
  const canCheckGrant = !authLoading && !accessLoading && Boolean(session?.user) && isAdmin && !mfaPending;

  const [grantState, setGrantState] = useState<{
    checkedForUserId: string | null;
    granted: boolean;
    reason: string | null;
  }>({ checkedForUserId: null, granted: false, reason: null });

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!canCheckGrant || !userId) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<{ granted: false; reason: string }>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ granted: false, reason: "timeout" });
      }, GRANT_CHECK_TIMEOUT_MS);
    });

    Promise.race([verifyAdminPortalGrant(), timeoutPromise])
      .then((res) => {
        if (!cancelled) {
          setGrantState({
            checkedForUserId: userId,
            granted: res.granted,
            reason: res.reason ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGrantState({ checkedForUserId: userId, granted: false, reason: "rpc_error" });
        }
      })
      .finally(() => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [canCheckGrant, session?.user?.id]);

  const grantLoading = canCheckGrant && grantState.checkedForUserId !== session?.user?.id;
  const portalGranted = canCheckGrant && !grantLoading && grantState.granted;

  const idleSession = useIdleSessionTimeout({
    forcedPolicy: "30m",
    warningSeconds: 60,
    enabled: portalGranted,
  });

  const isLoading = authLoading || (Boolean(session?.user) && accessLoading) || grantLoading;

  if (isLoading) {
    return <LoadingScreen statusText="Verificando credenciais de operador…" />;
  }

  if (!session?.user || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (mfaPending || grantState.reason === "admin_aal2_required") {
    return <Navigate to="/entrar?desafio=totp" replace state={{ from: location }} />;
  }

  if (!portalGranted) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location, portalDeniedReason: grantState.reason ?? "portal_grant_missing" }}
      />
    );
  }

  return (
    <>
      <IdleSessionWarningModal
        open={idleSession.isWarningVisible}
        secondsRemaining={idleSession.secondsRemaining}
        onStayConnected={idleSession.stayConnected}
        onSignOutNow={idleSession.signOutNow}
      />
      <Outlet />
    </>
  );
}
