import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation } from "react-router";
import { appRoutes } from "@/app/routes";
import { LoadingScreen, MoreMenu, PageShell } from "@/components/layout";
import { FloatingCalculator } from "@/components/modules/floating-calculator";
import { RequireActiveAccount, RequireAdmin, RequireFeature } from "@/components/routing";
import {
  ForgotPasswordPage,
  LoginPage,
  PendingApprovalPage,
  RegisterPage,
  SuspendedAccountPage,
} from "@/features/auth";
import { LandingPage } from "@/features/landing";
import { useAuth } from "@/hooks/use-auth";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";

/** Mapeamento de rotas para suas respectivas Feature Flags (§F43). */
const ROUTE_FEATURE_MAP: Record<string, string> = {
  "/": "overview",
  "/transacoes": "transactions",
  "/cartoes": "cards",
  "/dividas": "debts",
  "/orcamentos": "budgets",
  "/relatorios": "reports",
  "/insights": "insights",
  "/investments": "investments",
  "/lembretes": "reminders",
};

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
  const { isShowing: isTransitioning, isClosing } = useMinimumLoading(loading, 650);

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
    return <LoadingScreen isClosing={isClosing} />;
  }

  return (
    <div key={session.user.id} className="contents">
      {/* Utilitários globais (F9): disponíveis em todas as telas autenticadas */}
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
        <Route path="/criar-conta" element={<RegisterPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />

        {/* Telas de status da conta para usuários autenticados */}
        <Route element={<RequireAuth />}>
          <Route path="/aprovacao-pendente" element={<PendingApprovalPage />} />
          <Route path="/conta-suspensa" element={<SuspendedAccountPage />} />

          {/* Área protegida: Requer conta com status 'active' */}
          <Route element={<RequireActiveAccount />}>
            {/* Redirecionamento de compatibilidade para atalhos PWA / links legados / rotas unificadas */}
            <Route path="/transacoes/novo" element={<Navigate to="/transacoes?novo=transacao" replace />} />
            <Route path="/categorias" element={<Navigate to="/orcamentos" replace />} />

            <Route element={<PageShell />}>
              {appRoutes
                .filter((r) => r.path !== "/admin")
                .map((route) => {
                  const featureKey = ROUTE_FEATURE_MAP[route.path];
                  if (featureKey) {
                    return (
                      <Route key={route.path} element={<RequireFeature featureKey={featureKey} />}>
                        <Route path={route.path} element={<route.Component />} />
                      </Route>
                    );
                  }
                  return <Route key={route.path} path={route.path} element={<route.Component />} />;
                })}

              {/* Rota restrita de administração */}
              <Route element={<RequireAdmin />}>
                {appRoutes
                  .filter((r) => r.path === "/admin")
                  .map((route) => (
                    <Route key={route.path} path={route.path} element={<route.Component />} />
                  ))}
              </Route>

              <Route path="/mais" element={<MoreMenu />} />
              <Route path="*" element={<MoreMenu />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
