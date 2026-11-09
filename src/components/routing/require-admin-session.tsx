import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingScreen } from "@/components/layout";
import { useUserAccess } from "@/state";
import { useAuth } from "@/hooks/use-auth";

/**
 * Guarda de rota estrita que restringe o acesso exclusivamente a administradores e superadministradores.
 * Redireciona usuários desautenticados ou com contas regulares para o portal exclusivo /admin/login.
 */
export function RequireAdminSession() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);
  const location = useLocation();

  const isLoading = authLoading || (Boolean(session?.user) && accessLoading);

  if (isLoading) {
    return <LoadingScreen statusText="Verificando credenciais de operador…" />;
  }

  if (!session?.user || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
