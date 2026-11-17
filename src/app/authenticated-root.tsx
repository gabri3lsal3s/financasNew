import { lazy, Suspense } from "react";
import { Navigate } from "react-router";
import { OverviewSkeleton } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";
import { RequireActiveAccount } from "@/components/routing/require-active-account";
import { RequireAuth } from "@/app/require-auth";
import { useUserAccess } from "@/state";

const OverviewPage = lazy(() =>
  import("@/features/overview/pages/overview-page").then((m) => ({ default: m.OverviewPage })),
);

function OverviewOrInvestmentsRedirect() {
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

/**
 * Raiz autenticada (`/`): carregada somente após confirmação síncrona de sessão
 * ou no aplicativo nativo. Mantém a landing page fora do grafo do App Shell.
 */
export function AuthenticatedRoot() {
  return (
    <RequireAuth>
      <RequireActiveAccount>
        <PageShell>
          <OverviewOrInvestmentsRedirect />
        </PageShell>
      </RequireActiveAccount>
    </RequireAuth>
  );
}

