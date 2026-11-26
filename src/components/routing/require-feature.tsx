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
  const { hasFeature, isAdmin, isLoading, error, refetch } = useUserAccess(session?.user?.id);

  if (authLoading || isLoading || !session?.user) {
    return <RouteSkeletonFallback />;
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <div className="max-w-md space-y-3 rounded-xl border border-border/80 bg-surface p-5 text-center shadow-xs">
          <p className="text-sm text-foreground">
            Não foi possível validar suas permissões de acesso no momento.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!hasFeature(featureKey)) {
    const target = redirectTo ?? resolveLandingPath(hasFeature, isAdmin);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
