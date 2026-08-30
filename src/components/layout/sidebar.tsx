import { useEffect, useRef, useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoProfileButton } from "@/components/layout/logo-profile-button";
import { navGroups, filterNavItems } from "@/components/layout/nav-items";
import { scrollToTop } from "@/services/scroll";
import { useReminders, useUserAccess } from "@/state";


/** Atraso do hover-expand: evita disparos acidentais com mouse rápido (F25). */
const HOVER_EXPAND_DELAY_MS = 120;

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
 *
 * F25 — Hover-expand em overlay: quando colapsada, passar o mouse expande a
 * sidebar por cima do conteúdo (fixed, sem deslocar a página) após um pequeno
 * atraso (anti-disparo acidental). O toggle manual continua sendo a fonte da
 * persistência (`useSidebarState`).
 */
export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { totalCount, urgentCount } = useReminders();

  // A limpeza dos timers no unmount evita setState em componente desmontado.
  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) clearTimeout(enterTimer.current);
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    // Só faz sentido expandir por hover se a sidebar estiver persistida colapsada.
    if (isCollapsed && !hoverExpanded) {
      enterTimer.current = setTimeout(() => setHoverExpanded(true), HOVER_EXPAND_DELAY_MS);
    }
  };

  const handleMouseLeave = () => {
    if (enterTimer.current !== null) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    // Pequeno atraso também na saída para evitar flicker ao cruzar bordas.
    leaveTimer.current = setTimeout(() => setHoverExpanded(false), HOVER_EXPAND_DELAY_MS);
  };

  const { isAdmin, hasFeature } = useUserAccess();
  const expanded = !isCollapsed || hoverExpanded;

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((g) => ({
        title: g.title,
        items: filterNavItems(g.items, isAdmin, hasFeature),
      }))
      .filter((g) => g.items.length > 0);
  }, [isAdmin, hasFeature]);


  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed inset-y-0 left-0 z-sidebar hidden flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex",
        expanded ? "w-64" : "w-20",
        // Overlay por hover: sombra só quando flutuando sobre o conteúdo.
        hoverExpanded && isCollapsed && "shadow-2xl",
      )}

    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border overflow-hidden",
          expanded ? "px-4" : "justify-center px-2",
        )}
      >
        <LogoProfileButton
          showWordmark={expanded}
          markClassName="size-8 shrink-0"
          className={cn(
            "rounded-xl hover:bg-surface-hover/80 p-2 transition-colors text-left",
            expanded ? "w-full justify-start gap-2.5" : "justify-center",
          )}
        />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5" aria-label="Navegação principal">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.title} className="space-y-1">
            {expanded ? (
              <p className="px-3.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 animate-fade-slide-in">
                {group.title}
              </p>
            ) : groupIndex > 0 ? (
              <div className="my-2 mx-auto h-px w-8 bg-border/80" aria-hidden="true" />
            ) : null}

            {group.items.map((item) => {

              const isReminders = item.path === "/lembretes";
              const showBadge = isReminders && totalCount > 0;
              const isCurrent =
                item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  aria-label={expanded ? undefined : item.label}
                  title={expanded ? undefined : item.label}
                  onClick={(e) => {
                    if (isCurrent) {
                      const scrolled = scrollToTop();
                      if (scrolled) {
                        e.preventDefault();
                      }
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors overflow-hidden whitespace-nowrap relative",
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
                          urgentCount > 0 ? "bg-danger" : "bg-primary",
                        )}
                      />
                    )}
                  </div>
                  {expanded && (
                    <div className="flex flex-1 items-center justify-between overflow-hidden animate-fade-slide-in">
                      <span className="overflow-hidden truncate">{item.label}</span>
                      {showBadge && (
                        <span
                          className={cn(
                            "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                            urgentCount > 0
                              ? "bg-danger text-white"
                              : "bg-primary/15 text-primary-strong",
                          )}
                        >
                          {totalCount > 9 ? "9+" : totalCount}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground overflow-hidden whitespace-nowrap",
            !expanded && "justify-center px-2",
          )}
        >
          {expanded ? (
            <>
              <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
              <span className="overflow-hidden whitespace-nowrap animate-fade-slide-in">
                Recolher
              </span>
            </>
          ) : (
            <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  );
}
