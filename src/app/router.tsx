import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation } from "react-router";
import { appRoutes } from "@/app/routes";
import { Skeleton } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";
import { MoreMenu } from "@/components/layout/more-menu";
import { FloatingCalculator } from "@/components/modules/floating-calculator";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "@/features/auth";
import { LaunchWizard } from "@/features/transactions";
import { useAuth } from "@/hooks/use-auth";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";

/** Guard de autenticação: sem sessão → tela de login preservando a rota de origem. */
function RequireAuth() {
  const { session, loading, configError } = useAuth();
  const location = useLocation();

  // F23 — pre-fetching discreto dos chunks das rotas vizinhas (idle).
  useRoutePrefetch();

  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <pre className="max-w-xl whitespace-pre-wrap rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-foreground">
          {configError}
        </pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/entrar" replace state={{ from: location }} />;
  }

  // Wizard de tela cheia: fluxo focado, sem scroll-to-top (o botão flutuaria
  // sobre o painel centralizado do desktop).
  const isWizard = location.pathname === "/transacoes/novo";

  return (
    <>
      {/* Utilitários globais (F9): disponíveis em todas as telas autenticadas,
          incluindo o wizard de tela cheia (fora do PageShell). */}
      <FloatingCalculator />
      <ScrollToTopButton hidden={isWizard} />
      <Outlet />
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Telas de auth — fora do shell (sem sidebar/bottom nav) */}
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />

        {/* Áreas autenticadas */}
        <Route element={<RequireAuth />}>
          {/* Tela cheia guiada (D10) — fora do shell de navegação */}
          <Route path="/transacoes/novo" element={<LaunchWizard />} />
          <Route element={<PageShell />}>
            {appRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.Component />} />
            ))}
            <Route path="/mais" element={<MoreMenu />} />
            <Route path="*" element={<MoreMenu />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

