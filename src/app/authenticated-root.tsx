import { lazy, Suspense } from "react";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageShell } from "@/components/layout/page-shell";
import { RequireActiveAccount } from "@/components/routing/require-active-account";
import { RequireAuth } from "@/app/require-auth";

const OverviewPage = lazy(() =>
  import("@/features/overview/pages/overview-page").then((m) => ({ default: m.OverviewPage })),
);

/**
 * Raiz autenticada (`/`): carregada somente após confirmação síncrona de sessão
 * ou no aplicativo nativo. Mantém a landing page fora do grafo do App Shell.
 */
export function AuthenticatedRoot() {
  return (
    <RequireAuth>
      <RequireActiveAccount>
        <PageShell>
          <Suspense fallback={<LoadingScreen fullScreen={false} statusText="Carregando visão geral…" />}>
            <OverviewPage />
          </Suspense>
        </PageShell>
      </RequireActiveAccount>
    </RequireAuth>
  );
}
