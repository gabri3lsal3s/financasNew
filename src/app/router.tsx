import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  ROUTE_CHECK_THROTTLE_MS,
  applyPendingPWAUpdateIfSafe,
  checkPWAUpdateNow,
  isCredentialRoute,
} from "@/app/pwa";
import { appRoutes, publicLegalRoutes, publicToolsRoutes } from "@/app/routes";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { ScrollRestoration } from "@/components/routing/scroll-restoration";
import { isNativePlatform } from "@/services/native/platform";

/**
 * Guards e App Shell carregados sob demanda: a landing page não deve baixar
 * stores, sincronizações de conta nem os hooks de prefetch/segurança do app.
 */
const AppProviders = lazy(() =>
  import("@/app/providers").then((m) => ({ default: m.AppProviders })),
);
const PageShell = lazy(() =>
  import("@/components/layout/page-shell").then((m) => ({ default: m.PageShell })),
);
const AuthenticatedHome = lazy(() =>
  import("@/app/authenticated-root").then((m) => ({ default: m.AuthenticatedHome })),
);
const RequireAuth = lazy(() =>
  import("@/app/require-auth").then((m) => ({ default: m.RequireAuth })),
);
const RequireActiveAccount = lazy(() =>
  import("@/components/routing/require-active-account").then((m) => ({
    default: m.RequireActiveAccount,
  })),
);
const RequireAdminSession = lazy(() =>
  import("@/components/routing/require-admin-session").then((m) => ({
    default: m.RequireAdminSession,
  })),
);
const RequireSuperAdmin = lazy(() =>
  import("@/components/routing/require-super-admin").then((m) => ({
    default: m.RequireSuperAdmin,
  })),
);
const RequireFeature = lazy(() =>
  import("@/components/routing/require-feature").then((m) => ({ default: m.RequireFeature })),
);

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
const ResetPasswordPage = lazy(() =>
  import("@/features/auth/pages/reset-password-page").then((m) => ({
    default: m.ResetPasswordPage,
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
const ShareTargetPage = lazy(() =>
  import("@/features/transactions/pages/share-target-page").then((m) => ({
    default: m.ShareTargetPage,
  })),
);
const SplitPublicPage = lazy(() =>
  import("@/features/public-share/pages/split-public-page").then((m) => ({
    default: m.SplitPublicPage,
  })),
);
const FamilyBudgetPage = lazy(() =>
  import("@/features/public-share/pages/family-budget-page").then((m) => ({
    default: m.FamilyBudgetPage,
  })),
);
const GoalTrackerPublicPage = lazy(() =>
  import("@/features/public-share/pages/goal-tracker-public-page").then((m) => ({
    default: m.GoalTrackerPublicPage,
  })),
);
const FamilyInvitePage = lazy(() =>
  import("@/features/family/pages/family-invite-page").then((m) => ({
    default: m.FamilyInvitePage,
  })),
);
const TripPublicPage = lazy(() =>
  import("@/features/public-share/pages/trip-public-page").then((m) => ({
    default: m.TripPublicPage,
  })),
);
const AdminLoginPage = lazy(() =>
  import("@/features/admin/pages/admin-login-page").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminShell = lazy(() =>
  import("@/features/admin/layouts/admin-shell").then((m) => ({ default: m.AdminShell })),
);
const AdminDashboardPage = lazy(() =>
  import("@/features/admin/pages/admin-dashboard-page").then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import("@/features/admin/pages/admin-users-page").then((m) => ({ default: m.AdminUsersPage })),
);
const AdminNotificationsPage = lazy(() =>
  import("@/features/admin/pages/admin-notifications-page").then((m) => ({ default: m.AdminNotificationsPage })),
);
const AdminBillingPage = lazy(() =>
  import("@/features/admin/pages/admin-billing-page").then((m) => ({ default: m.AdminBillingPage })),
);
const AdminTicketsPage = lazy(() =>
  import("@/features/admin/pages/admin-tickets-page").then((m) => ({ default: m.AdminTicketsPage })),
);
const AdminInvitesPage = lazy(() =>
  import("@/features/admin/pages/admin-invites-page").then((m) => ({ default: m.AdminInvitesPage })),
);
const AdminSecurityPage = lazy(() =>
  import("@/features/admin/pages/admin-security-page").then((m) => ({ default: m.AdminSecurityPage })),
);
const AdminForensicsPage = lazy(() =>
  import("@/features/admin/forensics/pages/admin-forensics-page").then((m) => ({
    default: m.AdminForensicsPage,
  })),
);
const AdminSettingsPage = lazy(() =>
  import("@/features/admin/pages/admin-settings-page").then((m) => ({ default: m.AdminSettingsPage })),
);


/** Mapeamento de rotas para suas respectivas Feature Flags (§F43). */
const ROUTE_FEATURE_MAP: Record<string, string> = {
  "/": "overview",
  "/transacoes": "transactions",
  "/cartoes": "cards",
  "/dividas": "debts",
  "/orcamentos": "budgets",
  "/categorias": "budgets",
  "/relatorios": "reports",
  "/insights": "insights",
  "/investments": "investments",
  "/lembretes": "reminders",
  "/familia": "transactions",
  "/modo-familia": "transactions",
  "/viagens": "transactions",
  "/viagens/:id": "transactions",
  "/negocio": "transactions",
};

function hasStoredAuthSession(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const item = window.localStorage.getItem(key);
        if (item && item.includes("access_token")) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function isAnonymousHome(pathname: string): boolean {
  return pathname === "/" && !isNativePlatform() && !hasStoredAuthSession();
}

const EDITORIAL_PATHS = ["/apresentacao", "/landing", "/precos", "/planos", "/vendas"];

function RouteProviders({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const editorialPath = EDITORIAL_PATHS.includes(pathname.replace(/\/+$/, "").toLowerCase());
  const needsData = isNativePlatform() || !(editorialPath || isAnonymousHome(pathname));
  const [hasActivatedData, setHasActivatedData] = useState(needsData);

  // Depois do primeiro acesso a dados, mantenha cache e listener de sessão
  // ativos inclusive ao voltar para uma rota editorial na mesma aba.
  if (needsData && !hasActivatedData) setHasActivatedData(true);

  return hasActivatedData ? <AppProviders>{children}</AppProviders> : children;
}

/**
 * Entrada da área autenticada: visitantes web sem token na raiz `/` recebem
 * a landing page imediatamente, sem montar guards, stores ou sincronizações do App Shell.
 * Usuários logados e o app nativo compartilham a mesma instância de `PageShell`
 * entre `/` e as demais rotas protegidas.
 */
function AuthenticatedAreaEntry() {
  const { pathname } = useLocation();

  if (isAnonymousHome(pathname)) {
    return <LandingPage />;
  }

  return <RequireAuth />;
}

/**
 * Redireciona para rota de destino preservando parâmetros de busca (query strings).
 */
function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

/**
 * Normaliza automaticamente links compartilhados acessados com fragmento de hash
 * (ex.: /#/r/:token, #r/:token, /#/orcamento-familiar/:token, /#/meta/:token, /#/viagem/:token)
 * gerados por clientes de e-mail, WebViews antigas ou mensageiros móveis.
 */
function HashRouteNormalizer() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 3) return;

    const cleanHash = hash.replace(/^#\/?/, "/");
    const isPublicSharedRoute =
      cleanHash.startsWith("/r/") ||
      cleanHash.startsWith("/orcamento-familiar/") ||
      cleanHash.startsWith("/meta/") ||
      cleanHash.startsWith("/convite-familiar/") ||
      cleanHash.startsWith("/viagem/") ||
      cleanHash.startsWith("/ferramentas/");

    if (isPublicSharedRoute) {
      navigate(cleanHash, { replace: true });
    }
  }, [navigate]);

  return null;
}

/**
 * Sincroniza atualizações do PWA de forma confortável nas transições de rota:
 * - Em telas de credenciais (/entrar, /cadastro, /recuperar-senha, /admin/login):
 *   verifica imediatamente e aplica atualização silenciosa antes da digitação.
 * - Na navegação normal entre páginas: se houver atualização pronta e nenhum
 *   modal/wizard/campo em edição estiver ativo, aplica a atualização na troca de rota;
 *   caso contrário, faz verificação passiva em background (throttle 2 min).
 */
function PWAUpdateRouteSync() {
  const location = useLocation();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPathname = location.pathname;

    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = currentPathname;
      if (isCredentialRoute(currentPathname)) {
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
      }
      return;
    }

    if (previousPathnameRef.current === currentPathname) {
      return;
    }
    previousPathnameRef.current = currentPathname;

    if (isCredentialRoute(currentPathname)) {
      if (!applyPendingPWAUpdateIfSafe()) {
        void checkPWAUpdateNow({ force: true, applyIfSafe: true });
      }
      return;
    }

    void checkPWAUpdateNow({
      throttleMs: ROUTE_CHECK_THROTTLE_MS,
      applyIfSafe: false,
    });
  }, [location.pathname]);

  return null;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollRestoration />
      <HashRouteNormalizer />
      <PWAUpdateRouteSync />
      <Suspense fallback={<LoadingScreen statusText="Iniciando sessão segura…" />}>
        <RouteProviders>
          <Routes>
            {/* Páginas públicas de apresentação & planos */}
            {EDITORIAL_PATHS.map((path) => (
              <Route key={path} path={path} element={<LandingPage />} />
            ))}

            {/* Rotas públicas de compartilhamento (Racha de Contas, Orçamento Familiar & Termômetro de Meta) */}
            <Route path="/r/:token" element={<SplitPublicPage />} />
            <Route path="/orcamento-familiar/:token" element={<FamilyBudgetPage />} />
            <Route path="/meta/:token" element={<GoalTrackerPublicPage />} />
            <Route path="/convite-familiar/:token" element={<FamilyInvitePage />} />
            <Route path="/viagem/:token" element={<TripPublicPage />} />

            {/* Rotas públicas de simuladores financeiros abertos (Fase 5) */}
            {publicToolsRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.Component />} />
            ))}

            {/* Páginas públicas legais e regulatórias (fora do shell autenticado) */}
            {publicLegalRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.Component />} />
            ))}

            {/* Telas de auth — fora do shell (sem sidebar/bottom nav) */}
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/cadastrar" element={<RegisterPage />} />
            <Route path="/criar-conta" element={<RegisterPage />} />
            <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/atualizar-senha" element={<ResetPasswordPage />} />

            {/* Portal de Login Administrativo Exclusivo */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Checkout de assinatura Pro — layout próprio (sem shell do app) */}
            <Route path="/assinatura" element={<SubscriptionCheckoutPage />} />
            <Route path="/assinar" element={<SubscriptionCheckoutPage />} />
            <Route path="/assinatura/sucesso" element={<SubscriptionSuccessPage />} />
            <Route path="/assinar/sucesso" element={<SubscriptionSuccessPage />} />

            {/* Console Administrativo de Operações (Isolado fora do PageShell) */}
            <Route element={<RequireAdminSession />}>
              <Route element={<AdminShell />}>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                <Route path="/admin/notificacoes" element={<AdminNotificationsPage />} />
                <Route path="/admin/faturamento" element={<AdminBillingPage />} />
                <Route path="/admin/chamados" element={<AdminTicketsPage />} />
                <Route path="/admin/convites" element={<AdminInvitesPage />} />
                <Route path="/admin/backups" element={<Navigate to="/admin/seguranca" replace />} />
                <Route path="/admin/seguranca" element={<AdminSecurityPage />} />
                <Route element={<RequireSuperAdmin />}>
                  <Route path="/admin/laboratorio-forense" element={<AdminForensicsPage />} />
                </Route>
                <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            {/* Telas de status da conta para usuários autenticados */}
            <Route element={<AuthenticatedAreaEntry />}>
              <Route path="/aprovacao-pendente" element={<PendingApprovalPage />} />
              <Route path="/conta-suspensa" element={<SuspendedAccountPage />} />

              {/* Área protegida: Requer conta com status 'active' */}
              <Route element={<RequireActiveAccount />}>
                {/* Redirecionamento de compatibilidade para atalhos PWA / links legados / rotas unificadas */}
                <Route path="/transacoes/novo" element={<Navigate to="/transacoes?novo=transacao" replace />} />
                <Route path="/metas" element={<RedirectWithSearch to="/orcamentos?tab=goals" />} />
                <Route path="/investimentos" element={<RedirectWithSearch to="/investments" />} />
                <Route path="/carteira" element={<RedirectWithSearch to="/investments" />} />
                <Route path="/modo-familia" element={<RedirectWithSearch to="/familia" />} />

                <Route element={<PageShell />}>
                  <Route path="/" element={<AuthenticatedHome />} />
                  <Route path="/share-target" element={<ShareTargetPage />} />
                  {appRoutes.filter((route) => route.path !== "/").map((route) => {
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

                  {/* Redirecionamento seguro para rotas legadas e fallback catch-all */}
                  <Route path="/mais" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </RouteProviders>
      </Suspense>
    </BrowserRouter>
  );
}
