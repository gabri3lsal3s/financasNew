import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { appRoutes } from "@/app/routes";
import { LoadingScreen, PageShell } from "@/components/layout";
import { FloatingCalculator } from "@/components/modules/floating-calculator";
import { RequireActiveAccount, RequireAdmin, RequireFeature } from "@/components/routing";
import { useAuth } from "@/hooks/use-auth";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";
import { useUserAccess } from "@/state";
import {
  initBankNotificationListener,
  initDeepLinkListener,
  initNotificationActionListener,
} from "@/services/native";

/**
 * Importações dinâmicas (Code Splitting — FASE 23 Tarefa 43):
 * Páginas públicas, autenticação e checkout carregadas sob demanda,
 * reduzindo expressivamente o bundle inicial do App Shell.
 */
const LandingPage = lazy(() =>
  import("@/features/landing/pages/landing-page").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import("@/features/auth/pages/login-page").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/pages/register-page").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/pages/forgot-password-page").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const SubscriptionCheckoutPage = lazy(() =>
  import("@/features/subscription/pages/subscription-checkout-page").then((m) => ({
    default: m.SubscriptionCheckoutPage,
  })),
);
const SubscriptionSuccessPage = lazy(() =>
  import("@/features/subscription/pages/subscription-success-page").then((m) => ({
    default: m.SubscriptionSuccessPage,
  })),
);
const PendingApprovalPage = lazy(() =>
  import("@/features/auth/pages/pending-approval-page").then((m) => ({
    default: m.PendingApprovalPage,
  })),
);
const SuspendedAccountPage = lazy(() =>
  import("@/features/auth/pages/suspended-account-page").then((m) => ({
    default: m.SuspendedAccountPage,
  })),
);

function RouteSuspenseFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground animate-pulse">Carregando…</span>
      </div>
    </div>
  );
}

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
 * - Em transição/carregamento → exibe tela de carregamento oficial (`LoadingScreen`) sincronizada com Auth + Perfil/Acesso.
 * - Sessão ativa com dados de acesso prontos → renderiza rotas autenticadas isoladas por `key={session.user.id}`.
 */
function RequireAuth() {
  const { session, loading: authLoading, configError } = useAuth();
  const userAccess = useUserAccess();
  const location = useLocation();

  // F23 — pre-fetching discreto dos chunks das rotas vizinhas (idle).
  useRoutePrefetch();

  // O carregamento inicial só termina quando tanto a autenticação quanto os dados de perfil/permissões estiverem prontos
  const hasUser = Boolean(session?.user);
  const isDataLoading = authLoading || (hasUser && userAccess.isLoading);

  // Previne micro-flashes mantendo a tela de transição visível de forma estável e fluida (650ms)
  const { isShowing: isTransitioning, isClosing } = useMinimumLoading(isDataLoading, 650);

  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <pre className="max-w-xl whitespace-pre-wrap rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-foreground">
          {configError}
        </pre>
      </div>
    );
  }

  if (isDataLoading || isTransitioning || !session?.user) {
    if (!isDataLoading && !session?.user && !isTransitioning) {
      return <Navigate to="/entrar" replace state={{ from: location }} />;
    }

    let targetProgress: number;
    let stageText: string;

    if (isClosing) {
      targetProgress = 100;
      stageText = "Pronto!";
    } else if (authLoading) {
      targetProgress = 35;
      stageText = "Iniciando sessão segura…";
    } else if (userAccess.isLoading) {
      targetProgress = 75;
      stageText = "Sincronizando preferências e categorias…";
    } else {
      targetProgress = 92;
      stageText = "Preparando painel financeiro…";
    }

    return (
      <LoadingScreen
        progress={targetProgress}
        statusText={stageText}
        isClosing={isClosing}
      />
    );
  }

  return (
    <div key={session.user.id} className="contents">
      {/* Utilitários globais (F9): disponíveis em todas as telas autenticadas */}
      <FloatingCalculator />
      <Outlet />
    </div>
  );
}

/**
 * Escuta eventos do sistema operacional nativo (atalhos de launcher, deep links e
 * ações de notificações locais) redirecionando suavemente a navegação interna.
 */
function NativeIntegrationsHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const cleanupDeepLinks = initDeepLinkListener((path) => {
      navigate(path);
    });

    const cleanupNotifications = initNotificationActionListener((path) => {
      navigate(path);
    });

    const cleanupBankNotifications = initBankNotificationListener();

    return () => {
      void cleanupDeepLinks();
      void cleanupNotifications();
      void cleanupBankNotifications();
    };
  }, [navigate]);

  return null;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <NativeIntegrationsHandler />
      <Suspense fallback={<RouteSuspenseFallback />}>
        <Routes>
          {/* Páginas públicas de apresentação & planos */}
          <Route path="/apresentacao" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/precos" element={<LandingPage />} />
          <Route path="/planos" element={<LandingPage />} />
          <Route path="/vendas" element={<LandingPage />} />

          {/* Telas de auth — fora do shell (sem sidebar/bottom nav) */}
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/criar-conta" element={<RegisterPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />

          {/* Checkout de assinatura Pro — layout próprio (sem shell do app) */}
          <Route path="/assinatura" element={<SubscriptionCheckoutPage />} />
          <Route path="/assinar" element={<SubscriptionCheckoutPage />} />
          <Route path="/assinatura/sucesso" element={<SubscriptionSuccessPage />} />
          <Route path="/assinar/sucesso" element={<SubscriptionSuccessPage />} />

          {/* Telas de status da conta para usuários autenticados */}
          <Route element={<RequireAuth />}>
            <Route path="/aprovacao-pendente" element={<PendingApprovalPage />} />
            <Route path="/conta-suspensa" element={<SuspendedAccountPage />} />

            {/* Área protegida: Requer conta com status 'active' */}
            <Route element={<RequireActiveAccount />}>
              {/* Redirecionamento de compatibilidade para atalhos PWA / links legados / rotas unificadas */}
              <Route path="/transacoes/novo" element={<Navigate to="/transacoes?novo=transacao" replace />} />
              <Route path="/categorias" element={<Navigate to="/orcamentos" replace />} />
              <Route path="/investimentos" element={<Navigate to="/investments" replace />} />
              <Route path="/carteira" element={<Navigate to="/investments" replace />} />

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

                {/* Redirecionamento seguro para rotas legadas e fallback catch-all */}
                <Route path="/mais" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
