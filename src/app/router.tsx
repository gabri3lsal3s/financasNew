import { lazy, Suspense } from "react";
import { Navigate, BrowserRouter, Route, Routes, useLocation } from "react-router";
import { appRoutes } from "@/app/routes";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { isNativePlatform } from "@/services/native";
import { Skeleton, SkeletonHeroCard, SkeletonKpi, SkeletonChart, SkeletonList } from "@/components/ui/skeleton";

/**
 * Guards e App Shell carregados sob demanda: a landing page não deve baixar
 * stores, sincronizações de conta nem os hooks de prefetch/segurança do app.
 */
const PageShell = lazy(() =>
  import("@/components/layout/page-shell").then((m) => ({ default: m.PageShell })),
);
const AuthenticatedRoot = lazy(() =>
  import("@/app/authenticated-root").then((m) => ({ default: m.AuthenticatedRoot })),
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
function RouteSuspenseFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando página"
      className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8 space-y-6 motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-6 w-36 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg hidden sm:block" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        <SkeletonHeroCard />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SkeletonChart />
          </div>
          <div>
            <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
              <Skeleton className="h-4 w-28 rounded" />
              <SkeletonList rows={4} />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando conteúdo da página…</span>
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
  "/modo-familia": "transactions",
  "/viagens": "transactions",
  "/viagens/:id": "transactions",
};

/**
 * Entrada pública da raiz: visitantes web sem token recebem a landing page
 * imediatamente, sem montar guards, stores ou sincronizações do App Shell.
 * Usuários logados e o app nativo carregam a raiz autenticada sob demanda.
 */
function RootEntry() {
  const isNative = isNativePlatform();
  const hasStoredSession = (() => {
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
  })();

  if (!isNative && !hasStoredSession) {
    return <LandingPage />;
  }

  return (
    <Suspense fallback={<LoadingScreen statusText="Preparando painel financeiro…" />}>
      <AuthenticatedRoot />
    </Suspense>
  );
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
      <Suspense fallback={<RouteSuspenseFallback />}>
        <Routes>
          {/* Raiz: landing para visitantes, App Shell apenas com sessão */}
          <Route path="/" element={<RootEntry />} />

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
              <Route path="/modo-familia" element={<RedirectWithSearch to="/familia" />} />

              <Route element={<PageShell />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
