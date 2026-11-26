import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import type { ThemePreference } from "@/app/theme-provider";
import { cn } from "@/lib/utils";
import { trackFeatureUse } from "@/services/analytics/tracker";
import { resetPageScroll } from "@/services/scroll";
import { ContentLoading } from "@/components/ui/content-loading";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BackToTop } from "@/components/layout/back-to-top";
import { GlobalSearch } from "@/components/layout/global-search";
import { NetworkStatusBanner } from "@/components/layout/network-status-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { RouteSkeletonFallback } from "@/components/layout/route-skeletons/route-skeleton-fallback";
import { NativeOnboardingDialog } from "@/components/modules/native-onboarding-dialog";
import { useDemoSession } from "@/state/demo-mode/demo-session-store";
import { useContainerScroll } from "@/hooks/use-container-scroll";
import { useUnreadNotificationCount } from "@/hooks/use-notification-center";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import {
  resolveVisibleHeaderSlots,
  useVisualCustomization,
} from "@/hooks/use-visual-customization";
import { dismissPendingSuggestion } from "@/services/native/suggestions-store";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useUserSubscription } from "@/state/queries/use-user-subscription";
import { DesktopTopbar } from "./desktop-topbar";
import { MobileTopbar } from "./mobile-topbar";
import {
  WIZARD_QUERY_KEYS,
  isLaunchShortcutQuery,
  parseLaunchWizardInitialValues,
  useShellOnboardingOrchestrator,
} from "./use-shell-onboarding-orchestrator";

const LaunchWizard = lazy(() =>
  import("@/features/transactions").then((m) => ({ default: m.LaunchWizard })),
);
const UpgradeDialog = lazy(() =>
  import("@/components/modules/subscription/upgrade-dialog").then((m) => ({
    default: m.UpgradeDialog,
  })),
);
const DemoTourSpotlight = lazy(() =>
  import("@/components/modules/demo-tour-spotlight").then((m) => ({
    default: m.DemoTourSpotlight,
  })),
);

const PATH_TO_MODULE: Record<string, string> = {
  "/": "expenses",
  "/transacoes": "expenses",
  "/cartoes": "cards",
  "/dividas": "debts",
  "/orcamentos": "budgets",
  "/relatorios": "reports",
  "/investments": "investments",
  "/configuracoes": "settings",
  "/insights": "expenses",
  "/lembretes": "expenses",
  "/negocio": "transactions",
  "/admin": "settings",
};

