import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/state/queries/use-user-access";

/**
 * Guarda de rota estrita que restringe o acesso exclusivamente a superadministradores ativos.
 * Administradores comuns autenticados são redirecionados para /admin/dashboard;
 * usuários sem sessão seguem para /admin/login e sessões sem AAL2 para /entrar?desafio=totp.
 */
export function RequireSuperAdmin() {
  const { session, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const { isSuperAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);
  const location = useLocation();

  const isLoading = authLoading || (Boolean(session?.user) && accessLoading);

  if (isLoading) {
    return <LoadingScreen statusText="Verificando nível de acesso de superadmin..." />;
  }

  if (!session?.user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (mfaRequired && !mfaVerified) {
    return <Navigate to="/entrar?desafio=totp" replace state={{ from: location }} />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
