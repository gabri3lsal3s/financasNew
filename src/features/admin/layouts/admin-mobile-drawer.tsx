import { useEffect } from "react";
import { Link, NavLink } from "react-router";
import { ExternalLink, LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { ADMIN_NAV_ITEMS } from "./admin-nav-config";

export interface AdminMobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

/**
 * Menu deslizante móvel do Console Administrativo (< md) com suporte a Escape e semântica de diálogo.
 */
export function AdminMobileDrawer({ open, onClose, onSignOut }: AdminMobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegação administrativa"
      className="fixed inset-x-0 bottom-0 top-14 z-sticky flex flex-col bg-background/95 backdrop-blur-xs p-4 md:hidden border-b border-border/80 pt-safe pb-safe overflow-y-auto"
    >
      <nav className="flex flex-col gap-1" aria-label="Navegação administrativa móvel">
        {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => {
              triggerSensory("selection");
              onClose();
            }}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 min-h-11 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 font-semibold text-primary-strong border border-primary/20"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )
            }
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-border/80 flex flex-col gap-2">
        <Link
          to="/"
          onClick={onClose}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full justify-center gap-2 text-xs font-semibold",
          )}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span>Abrir App de Finanças</span>
        </Link>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          sensoryIntent="destructive"
          onClick={onSignOut}
          className="w-full justify-center gap-2"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span>Sair do Painel</span>
        </Button>
      </div>
    </div>
  );
}
