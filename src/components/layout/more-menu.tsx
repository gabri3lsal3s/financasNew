import { useMemo } from "react";
import { Link } from "react-router";
import { navGroups, filterNavItems } from "@/components/layout/nav-items";
import { InstallAppButton } from "@/components/modules/install-app-button";
import { useReminders, useUserAccess } from "@/state";
import { cn } from "@/lib/utils";

/** Itens fixos na BottomNav que não devem ser duplicados no menu "Mais". */
const BOTTOM_NAV_PATHS = new Set(["/", "/transacoes", "/cartoes"]);

export function MoreMenu() {
  const { totalCount, urgentCount } = useReminders();
  const { isAdmin, hasFeature } = useUserAccess();

  const groups = useMemo(() => {
    return navGroups
      .map((group) => ({
        title: group.title,
        items: filterNavItems(
          group.items.filter((item) => !BOTTOM_NAV_PATHS.has(item.path)),
          isAdmin,
          hasFeature,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin, hasFeature]);


  return (
    <div className="space-y-6">
      <h1 className="sr-only">Mais opções</h1>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="space-y-2.5">
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
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99]"
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
      </div>
      {/* PWA: instalação no menu (nunca popup intrusivo) — PWA_GUIDELINES §6 */}
      <InstallAppButton />
    </div>
  );
}


