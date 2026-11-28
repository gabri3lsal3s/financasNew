import { Link, NavLink } from "react-router";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import {
  ADMIN_FORENSICS_NAV_ITEM,
  ADMIN_NAV_GROUPS,
  type AdminNavBadgeKey,
} from "./admin-nav-config";

export interface AdminMobileDrawerProps {
  open: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
  badges?: Partial<Record<AdminNavBadgeKey, number>>;
}

export function AdminMobileDrawer({
  open,
  onClose,
  isSuperAdmin = false,
  badges,
}: AdminMobileDrawerProps) {
  const ForensicsIcon = ADMIN_FORENSICS_NAV_ITEM.icon;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Mais opções"
      description="Navegue pelas áreas administrativas"
      size="md"
    >
      <div className="space-y-6 pt-2 pb-4 pb-safe">
        {ADMIN_NAV_GROUPS.map((group) => (
          <section key={group.id} aria-label={group.label} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h2>
            <nav className="grid gap-2" aria-label={group.label}>
              {group.items.map(({ to, label, icon: Icon, badgeKey }) => {
                const count = badgeKey ? (badges?.[badgeKey] ?? 0) : 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => {
                      triggerSensory("selection");
                      onClose();
                    }}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-11 items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99] cursor-pointer",
                        isActive && "text-primary-strong font-semibold",
                      )
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </div>
                    {count > 0 && (
                      <Badge
                        size="xs"
                        variant="warning"
                        className="h-5 min-w-5 px-1.5 font-bold"
                      >
                        {count > 9 ? "9+" : count}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </section>
        ))}

        <section aria-label="Ferramentas & Aplicativo" className="space-y-2 pt-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ferramentas &amp; Aplicativo
          </h2>
          <div className="grid gap-2">
            {isSuperAdmin && (
              <NavLink
                to={ADMIN_FORENSICS_NAV_ITEM.to}
                onClick={() => {
                  triggerSensory("selection");
                  onClose();
                }}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99] cursor-pointer",
                    isActive && "text-primary-strong font-semibold",
                  )
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ForensicsIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{ADMIN_FORENSICS_NAV_ITEM.label}</span>
                </div>
              </NavLink>
            )}

            <Link
              to="/"
              onClick={() => {
                triggerSensory("selection");
                onClose();
              }}
              className="flex min-h-11 items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ExternalLink className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>Ver App</span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </Modal>
  );
}
