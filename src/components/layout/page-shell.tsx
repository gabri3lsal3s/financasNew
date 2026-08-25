import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CalculatorButton } from "@/components/layout/calculator-button";
import { GlobalSearch } from "@/components/layout/global-search";
import { LogoProfileButton } from "@/components/layout/logo-profile-button";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Skeleton } from "@/components/ui";
import { LaunchWizard } from "@/features/transactions";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { useReminders } from "@/state";

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

export function PageShell() {
  const visual = useVisualCustomization();
  const { isCollapsed, toggle } = useSidebarState();
  const location = useLocation();
  const { open: wizardOpen, setOpen: setWizardOpen } = useCreateDeepLink("transacao");
  const { totalCount } = useReminders();

  // --- Slot logic (máx. 2 entre: calc, tema, privacidade, notificações) ---
  // Notificações deslocam: privacidade primeiro, depois tema. Calculadora nunca é deslocada.
  const hasNotifications = totalCount > 0;
  const cfg = visual.headerButtons;
  const showCalc = cfg.calculatorButton;
  let showTheme = cfg.themeToggle;
  let showPrivacy = cfg.privacyToggle;

  if (hasNotifications) {
    const controlled = [showCalc, showTheme, showPrivacy].filter(Boolean).length;
    if (controlled >= 2) {
      if (showPrivacy) showPrivacy = false;
      else if (showTheme) showTheme = false;
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-foreground">
      {/* Wizard contextual em overlay (preserva rota ativa e contexto em qualquer página) */}
      <LaunchWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      {/* Estado da sidebar vive aqui (fonte única) e a margem acompanha em tempo real. */}
      <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />
      {/* Margem acompanha o estado da sidebar (F7.2): lg:pl-64 expandida ↔ lg:pl-20 compacta. */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "md:pl-20" : "md:pl-20 lg:pl-64",
        )}
      >
        {/* Header fluido (F7.3/F56): fixo/sticky com backdrop-blur (DESIGN_SYSTEM §6).
            Conteúdo centralizado nos limites da página (max-w-7xl). */}
        <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center border-b border-border bg-surface/80 backdrop-blur app-region-drag">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-1.5 px-4 sm:px-6 lg:px-8 app-region-no-drag">
            {visual.headerButtons.logo && (
              <div className="flex items-center md:hidden mr-1 shrink-0">
                <LogoProfileButton />
              </div>
            )}
            {/* Separador visual entre logo e busca (mobile) */}
            {visual.headerButtons.logo && (
              <div className="h-5 w-px bg-border shrink-0 md:hidden" aria-hidden="true" />
            )}
            <GlobalSearch className="flex-1 min-w-0" />
            {showCalc && <CalculatorButton />}
            {hasNotifications && <NotificationsButton />}
            {showTheme && <ThemeToggle />}
            {showPrivacy && <PrivacyToggle />}
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain min-h-0 w-full">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24 md:pb-10 pt-4 sm:pt-6 lg:px-8 min-w-0">
            {/* Transição de rota (F8): 150ms, respeita prefers-reduced-motion (globals). */}
            <div key={location.pathname} className="animate-route-in min-w-0 w-full">
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
