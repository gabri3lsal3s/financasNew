import { useMemo } from "react";
import { Link } from "react-router";
import { navGroups, filterNavItems, navItems } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { InstallAppButton } from "@/components/modules/install-app-button";
import { useReminders, useUserAccess } from "@/state";
import { cn } from "@/lib/utils";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export interface MoreMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreMenuSheet({ open, onOpenChange }: MoreMenuSheetProps) {
  const { totalCount, urgentCount } = useReminders();
  const { isAdmin, hasFeature } = useUserAccess();

  const groups = useMemo(() => {
    const allowedItems = filterNavItems(navItems, isAdmin, hasFeature);
    const { primarySlots } = resolveBottomNavSlots(allowedItems);
    const bottomNavPaths = new Set(primarySlots.map((s) => s.path));

    return navGroups
      .map((group) => ({
        title: group.title,
        items: filterNavItems(
          group.items.filter((item) => !bottomNavPaths.has(item.path)),
          isAdmin,
          hasFeature,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin, hasFeature]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mais opções"
      description="Navegue pelas demais áreas e configurações da aplicação"
      size="md"
    >
      <div className="space-y-6 pt-2 pb-4">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h2>
            <nav className="grid gap-2" aria-label={group.title}>
              {group.items.map((item) => {
                const isReminders = item.path === "/lembretes";
                const showBadge = isReminders && totalCount > 0;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                      <span>{item.label}</span>
                    </div>
                    {showBadge && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                          urgentCount > 0
                            ? "bg-danger text-white"
                            : "bg-primary/15 text-primary-strong",
                        )}
                      >
                        {totalCount > 9 ? "9+" : totalCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}

        <div className="pt-2">
          <InstallAppButton />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
