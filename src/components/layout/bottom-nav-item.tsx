import { NavLink, useMatch } from "react-router";
import type { NavItem } from "@/components/layout/nav-items";
import { scrollToTop } from "@/services/scroll";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface BottomNavItemProps {
  item: NavItem;
  end?: boolean;
}

export function BottomNavItem({ item, end = false }: BottomNavItemProps) {
  const match = useMatch({ path: item.path, end });

  const handleClick = () => {
    if (match) {
      scrollToTop({ sensoryFeedback: true });
      return;
    }
    triggerSensory("selection");
  };

  return (
    <NavLink
      to={item.path}
      end={end}
      onClick={handleClick}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          // Área de toque mínima 44×44px e destaque semântico (DESIGN_SYSTEM §13).
          "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors w-full cursor-pointer",
          isActive ? "text-primary-strong font-semibold" : "text-muted-foreground",
        )
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="w-full text-center leading-tight tracking-tight line-clamp-1">
        {item.shortLabel ?? item.label}
      </span>
    </NavLink>
  );
}
