import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterNavItems, navItems } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { triggerSensory } from "@/services/sensory";
import { useNotificationCenter } from "@/hooks/use-notification-center";
import { useFamilyMode, useTripMode, useUserAccess } from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { MoreMenuSheet } from "./more-menu-sheet";
import { BottomNavItem } from "./bottom-nav-item";
import { resolveFabAction } from "./resolve-fab-action";

export function BottomNav() {
  const location = useLocation();
  const { hasFeature, isAdmin } = useUserAccess();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { isTripModeEnabled } = useTripMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const isTripActive = Boolean(isTripModeEnabled);
  const { totalRemindersPageCount: totalCount, criticalCount: urgentCount } =
    useNotificationCenter();
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard();

  const allowedItems = filterNavItems(navItems, isAdmin, hasFeature, isFamilyActive, isTripActive);
  const { primarySlots, moreMenuSlots } = resolveBottomNavSlots(allowedItems);

  const create = resolveFabAction(location.pathname, location.search, hasFeature);

  const leftSlots = primarySlots.slice(0, 2);
  const rightSlots = primarySlots.slice(2, 4);

  const primaryPaths = new Set(primarySlots.map((s) => s.path));
  const moreSubItem = moreMenuSlots.find((candidate) => {
    if (primaryPaths.has(candidate.path)) return false;
    if (location.pathname === candidate.path || location.pathname.startsWith(`${candidate.path}/`)) {
      return true;
    }
    if (
      candidate.path === "/orcamentos" &&
      (location.pathname === "/categorias" || location.pathname.startsWith("/categorias/"))
    ) {
      return true;
    }
    if (
      candidate.path === "/investments" &&
      (location.pathname === "/investimentos" ||
        location.pathname.startsWith("/investimentos/") ||
        location.pathname === "/carteira" ||
        location.pathname.startsWith("/carteira/"))
    ) {
      return true;
    }
    return false;
  });

  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const isMoreRoot = location.pathname === "/mais" || location.pathname.startsWith("/mais/");

  const isMoreActive = isMoreRoot || Boolean(moreSubItem) || moreSheetOpen;
  const MoreIcon = moreSubItem ? moreSubItem.icon : Ellipsis;

  const renderMoreButton = () => (
    <button
      type="button"
      aria-label={moreSubItem ? `Mais (${moreSubItem.label})` : "Mais opções"}
      onClick={() => {
        triggerSensory("action");
        setMoreSheetOpen(true);
      }}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors relative cursor-pointer w-full",
        isMoreActive ? "text-primary-strong font-semibold" : "text-muted-foreground",
      )}
    >
      <div className="relative">
        <MoreIcon
          key={moreSubItem?.path ?? "mais"}
          className="size-5 animate-spring-pop transform-gpu"
          aria-hidden="true"
        />
        {totalCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-surface",
              urgentCount > 0 ? "bg-critical" : "bg-primary",
            )}
          />
        )}
      </div>
      <span className="w-full text-center leading-tight tracking-tight line-clamp-1">Mais</span>
    </button>
  );

  return (
    <>
      <MoreMenuSheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen} />
      {upgradeModal}
      <nav
        className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-border bg-surface/90 backdrop-blur pb-safe lg:hidden"
        aria-label="Navegação principal"
      >
        {create ? (
          <div className="mx-auto grid h-16 max-w-md md:max-w-xl grid-cols-5 items-center px-1.5 sm:px-2">
            {leftSlots.map((slot) => (
              <BottomNavItem key={slot.path} item={slot} end={slot.path === "/"} />
            ))}
            {leftSlots.length < 2 &&
              Array.from({ length: 2 - leftSlots.length }).map((_, i) => (
                <div
                  key={`left-empty-${i}`}
                  className="flex min-h-11 items-center justify-center"
                  aria-hidden="true"
                />
              ))}

            <NavLink
              to={create.to}
              aria-label={create.label}
              className="flex min-h-11 items-center justify-center"
              onClick={(e) => {
                triggerSensory("action");
                if (isReadOnlyMode) {
                  e.preventDefault();
                  guardAction(() => {}, create.label);
                }
              }}
            >
              <span
                data-tour="bottom-nav-wizard"
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-background shadow-xs transform-gpu"
              >
                <span className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-primary shadow-sm transition-transform active:scale-95 hover:border-primary-strong hover:text-primary-strong transform-gpu">
                  <Plus className="size-6" aria-hidden="true" />
                </span>
              </span>
            </NavLink>

            {rightSlots.map((slot) => (
              <BottomNavItem key={slot.path} item={slot} end={slot.path === "/"} />
            ))}

            {moreMenuSlots.length > 0
              ? renderMoreButton()
              : rightSlots.length < 2
                ? Array.from({ length: 2 - rightSlots.length }).map((_, i) => (
                    <div
                      key={`right-empty-${i}`}
                      className="flex min-h-11 items-center justify-center"
                      aria-hidden="true"
                    />
                  ))
                : null}
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto grid h-16 max-w-md md:max-w-xl items-center px-2",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) === 2 && "grid-cols-2",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) === 3 && "grid-cols-3",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) >= 4 && "grid-cols-4",
            )}
          >
            {primarySlots.map((slot) => (
              <BottomNavItem key={slot.path} item={slot} end={slot.path === "/"} />
            ))}
            {moreMenuSlots.length > 0 && renderMoreButton()}
          </div>
        )}
      </nav>
    </>
  );
}
