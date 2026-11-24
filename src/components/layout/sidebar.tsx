import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoProfileButton } from "@/components/layout/logo-profile-button";
import { navGroups, filterNavItems } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { useNotificationCenter } from "@/hooks/use-notification-center";
import { useBusinessMode, useFamilyMode, useTripMode, useUserAccess, useUserSubscription } from "@/state";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { SidebarNavGroup } from "./sidebar-nav-group";
import { SidebarSubscriptionCard } from "./sidebar-subscription-card";

/** Atraso do hover-expand: evita disparos acidentais com mouse rápido (F25). */
const HOVER_EXPAND_DELAY_MS = 120;

export interface SidebarProps {
  /** Estado colapsado (dono: PageShell via useSidebarState — fonte única). */
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * Sidebar desktop colapsável (F7.2): expandida (w-64, logo + texto + ícones) ↔
 * compacta (w-20, apenas ícones centralizados com labels acessíveis via
 * aria-label/title) com hover-expand assistido (F25).
 */
export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const subscription = useUserSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { totalRemindersPageCount: totalCount, criticalCount: urgentCount } =
    useNotificationCenter();

  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) clearTimeout(enterTimer.current);
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (isCollapsed && !hoverExpanded) {
      enterTimer.current = setTimeout(() => setHoverExpanded(true), HOVER_EXPAND_DELAY_MS);
    }
  };

  const handleMouseLeave = () => {
    if (enterTimer.current !== null) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(() => setHoverExpanded(false), HOVER_EXPAND_DELAY_MS);
  };

  const { isAdmin, hasFeature } = useUserAccess();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { isTripModeEnabled } = useTripMode();
  const { isBusinessModeEnabled } = useBusinessMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const isTripActive = Boolean(isTripModeEnabled);
  const isBusinessActive = Boolean(isBusinessModeEnabled);
  const expanded = !isCollapsed || hoverExpanded;
  const isPaymentPending =
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.billingPhase === "past_due";

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((g) => ({
        title: g.title,
        items: filterNavItems(g.items, isAdmin, hasFeature, isFamilyActive, isTripActive, isBusinessActive),
      }))
      .filter((g) => g.items.length > 0);
  }, [isAdmin, hasFeature, isFamilyActive, isTripActive, isBusinessActive]);

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed inset-y-0 left-0 z-sidebar hidden flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
        expanded ? "w-64" : "w-20",
        hoverExpanded && isCollapsed && "shadow-2xl",
      )}
    >
      <div
        className={cn(
          "pt-safe flex shrink-0 items-center border-b border-border overflow-hidden",
          expanded ? "px-4" : "justify-center px-2.5",
        )}
      >
        <div className={cn("flex h-16 w-full items-center", !expanded && "justify-center")}>
          <LogoProfileButton
            showWordmark={expanded}
            markClassName="size-8 shrink-0"
            className={cn(
              "rounded-lg hover:bg-surface-hover/80 p-2 transition-colors",
              expanded ? "w-full justify-start gap-2.5 text-left" : "w-full justify-center",
            )}
          />
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5" aria-label="Navegação principal">
        {visibleGroups.map((group, groupIndex) => (
          <SidebarNavGroup
            key={group.title}
            title={group.title}
            items={group.items}
            groupIndex={groupIndex}
            expanded={expanded}
            totalCount={totalCount}
            urgentCount={urgentCount}
          />
        ))}
      </nav>

      <SidebarSubscriptionCard
        subscription={subscription}
        expanded={expanded}
        isPaymentPending={isPaymentPending}
        onNavigateBilling={() => navigate("/configuracoes?tab=subscription")}
        onOpenUpgrade={() => setUpgradeOpen(true)}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onProceedToCheckout={(plan) => {
          setUpgradeOpen(false);
          navigate(buildCheckoutUrl({ plan }));
        }}
      />

      <div className="shrink-0 border-t border-border pb-safe">
        <div className="p-2.5">
          <Button
            type="button"
            variant="ghost"
            sensoryIntent="selection"
            onClick={onToggle}
            aria-label={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            className={cn(
              "flex w-full items-center justify-start gap-3 px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground overflow-hidden whitespace-nowrap cursor-pointer",
              !expanded && "justify-center px-2",
            )}
          >
            {expanded ? (
              <>
                <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
                <span className="overflow-hidden whitespace-nowrap animate-fade-slide-in">
                  Recolher
                </span>
              </>
            ) : (
              <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
