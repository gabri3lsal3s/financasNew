import { Suspense } from "react";
import { Navigate, Outlet, BrowserRouter, Route, Routes, useLocation } from "react-router";
import { appRoutes } from "@/app/routes";
import { Skeleton } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";
import { MoreMenu } from "@/components/layout/more-menu";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "@/features/auth";
import { LaunchWizard } from "@/features/transactions";
import { useAuth } from "@/hooks/use-auth";

/** Fallback de carregamento das rotas lazy (bundle splitting F5.5) — Skeleton, sem spinner. */
function RouteFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** Guard de autenticação: sem sessão → tela de login preservando a rota de origem. */
function RequireAuth() {
  const { session, loading, configError } = useAuth();
  const location = useLocation();

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

  return <Outlet />;
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
            <Suspense fallback={<RouteFallback />}>
              {appRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<route.Component />} />
              ))}
            </Suspense>
            <Route path="/mais" element={<MoreMenu />} />
            <Route path="*" element={<MoreMenu />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