export function PageShell({ children }: { children?: ReactNode } = {}) {
  const navigate = useNavigate();
  const subscription = useUserSubscription();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const [headerUpgradeOpen, setHeaderUpgradeOpen] = useState(false);
  const visual = useVisualCustomization();
  const { isCollapsed, toggle } = useSidebarState();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDemoActive } = useDemoSession();

  const novoParam = searchParams.get("novo");
  const modoParam = searchParams.get("modo");
  const isShortcutNew = isLaunchShortcutQuery(novoParam, modoParam);
  const [localWizardOpen, setLocalWizardOpen] = useState(false);
  const wizardOpen = isShortcutNew || localWizardOpen;
  const initialType = novoParam === "receita" || novoParam === "income" ? "income" : "expense";
  const initialMode: "quick" | "guided" =
    novoParam === "pix" || modoParam === "rapido" || modoParam === "quick" ? "quick" : "guided";

  const sugIdParam = searchParams.get("sug_id") || undefined;
  const searchKey = searchParams.toString();
  const initialValues = useMemo(
    () => parseLaunchWizardInitialValues(searchKey, novoParam),
    [searchKey, novoParam],
  );

  useLayoutEffect(() => {
    resetPageScroll({ containerId: "main-content" });
  }, [location.pathname]);

  useEffect(() => {
    const targetModule = PATH_TO_MODULE[location.pathname];
    if (targetModule && !isDemoActive) {
      trackFeatureUse(targetModule, "view_page");
    }
  }, [location.pathname, isDemoActive]);

  const handleWizardOpenChange = (next: boolean) => {
    setLocalWizardOpen(next);
    if (!next) {
      if (sugIdParam) dismissPendingSuggestion(sugIdParam);
      if (isShortcutNew) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            for (const key of WIZARD_QUERY_KEYS) updated.delete(key);
            return updated;
          },
          { replace: true },
        );
      }
    }
  };

  const handleThemeChange = (next: ThemePreference) => {
    if (!isDemoActive) {
      updateCustomSettingsMutation.mutate({ themePreference: next });
    }
  };

  const { isScrolled, showBackToTop } = useContainerScroll({
    containerId: "main-content",
    scrolledThreshold: 15,
    backToTopThreshold: 400,
  });

  const onboarding = useShellOnboardingOrchestrator({ isWizardOpen: wizardOpen });
  const { totalBellCount } = useUnreadNotificationCount();
  const hasNotifications = totalBellCount > 0;

  const cfg = visual.headerButtons;
  const visibleSlots = resolveVisibleHeaderSlots(cfg, hasNotifications);
  const showCalc = visibleSlots.includes("calculatorButton");
  const showTheme = visibleSlots.includes("themeToggle");
  const showPrivacy = visibleSlots.includes("privacyToggle");

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-foreground">
      {wizardOpen && (
        <Suspense fallback={null}>
          <LaunchWizard
            key={`${initialType}-${initialMode}-${wizardOpen ? "open" : "closed"}-${sugIdParam ?? ""}`}
            open={wizardOpen}
            initialMode={initialMode}
            initialType={initialType}
            initialValues={initialValues}
            onOpenChange={handleWizardOpenChange}
          />
        </Suspense>
      )}
      <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-sticky flex shrink-0 items-center border-b border-border transition-[background-color,backdrop-filter,box-shadow] duration-200 app-region-drag pt-safe",
            isScrolled ? "bg-surface/95 backdrop-blur-md shadow-xs" : "bg-surface/80 backdrop-blur-sm shadow-none",
          )}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-1.5 px-3 sm:px-6 lg:px-8 app-region-no-drag">
            <MobileTopbar showLogo={visual.headerButtons.logo} />
            <GlobalSearch className="flex-1 min-w-0" />
            <DesktopTopbar
              subscription={subscription}
              onOpenUpgrade={() => setHeaderUpgradeOpen(true)}
              showCalc={showCalc}
              hasNotifications={hasNotifications}
              showTheme={showTheme}
              showPrivacy={showPrivacy}
              visibleSlots={visibleSlots}
              onThemeChange={handleThemeChange}
            />
          </div>
        </header>
        {isDemoActive ? (
          <Suspense fallback={null}>
            <DemoTourSpotlight />
          </Suspense>
        ) : null}
        <NativeOnboardingDialog
          open={onboarding.isNativeOnboardingOpen}
          onOpenChange={onboarding.onNativeOnboardingOpenChange}
        />
        <NetworkStatusBanner />
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0 w-full">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pb-[calc(6.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] lg:pb-10 pt-4 sm:pt-6 lg:px-8 min-w-0">
            <div key={location.pathname} className="animate-route-in min-w-0 w-full">
              <Suspense fallback={<RouteSkeletonFallback />}>{children ?? <Outlet />}</Suspense>
            </div>
          </div>
        </main>
      </div>

      <BackToTop visible={showBackToTop} containerId="main-content" bottomNavOffset />
      <BottomNav />

      {headerUpgradeOpen ? (
        <Suspense fallback={<ContentLoading />}>
          <UpgradeDialog
            open={headerUpgradeOpen}
            onOpenChange={setHeaderUpgradeOpen}
            onProceedToCheckout={(plan) => {
              setHeaderUpgradeOpen(false);
              navigate(buildCheckoutUrl({ plan }));
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
