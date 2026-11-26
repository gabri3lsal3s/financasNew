import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { IdleSessionWarningModal } from "@/components/modules/idle-session-warning-modal";
import { useAuth } from "@/hooks/use-auth";
import { useIdleSessionTimeout } from "@/hooks/use-idle-session-timeout";
import { useUserAccess } from "@/state/queries/use-user-access";

/**
 * Guarda de rota estrita que restringe o acesso exclusivamente a administradores e superadministradores.
 * Redireciona usuários desautenticados ou com contas regulares para o portal exclusivo /admin/login.
 * Impõe política estrita de inatividade de 30 minutos com aviso prévio de 60 segundos.
 */
export function RequireAdminSession() {
  const { session, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);
  const location = useLocation();
  const idleSession = useIdleSessionTimeout({
    forcedPolicy: "30m",
    warningSeconds: 60,
    enabled: !authLoading && Boolean(session?.user) && isAdmin && !(mfaRequired && !mfaVerified),
  });

  const isLoading = authLoading || (Boolean(session?.user) && accessLoading);

  if (isLoading) {
    return <LoadingScreen statusText="Verificando credenciais de operador…" />;
  }

  if (!session?.user || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (mfaRequired && !mfaVerified) {
    return <Navigate to="/entrar?desafio=totp" replace state={{ from: location }} />;
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
