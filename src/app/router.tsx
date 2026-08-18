import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation } from "react-router";
import { appRoutes } from "@/app/routes";
import { LoadingScreen, MoreMenu, PageShell } from "@/components/layout";
import { FloatingCalculator } from "@/components/modules/floating-calculator";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "@/features/auth";
import { LandingPage } from "@/features/landing";
import { useAuth } from "@/hooks/use-auth";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";

/**
 * Guard de autenticação:
 * - Sem sessão → redireciona para a tela de login preservando a rota de origem.
 * - Em transição/carregamento → exibe tela de carregamento oficial (`LoadingScreen`) com tempo mínimo anti-flicker.
 * - Sessão ativa → renderiza rotas autenticadas isoladas por `key={session.user.id}`.
 */
function RequireAuth() {
  const { session, loading, configError } = useAuth();
  const location = useLocation();

  // F23 — pre-fetching discreto dos chunks das rotas vizinhas (idle).
  useRoutePrefetch();

  // Previne micro-flashes mantendo a tela de transição visível de forma estável e fluida (650ms)
  const isTransitioning = useMinimumLoading(loading, 650);

  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <pre className="max-w-xl whitespace-pre-wrap rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-foreground">
          {configError}
        </pre>
      </div>
    );
  }

  if (loading || isTransitioning || !session?.user) {
    if (!loading && !session && !isTransitioning) {
      return <Navigate to="/entrar" replace state={{ from: location }} />;
    }
    return <LoadingScreen />;
  }

  return (
    <div key={session.user.id} className="contents">
      {/* Utilitários globais (F9): disponíveis em todas as telas autenticadas,
          incluindo modais e drawers em overlay. */}
      <FloatingCalculator />
      <Outlet />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Páginas públicas de apresentação & planos */}
        <Route path="/apresentacao" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/precos" element={<LandingPage />} />

        {/* Telas de auth — fora do shell (sem sidebar/bottom nav) */}
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />

        {/* Áreas autenticadas */}
        <Route element={<RequireAuth />}>
          {/* Redirecionamento de compatibilidade para atalhos PWA / links legados */}
          <Route path="/transacoes/novo" element={<Navigate to="/transacoes?novo=transacao" replace />} />
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
