import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BrandLogo } from "@/components/layout/brand-logo";
import { CalculatorButton } from "@/components/layout/calculator-button";
import { GlobalSearch } from "@/components/layout/global-search";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Skeleton } from "@/components/ui";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";

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
  useVisualCustomization();
  const { isCollapsed, toggle } = useSidebarState();
  const location = useLocation();

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-foreground">
      {/* Estado da sidebar vive aqui (fonte única) e a margem acompanha em tempo real. */}
      <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />
      {/* Margem acompanha o estado da sidebar (F7.2): lg:pl-64 expandida ↔ lg:pl-20 compacta. */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        {/* Header fluido (F7.3): fixo/sticky com backdrop-blur (DESIGN_SYSTEM §6).
            Conteúdo centralizado nos limites da página (max-w-5xl):
            a barra de busca (flex-1) toma a largura flexível e os botões
            de utilidade ficam alinhados à direita. */}
        <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center border-b border-border bg-surface/80 backdrop-blur app-region-drag">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-1.5 px-4 lg:px-8 app-region-no-drag">
            <div className="flex items-center lg:hidden mr-1 shrink-0">
              <BrandLogo showWordmark={false} markClassName="size-7" />
            </div>
            <GlobalSearch className="flex-1" />
            <PrivacyToggle />
            <CalculatorButton />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain min-h-0">
          <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 lg:px-8">
            {/* Transição de rota (F8): 150ms, respeita prefers-reduced-motion (globals). */}
            <div key={location.pathname} className="animate-route-in">
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
