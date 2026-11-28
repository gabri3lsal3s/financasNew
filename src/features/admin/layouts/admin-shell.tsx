import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, ExternalLink, LogOut } from "lucide-react";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { BackToTop, BrandLogo, ThemeToggle } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useContainerScroll } from "@/hooks/use-container-scroll";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useSignOut } from "@/hooks/use-sign-out";
import {
  useAdminMetrics,
  useAdminPastDueSubscriptions,
  useAdminStatementBlueprints,
  useAdminSupportTickets,
  useUserAccess,
} from "@/state";
import { cn } from "@/lib/utils";
import { resetPageScroll } from "@/services/scroll";
import { triggerSensory } from "@/services/sensory";
import {
  ADMIN_FORENSICS_NAV_ITEM,
  ADMIN_NAV_GROUPS,
  type AdminNavBadgeKey,
} from "./admin-nav-config";
import { AdminBottomNav } from "./admin-bottom-nav";
import { AdminMobileDrawer } from "./admin-mobile-drawer";
import { ConnectionsHealthPopover } from "../components/connections-health-panel";

const HOVER_EXPAND_DELAY_MS = 120;

export function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { profile, role, isSuperAdmin } = useUserAccess(session?.user?.id);
  const { isCollapsed, toggle } = useSidebarState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const metricsQuery = useAdminMetrics();
  const ticketsQuery = useAdminSupportTickets();
  const pastDueQuery = useAdminPastDueSubscriptions();
  const blueprintsQuery = useAdminStatementBlueprints();

  const navBadges = useMemo<Partial<Record<AdminNavBadgeKey, number>>>(() => {
    const openTickets = (ticketsQuery.data ?? []).filter(
      (t) => t.status === "open" || t.status === "in_progress",
    ).length;
    const pendingBlueprints = (blueprintsQuery.data ?? []).filter(
      (b) => b.status === "pending_review",
    ).length;
    return {
      pendingUsers: metricsQuery.data?.pending_users ?? 0,
      openTickets,
      pastDue: (pastDueQuery.data ?? []).length,
      pendingBlueprints,
    };
  }, [metricsQuery.data?.pending_users, ticketsQuery.data, pastDueQuery.data, blueprintsQuery.data]);

  useLayoutEffect(() => {
    resetPageScroll({ containerId: "admin-main-content" });
  }, [location.pathname]);

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

  const { isScrolled, showBackToTop } = useContainerScroll({
    containerId: "admin-main-content",
    scrolledThreshold: 15,
    backToTopThreshold: 400,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const expanded = !isCollapsed || hoverExpanded;
  const ForensicsIcon = ADMIN_FORENSICS_NAV_ITEM.icon;

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-foreground">
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-sidebar hidden lg:flex flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none",
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
            <Link
              to="/admin/dashboard"
              aria-label="Axir Admin"
              title={expanded ? undefined : "Axir Admin"}
              className={cn(
                "flex items-center rounded-lg hover:bg-surface-hover/80 p-2 transition-colors overflow-hidden",
                expanded ? "w-full justify-start gap-2.5 text-left" : "w-full justify-center",
              )}
            >
              <BrandLogo markClassName="size-8 shrink-0" showWordmark={false} />
              {expanded && (
                <span className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap overflow-hidden animate-fade-slide-in">
                  Axir Admin
                </span>
              )}
            </Link>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2.5" aria-label="Navegação administrativa">
          {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="space-y-1">
              {expanded ? (
                <p className="px-3.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 animate-fade-slide-in">
                  {group.label}
                </p>
              ) : groupIndex > 0 ? (
                <div className="my-2 mx-auto h-px w-8 bg-border/80" aria-hidden="true" />
              ) : null}

              {group.items.map(({ to, label, icon: Icon, badgeKey }) => {
                const count = badgeKey ? (navBadges[badgeKey] ?? 0) : 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => triggerSensory("selection")}
                    aria-label={expanded ? undefined : label}
                    title={expanded ? undefined : label}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors overflow-hidden whitespace-nowrap relative cursor-pointer",
                        !expanded && "justify-center px-2",
                        isActive
                          ? "bg-primary/12 text-primary-strong font-semibold"
                          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                      )
                    }
                  >
                    <div className="relative shrink-0">
                      <Icon className="size-5 shrink-0" aria-hidden="true" />
                      {!expanded && count > 0 && (
                        <span className="absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-surface bg-warning-strong" />
                      )}
                    </div>
                    {expanded && (
                      <div className="flex flex-1 items-center justify-between overflow-hidden animate-fade-slide-in">
                        <span className="overflow-hidden truncate">{label}</span>
                        {count > 0 && (
                          <Badge
                            size="xs"
                            variant="warning"
                            className="ml-auto h-5 min-w-5 px-1.5 font-bold"
                          >
                            {count > 9 ? "9+" : count}
                          </Badge>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {isSuperAdmin && (
            <div className="space-y-1">
              {expanded ? (
                <p className="px-3.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 animate-fade-slide-in">
                  Forense
                </p>
              ) : (
                <div className="my-2 mx-auto h-px w-8 bg-border/80" aria-hidden="true" />
              )}
              <NavLink
                to={ADMIN_FORENSICS_NAV_ITEM.to}
                onClick={() => triggerSensory("selection")}
                aria-label={expanded ? undefined : ADMIN_FORENSICS_NAV_ITEM.label}
                title={expanded ? undefined : ADMIN_FORENSICS_NAV_ITEM.label}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors overflow-hidden whitespace-nowrap relative cursor-pointer",
                    !expanded && "justify-center px-2",
                    isActive
                      ? "bg-primary/12 text-primary-strong font-semibold"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )
                }
              >
                <div className="relative shrink-0">
                  <ForensicsIcon className="size-5 shrink-0" aria-hidden="true" />
                </div>
                {expanded && (
                  <div className="flex flex-1 items-center justify-between overflow-hidden animate-fade-slide-in">
                    <span className="overflow-hidden truncate">{ADMIN_FORENSICS_NAV_ITEM.label}</span>
                  </div>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-border pb-safe">
          <div className="p-2.5">
            <Button
              type="button"
              variant="ghost"
              sensoryIntent="selection"
              onClick={toggle}
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

      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-sticky flex shrink-0 items-center border-b border-border transition-[background-color,backdrop-filter,box-shadow] duration-200 app-region-drag pt-safe",
            isScrolled
              ? "bg-surface/95 backdrop-blur-md shadow-xs"
              : "bg-surface/80 backdrop-blur-sm shadow-none",
          )}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 app-region-no-drag">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 min-w-0 lg:hidden"
            >
              <BrandLogo markClassName="size-8 shrink-0" showWordmark={false} />
              <span className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap">
                Axir Admin
              </span>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 lg:ml-auto">
              <ConnectionsHealthPopover />

              <ThemeToggle />

              <Link
                to="/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "hidden lg:inline-flex gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                )}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Ver App</span>
              </Link>

              <div className="flex items-center gap-2 lg:pl-2 lg:border-l lg:border-border/80">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                    {profile?.name || session?.user?.email}
                  </span>
                  <Badge
                    variant={isSuperAdmin ? "default" : "muted"}
                    size="xs"
                    className="uppercase font-mono"
                  >
                    {role || "admin"}
                  </Badge>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  sensoryIntent="action"
                  onClick={handleSignOut}
                  className="size-10 sm:size-8 shrink-0 text-muted-foreground hover:text-critical-strong hover:bg-critical/10 cursor-pointer"
                  title="Encerrar sessão de administrador"
                  aria-label="Sair do painel administrativo"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <AdminMobileDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          isSuperAdmin={isSuperAdmin}
          badges={navBadges}
        />

        <main
          id="admin-main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none min-h-0 w-full"
        >
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 pb-[calc(6.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] lg:pb-10 pt-4 sm:pt-6 lg:px-8 min-w-0">
            <div key={location.pathname} className="animate-route-in min-w-0 w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <BackToTop visible={showBackToTop} containerId="admin-main-content" bottomNavOffset />

      <AdminBottomNav
        moreOpen={mobileMenuOpen}
        onOpenMore={() => setMobileMenuOpen((prev) => !prev)}
        badges={navBadges}
      />
    </div>
  );
}
