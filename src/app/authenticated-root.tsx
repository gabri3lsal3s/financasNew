import { lazy, Suspense } from "react";
import { Navigate } from "react-router";
import { OverviewSkeleton } from "@/components/layout/route-skeletons/finance-skeletons";
import { useUserAccess } from "@/state/queries/use-user-access";

const OverviewPage = lazy(() =>
  import("@/features/overview/pages/overview-page").then((m) => ({ default: m.OverviewPage })),
);

/**
 * Conteúdo da raiz autenticada (`/`): renderiza o painel financeiro ou redireciona
 * perfis exclusivos de investimentos para `/investments`.
 */
export function AuthenticatedHome() {
  const { hasFeature, isLoading } = useUserAccess();

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  const hasFinance =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("debts") ||
    hasFeature("budgets");

  // Perfil "Apenas Investimentos" não acessa o painel de finanças pessoais
  if (!hasFinance && hasFeature("investments")) {
    return <Navigate to="/investments" replace />;
  }

  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewPage />
    </Suspense>
  );
}

