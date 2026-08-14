import { NavLink } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav-items";

export interface SidebarProps {
  /** Estado colapsado (dono: PageShell via useSidebarState — fonte única). */
  isCollapsed: boolean;
  onToggle: () => void;
}

/**
 * Sidebar desktop colapsável (F7.2): expandida (w-64, logo + texto + ícones) ↔
 * compacta (w-20, apenas ícones centralizados com labels acessíveis via
 * aria-label/title). Transição nativa CSS (zero libs de animação) com suporte
 * a `prefers-reduced-motion`.
 */
export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-border",
          isCollapsed ? "justify-center px-2" : "px-6",
        )}
      >
        <span className="size-3 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        {!isCollapsed && (
          <span className="truncate font-display text-lg font-bold">Finanças</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Navegação principal">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            aria-label={isCollapsed ? item.label : undefined}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isCollapsed && "justify-center px-2",
                isActive
                  ? "bg-primary/12 text-primary-strong"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {!isCollapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
            isCollapsed && "justify-center px-2",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Recolher
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
