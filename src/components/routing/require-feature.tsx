import { Navigate, Outlet } from "react-router";
import { RouteSkeletonFallback } from "@/components/layout/route-skeletons/route-skeleton-fallback";
import { resolveLandingPath } from "@/domain/navigation/nav-resolver";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/state/queries/use-user-access";
import type { SystemFeatureKey } from "@/types";

export interface RequireFeatureProps {
  featureKey: SystemFeatureKey | string;
  redirectTo?: string;
}

/**
 * Guarda de rota que valida se uma Feature Flag está ativa para o usuário (§F43).
 * Se desabilitada, redireciona de forma inteligente para a primeira rota permitida.
 */
export function RequireFeature({ featureKey, redirectTo }: RequireFeatureProps) {
  const { session, loading: authLoading } = useAuth();
  const { hasFeature, isAdmin, isLoading } = useUserAccess(session?.user?.id);

  if (authLoading || isLoading || !session?.user) {
    return <RouteSkeletonFallback />;
  }

  if (!hasFeature(featureKey)) {
    const target = redirectTo ?? resolveLandingPath(hasFeature, isAdmin);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
