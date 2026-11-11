import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { appRoutes } from "@/app/routes";
import { LoadingScreen, PageShell } from "@/components/layout";
import { RequireActiveAccount, RequireAdminSession, RequireFeature } from "@/components/routing";

const FloatingCalculator = lazy(() =>
  import("@/components/modules/floating-calculator").then((m) => ({ default: m.FloatingCalculator })),
);
import { useAuth } from "@/hooks/use-auth";
import { useIdleSessionTimeout } from "@/hooks/use-idle-session-timeout";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { useRoutePrefetch } from "@/hooks/use-route-prefetch";
import { usePendingSplitExpense } from "@/hooks/use-pending-split-expense";
import { useUserAccess } from "@/state";
import {
  getPendingRouteAfterUnlock,
  initBankNotificationListener,
  initDeepLinkListener,
  initNotificationActionListener,
  isAppLocked,
  isNativePlatform,
  setPendingRouteAfterUnlock,
  subscribeAppLock,
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
const TermsPage = lazy(() =>
  import("@/features/legal/pages/terms-page").then((m) => ({ default: m.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import("@/features/legal/pages/privacy-page").then((m) => ({ default: m.PrivacyPage })),
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
const ToolsHubPage = lazy(() =>
  import("@/features/tools/pages/tools-hub-page").then((m) => ({ default: m.ToolsHubPage })),
);
const DebtSimulatorPage = lazy(() =>
  import("@/features/tools/pages/debt-simulator-page").then((m) => ({ default: m.DebtSimulatorPage })),
);
const RebalanceSimulatorPage = lazy(() =>
  import("@/features/tools/pages/rebalance-simulator-page").then((m) => ({ default: m.RebalanceSimulatorPage })),
);
const CompoundInterestPage = lazy(() =>
  import("@/features/tools/pages/compound-interest-page").then((m) => ({ default: m.CompoundInterestPage })),
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
const AdminBackupsPage = lazy(() =>
  import("@/features/admin/pages/admin-backups-page").then((m) => ({ default: m.AdminBackupsPage })),
);
const AdminSecurityPage = lazy(() =>
  import("@/features/admin/pages/admin-security-page").then((m) => ({ default: m.AdminSecurityPage })),
);
const AdminSettingsPage = lazy(() =>
  import("@/features/admin/pages/admin-settings-page").then((m) => ({ default: m.AdminSettingsPage })),
);
const ApkBetaRestrictedModal = lazy(() =>
  import("@/components/modules/apk-beta-restricted-modal").then((m) => ({ default: m.ApkBetaRestrictedModal })),
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
  "/familia": "transactions",
  "/viagens": "transactions",
  "/viagens/:id": "transactions",
};

/**
 * Verifica de forma síncrona se existe um token de autenticação salvo no localStorage do navegador.
 * Evita flash da tela de carregamento para novos visitantes que acessam a raiz no navegador Web.
 */
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

/**
 * Guard de autenticação:
 * - Sem sessão → redireciona para a tela de login preservando a rota de origem.
 * - Em transição/carregamento → exibe tela de carregamento oficial (`LoadingScreen`) sincronizada com Auth + Perfil/Acesso.
 * - Sessão ativa com dados de acesso prontos → renderiza rotas autenticadas isoladas por `key={session.user.id}`.
 */
function RequireAuth() {
  const { session, loading: authLoading, configError, mfaRequired, mfaVerified } = useAuth();
  const userAccess = useUserAccess(session?.user?.id);
  const location = useLocation();
  usePendingSplitExpense();

  // F23 — pre-fetching discreto dos chunks das rotas vizinhas (idle).
  useRoutePrefetch();

  // F6.1 — Proteção contra inatividade em ambiente Web (20 minutos de ociosidade)
  useIdleSessionTimeout();

  // O carregamento inicial só termina quando tanto a autenticação quanto os dados de perfil/permissões estiverem prontos
  const hasUser = Boolean(session?.user);
  const isAccessPending = hasUser && !userAccess.profile && !userAccess.error;
  const isDataLoading = authLoading || (hasUser && (userAccess.isLoading || isAccessPending));

  // Previne micro-flashes mantendo a tela de transição visível de forma estável e fluida (650ms)
  const { isShowing: isTransitioning, isClosing } = useMinimumLoading(isDataLoading, 650);

  // Visitante desautenticado acessando a raiz "/" no navegador Web:
  // - Sem token armazenado ou após resolução da autenticação sem usuário ativo -> exibe imediatamente a LandingPage de apresentação
  const isNative = isNativePlatform();
  const isRootPath = location.pathname === "/";

  if (isRootPath && !isNative) {
    if (!hasUser && (!authLoading || !hasStoredAuthSession())) {
      return <LandingPage />;
    }
  }

  // Blindagem 2FA (Etapa 1.2): sessão sem elevação AAL2 é imediatamente redirecionada para o desafio TOTP
  if (!authLoading && session?.user && mfaRequired && !mfaVerified) {
    return <Navigate to="/entrar?desafio=totp" replace />;
  }

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
      const isSettingsOrMais = location.pathname.startsWith("/configuracoes") || location.pathname === "/mais";
      return <Navigate to="/entrar" replace state={isSettingsOrMais ? undefined : { from: location }} />;
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
      <Suspense fallback={null}>
        <FloatingCalculator />
        <ApkBetaRestrictedModal />
      </Suspense>
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
  const { hasFeature } = useUserAccess();
  const isBankListenerAllowed = hasFeature("bank_notification_listener");

  useEffect(() => {
    const handleNativeNavigation = (route: string) => {
      if (isAppLocked()) {
        setPendingRouteAfterUnlock(route);
      } else {
        navigate(route);
      }
    };

    const cleanupDeepLinks = initDeepLinkListener(handleNativeNavigation);
    const cleanupNotifications = initNotificationActionListener(handleNativeNavigation);
    const cleanupBankNotifications = isBankListenerAllowed
      ? initBankNotificationListener(handleNativeNavigation)
      : null;

    const cleanupAppLock = subscribeAppLock(() => {
      if (!isAppLocked()) {
        const pending = getPendingRouteAfterUnlock();
        if (pending) {
          setPendingRouteAfterUnlock(null);
          navigate(pending);
        }
      }
    });

    return () => {
      void cleanupDeepLinks();
      void cleanupNotifications();
      if (cleanupBankNotifications) {
        void cleanupBankNotifications();
      }
      cleanupAppLock();
    };
  }, [navigate, isBankListenerAllowed]);

  return null;
}

/**
 * Redireciona para rota de destino preservando parâmetros de busca (query strings).
 */
function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
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

          {/* Rotas públicas de compartilhamento (Racha de Contas, Orçamento Familiar & Termômetro de Meta) */}
          <Route path="/r/:token" element={<SplitPublicPage />} />
          <Route path="/orcamento-familiar/:token" element={<FamilyBudgetPage />} />
          <Route path="/meta/:token" element={<GoalTrackerPublicPage />} />
          <Route path="/convite-familiar/:token" element={<FamilyInvitePage />} />
          <Route path="/viagem/:token" element={<TripPublicPage />} />

          {/* Rotas públicas de simuladores financeiros abertos (Fase 5) */}
          <Route path="/ferramentas" element={<ToolsHubPage />} />
          <Route path="/ferramentas/simulador-dividas" element={<DebtSimulatorPage />} />
          <Route path="/ferramentas/rebalanceamento" element={<RebalanceSimulatorPage />} />
          <Route path="/ferramentas/juros-compostos" element={<CompoundInterestPage />} />



          {/* Páginas públicas legais e regulatórias (fora do shell autenticado) */}
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/termos-de-uso" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/politica-de-privacidade" element={<PrivacyPage />} />

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
              <Route path="/admin/backups" element={<AdminBackupsPage />} />
              <Route path="/admin/seguranca" element={<AdminSecurityPage />} />
              <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          {/* Telas de status da conta para usuários autenticados */}
          <Route element={<RequireAuth />}>
            <Route path="/aprovacao-pendente" element={<PendingApprovalPage />} />
            <Route path="/conta-suspensa" element={<SuspendedAccountPage />} />

            {/* Área protegida: Requer conta com status 'active' */}
            <Route element={<RequireActiveAccount />}>
              {/* Redirecionamento de compatibilidade para atalhos PWA / links legados / rotas unificadas */}
              <Route path="/transacoes/novo" element={<Navigate to="/transacoes?novo=transacao" replace />} />
              <Route path="/categorias" element={<RedirectWithSearch to="/orcamentos" />} />
              <Route path="/metas" element={<RedirectWithSearch to="/orcamentos?tab=goals" />} />
              <Route path="/investimentos" element={<RedirectWithSearch to="/investments" />} />
              <Route path="/carteira" element={<RedirectWithSearch to="/investments" />} />

              <Route element={<PageShell />}>
                <Route path="/share-target" element={<ShareTargetPage />} />
                {appRoutes.map((route) => {
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
      </Suspense>
    </BrowserRouter>
  );
}
