import { Navigate, Outlet } from "react-router";
import { LoadingScreen } from "@/components/layout";
import { useUserAccess } from "@/state";

/**
 * Guarda de rota que restringe o acesso exclusivamente a administradores e superadministradores (§F43).
 */
export function RequireAdmin() {
  const { isAdmin, isLoading } = useUserAccess();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
