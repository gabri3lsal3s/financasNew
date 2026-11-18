import { NavLink, useMatch } from "react-router";
import type { NavItem } from "@/components/layout/nav-items";
import { Badge } from "@/components/ui/badge";
import { scrollToTop } from "@/services/scroll";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  item: NavItem;
  expanded: boolean;
  totalCount: number;
  urgentCount: number;
}

function SidebarNavItem({ item, expanded, totalCount, urgentCount }: SidebarNavItemProps) {
  const end = item.path === "/";
  const match = useMatch({ path: item.path, end });
  const isReminders = item.path === "/lembretes";
  const showBadge = isReminders && totalCount > 0;

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
      aria-label={expanded ? undefined : item.label}
      title={expanded ? undefined : item.label}
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
        <item.icon className="size-5 shrink-0" aria-hidden="true" />
        {!expanded && showBadge && (
          <span
            className={cn(
              "absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-surface",
              urgentCount > 0 ? "bg-critical" : "bg-primary",
            )}
          />
        )}
      </div>
      {expanded && (
        <div className="flex flex-1 items-center justify-between overflow-hidden animate-fade-slide-in">
          <span className="overflow-hidden truncate">{item.label}</span>
          {showBadge && (
            <Badge
              size="xs"
              variant={urgentCount > 0 ? "critical" : "default"}
              className="ml-auto h-5 min-w-5 px-1.5 font-bold"
            >
              {totalCount > 9 ? "9+" : totalCount}
            </Badge>
          )}
        </div>
      )}
    </NavLink>
  );
}

export interface SidebarNavGroupProps {
  title: string;
  items: readonly NavItem[];
  groupIndex: number;
  expanded: boolean;
  totalCount: number;
  urgentCount: number;
}

export function SidebarNavGroup({
  title,
  items,
  groupIndex,
  expanded,
  totalCount,
  urgentCount,
}: SidebarNavGroupProps) {
  return (
    <div className="space-y-1">
      {expanded ? (
        <p className="px-3.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 animate-fade-slide-in">
          {title}
        </p>
      ) : groupIndex > 0 ? (
        <div className="my-2 mx-auto h-px w-8 bg-border/80" aria-hidden="true" />
      ) : null}

      {items.map((item) => (
        <SidebarNavItem
          key={item.path}
          item={item}
          expanded={expanded}
          totalCount={totalCount}
          urgentCount={urgentCount}
        />
      ))}
    </div>
  );
}
