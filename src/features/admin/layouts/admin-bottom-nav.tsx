import { useLocation } from "react-router";
import {
  Ellipsis,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Users,
} from "lucide-react";
import { BottomNavItem } from "@/components/layout/bottom-nav-item";
import type { NavItem } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { AdminNavBadgeKey } from "./admin-nav-config";

const ADMIN_BOTTOM_NAV_ITEMS: NavItem[] = [
  { path: "/admin/dashboard", label: "Início", icon: LayoutDashboard },
  { path: "/admin/usuarios", label: "Usuários", icon: Users },
  { path: "/admin/faturamento", label: "Faturamento", icon: Receipt },
  { path: "/admin/chamados", label: "Chamados", icon: LifeBuoy },
];

const ADMIN_MORE_ROUTES = [
  "/admin/convites",
  "/admin/sistema",
  "/admin/seguranca",
  "/admin/laboratorio-forense",
];

export interface AdminBottomNavProps {
  moreOpen: boolean;
  onOpenMore: () => void;
  badges?: Partial<Record<AdminNavBadgeKey, number>>;
}

export function AdminBottomNav({ moreOpen, onOpenMore, badges }: AdminBottomNavProps) {
  const location = useLocation();

  const isMoreRoute = ADMIN_MORE_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`),
  );
  const isMoreActive = moreOpen || isMoreRoute;

  const totalBadges = Object.values(badges ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-border/80 bg-surface/95 backdrop-blur pb-safe md:hidden"
      aria-label="Navegação inferior administrativa"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1.5">
        {ADMIN_BOTTOM_NAV_ITEMS.map((item) => (
          <BottomNavItem key={item.path} item={item} />
        ))}

        <button
          type="button"
          aria-label="Mais opções"
          aria-expanded={moreOpen}
          onClick={() => {
            triggerSensory("action");
            onOpenMore();
          }}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors relative cursor-pointer w-full",
            isMoreActive ? "text-primary-strong font-semibold" : "text-muted-foreground",
          )}
        >
          <div className="relative">
            <Ellipsis className="size-5 shrink-0" aria-hidden="true" />
            {totalBadges > 0 && (
              <span className="absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-surface bg-warning-strong" />
            )}
          </div>
          <span className="w-full text-center leading-tight tracking-tight line-clamp-1">Mais</span>
        </button>
      </div>
    </nav>
  );
}
