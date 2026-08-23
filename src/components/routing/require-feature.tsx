import { Navigate, Outlet } from "react-router";
import { useUserAccess } from "@/state";
import { Skeleton } from "@/components/ui";
import type { SystemFeatureKey } from "@/types";

export interface RequireFeatureProps {
  featureKey: SystemFeatureKey | string;
  redirectTo?: string;
}

/**
 * Guarda de rota que valida se uma Feature Flag está ativa para o usuário (§F43).
 */
export function RequireFeature({ featureKey, redirectTo = "/" }: RequireFeatureProps) {
  const { hasFeature, isLoading } = useUserAccess();

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

  if (!hasFeature(featureKey)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
