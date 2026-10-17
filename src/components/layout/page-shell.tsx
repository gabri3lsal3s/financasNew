import { lazy, Suspense, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BackToTop } from "@/components/layout/back-to-top";
import { CalculatorButton } from "@/components/layout/calculator-button";
import { GlobalSearch } from "@/components/layout/global-search";
import { LogoProfileButton } from "@/components/layout/logo-profile-button";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { NetworkStatusBanner } from "@/components/layout/network-status-banner";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Skeleton } from "@/components/ui";
import type { LaunchState } from "@/features/transactions/wizard/wizard-state";

const LaunchWizard = lazy(() =>
  import("@/features/transactions").then((m) => ({ default: m.LaunchWizard }))
);
import { useContainerScroll } from "@/hooks";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { dismissPendingSuggestion } from "@/services/native";
import { useReminders } from "@/state";
import type { PaymentMethod } from "@/types";

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Suporte aos atalhos rápidos nativos e de launcher (?novo=despesa, ?novo=receita, ?novo=transacao)
  const novoParam = searchParams.get("novo");
  const isShortcutNew = novoParam === "transacao" || novoParam === "despesa" || novoParam === "receita";
  const [localWizardOpen, setLocalWizardOpen] = useState(false);
  const wizardOpen = isShortcutNew || localWizardOpen;
  const initialType = novoParam === "receita" ? "income" : "expense";

  const valorParam = searchParams.get("valor");
  const descParam = searchParams.get("descricao") || undefined;
  const dataParam = searchParams.get("data") || undefined;
  const formaParam = (searchParams.get("forma") as PaymentMethod) || undefined;
  const parcelasParam = searchParams.get("parcelas");
  const categoriaParam = searchParams.get("categoria") || undefined;
  const sugIdParam = searchParams.get("sug_id") || undefined;

  const initialValues = useMemo(() => {
    const vals: Partial<LaunchState> = {};
    if (valorParam) {
      const parsed = parseInt(valorParam, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        vals.valueCents = parsed;
      }
    }
    if (descParam) vals.description = descParam;
    if (dataParam) vals.date = dataParam;
    if (formaParam) vals.paymentMethod = formaParam;
    if (categoriaParam) vals.categoryId = categoriaParam;
    if (parcelasParam) {
      const parsedParcelas = parseInt(parcelasParam, 10);
      if (Number.isFinite(parsedParcelas) && parsedParcelas >= 1 && parsedParcelas <= 60) {
        vals.installments = parsedParcelas;
      }
    }
    return Object.keys(vals).length > 0 ? vals : undefined;
  }, [valorParam, descParam, dataParam, formaParam, categoriaParam, parcelasParam]);

  const handleWizardOpenChange = (next: boolean) => {
    setLocalWizardOpen(next);
    if (!next) {
      if (sugIdParam) {
        dismissPendingSuggestion(sugIdParam);
      }
      if (isShortcutNew) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            updated.delete("novo");
            updated.delete("valor");
            updated.delete("descricao");
            updated.delete("data");
            updated.delete("forma");
            updated.delete("categoria");
            updated.delete("parcelas");
            updated.delete("sug_id");
            return updated;
          },
          { replace: true },
        );
      }
    }
  };

  const { totalCount } = useReminders();
  const { isScrolled, showBackToTop } = useContainerScroll({
    containerId: "main-content",
    scrolledThreshold: 15,
    backToTopThreshold: 400,
  });

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
      {wizardOpen && (
        <Suspense fallback={null}>
          <LaunchWizard
            key={`${initialType}-${wizardOpen ? "open" : "closed"}-${sugIdParam ?? ""}`}
            open={wizardOpen}
            initialType={initialType}
            initialValues={initialValues}
            onOpenChange={handleWizardOpenChange}
          />
        </Suspense>
      )}
      {/* Estado da sidebar vive aqui (fonte única) e a margem acompanha em tempo real. */}
      <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />
      {/* Margem acompanha o estado da sidebar (F7.2): lg:pl-64 expandida ↔ lg:pl-20 compacta. */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        {/* Header fluido com elevação dinâmica de rolagem (F7.3/F56 / DESIGN_SYSTEM §6 e §8).
            Preserva a borda contínua conectada à Sidebar e eleva com sombra suave e blur.
            pt-[env(safe-area-inset-top,0px)] garante afastamento perfeito da barra de status no mobile. */}
        <header
          className={cn(
            "sticky top-0 z-sticky flex shrink-0 items-center border-b border-border transition-[background-color,backdrop-filter,box-shadow] duration-200 app-region-drag pt-[env(safe-area-inset-top,0px)]",
            isScrolled
              ? "bg-surface/95 backdrop-blur-md shadow-xs"
              : "bg-surface/80 backdrop-blur-sm shadow-none",
          )}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-1.5 px-3 sm:px-6 lg:px-8 app-region-no-drag">
            {visual.headerButtons.logo && (
              <div className="flex items-center lg:hidden mr-1 shrink-0">
                <LogoProfileButton />
              </div>
            )}
            {/* Separador visual entre logo e busca (mobile/tablet) */}
            {visual.headerButtons.logo && (
              <div className="h-5 w-px bg-border shrink-0 lg:hidden" aria-hidden="true" />
            )}
            <GlobalSearch className="flex-1 min-w-0" />
            {showCalc && <CalculatorButton />}
            {hasNotifications && <NotificationsButton />}
            {showTheme && <ThemeToggle />}
            {showPrivacy && <PrivacyToggle />}
          </div>
        </header>
        <NetworkStatusBanner />
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0 w-full">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10 pt-4 sm:pt-6 lg:px-8 min-w-0">
            {/* Transição de rota (F8): 150ms, respeita prefers-reduced-motion (globals). */}
            <div key={location.pathname} className="animate-route-in min-w-0 w-full">
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </main>
      </div>

      {/* Botão flutuante Voltar ao Topo global (ergonômico acima da BottomNav) */}
      <BackToTop visible={showBackToTop} containerId="main-content" bottomNavOffset />

      <BottomNav />
    </div>
  );
}
