import { useMemo } from "react";
import { Link } from "react-router";
import { Smartphone } from "lucide-react";
import { navGroups, filterNavItems, navItems } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { InstallAppButton } from "@/components/modules/install-app-button";
import { isAndroidDevice, isNativePlatform } from "@/services/native/platform";
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
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99]"
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

        <div className="pt-2 space-y-2">
          <InstallAppButton />

          {!isNativePlatform() && isAndroidDevice() && (
            <Link
              to="/configuracoes?tab=devices"
              onClick={() => onOpenChange(false)}
              className="flex w-full items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-left transition-colors hover:bg-primary/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-strong">
                  <Smartphone className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Baixar App Android Pro (APK)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Leitura automática de comprovantes Pix e cartões
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
