import { Navigate, Outlet } from "react-router";
import { useUserAccess } from "@/state";
import { Skeleton } from "@/components/ui";

/**
 * Guarda de rota que restringe o acesso exclusivamente a administradores e superadministradores (§F43).
 */
export function RequireAdmin() {
  const { isAdmin, isLoading } = useUserAccess();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
