import { Navigate, Outlet } from "react-router";
import { LoadingScreen } from "@/components/layout";
import { useUserAccess } from "@/state";

/**
 * Guarda de rota que garante que o usuário possui conta com status 'active' (§F43).
 * Redireciona usuários em 'pending_approval' para a tela de espera e
 * contas 'suspended' ou 'banned' para a tela de bloqueio.
 */
export function RequireActiveAccount() {
  const { isPendingApproval, isSuspended, isBanned, isLoading } = useUserAccess();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isPendingApproval) {
    return <Navigate to="/aprovacao-pendente" replace />;
  }

  if (isSuspended || isBanned) {
    return <Navigate to="/conta-suspensa" replace />;
  }

  return <Outlet />;
}
