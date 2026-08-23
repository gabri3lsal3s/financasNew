import { Navigate, Outlet } from "react-router";
import { useUserAccess } from "@/state";
import { Skeleton } from "@/components/ui";

/**
 * Guarda de rota que garante que o usuário possui conta com status 'active' (§F43).
 * Redireciona usuários em 'pending_approval' para a tela de espera e
 * contas 'suspended' ou 'banned' para a tela de bloqueio.
 */
export function RequireActiveAccount() {
  const { isPendingApproval, isSuspended, isBanned, isLoading } = useUserAccess();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isPendingApproval) {
    return <Navigate to="/aprovacao-pendente" replace />;
  }

  if (isSuspended || isBanned) {
    return <Navigate to="/conta-suspensa" replace />;
  }

  return <Outlet />;
}
