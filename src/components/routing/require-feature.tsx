import { Navigate, Outlet } from "react-router";
import { LoadingScreen } from "@/components/layout";
import { resolveLandingPath } from "@/domain/navigation";
import { useUserAccess } from "@/state";
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
  const { hasFeature, isAdmin, isLoading } = useUserAccess();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!hasFeature(featureKey)) {
    const target = redirectTo ?? resolveLandingPath(hasFeature, isAdmin);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
