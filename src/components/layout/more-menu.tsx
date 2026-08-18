import { Link } from "react-router";
import { BrandLogo } from "@/components/layout/brand-logo";
import { navItems } from "@/components/layout/nav-items";
import { InstallAppButton } from "@/components/modules/install-app-button";
import { useReminders } from "@/state";
import { cn } from "@/lib/utils";

export function MoreMenu() {
  const { totalCount, urgentCount } = useReminders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs">
        <BrandLogo markClassName="size-10" showSubtitle />
      </div>
      <h1 className="sr-only">Mais</h1>
      <nav className="grid gap-2" aria-label="Todas as áreas">
        {navItems.map((item) => {
          const isReminders = item.path === "/lembretes";
          const showBadge = isReminders && totalCount > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover"
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
      {/* PWA: instalação no menu (nunca popup intrusivo) — PWA_GUIDELINES §6 */}
      <InstallAppButton />
    </div>
  );
}
