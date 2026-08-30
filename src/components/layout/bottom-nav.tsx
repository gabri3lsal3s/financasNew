import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterNavItems, navItems } from "@/components/layout/nav-items";
import type { NavItem } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { triggerSensory } from "@/services/sensory";
import { useReminders, useUserAccess } from "@/state";
import { MoreMenuSheet } from "./more-menu-sheet";


/**
 * Resolve a ação do FAB de acordo com o contexto da página e as permissões ativas do usuário.
 */
function getFabAction(
  pathname: string,
  search: string,
  hasFeature: (key: string) => boolean,
): { to: string; label: string } | null {
  const params = new URLSearchParams(search);

  if (pathname === "/dividas" && hasFeature("debts")) {
    params.set("novo", "divida");
    return { to: `${pathname}?${params.toString()}`, label: "Nova dívida" };
  }

  if (pathname === "/categorias" && hasFeature("budgets")) {
    params.set("novo", "categoria");
    return { to: `${pathname}?${params.toString()}`, label: "Nova categoria" };
  }

  if ((pathname === "/investments" || pathname === "/investimentos") && hasFeature("investments")) {
    params.set("novo", "investimento");
    return { to: `${pathname}?${params.toString()}`, label: "Novo investimento" };
  }

  if (hasFeature("transactions")) {
    params.set("novo", "transacao");
    return { to: `${pathname}?${params.toString()}`, label: "Nova transação" };
  }

  if (hasFeature("investments")) {
    params.set("novo", "investimento");
    return { to: `${pathname}?${params.toString()}`, label: "Novo investimento" };
  }

  if (hasFeature("debts")) {
    params.set("novo", "divida");
    return { to: `${pathname}?${params.toString()}`, label: "Nova dívida" };
  }

  if (hasFeature("budgets")) {
    params.set("novo", "categoria");
    return { to: `${pathname}?${params.toString()}`, label: "Nova categoria" };
  }

  return null;
}

function SlotLink({ item, end = false }: { item: NavItem; end?: boolean }) {
  return (
    <NavLink
      to={item.path}
      end={end}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          // Área de toque mínima 44×44px e destaque semântico (DESIGN_SYSTEM §13).
          "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors w-full",
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

export function BottomNav() {
  const location = useLocation();
  const { hasFeature, isAdmin } = useUserAccess();
  const { totalCount, urgentCount } = useReminders();

  const allowedItems = filterNavItems(navItems, isAdmin, hasFeature);
  const { primarySlots, moreMenuSlots } = resolveBottomNavSlots(allowedItems);

  const create = getFabAction(location.pathname, location.search, hasFeature);

  // Divide os slots primários ao redor do FAB
  const leftSlots = primarySlots.slice(0, 2);
  const rightSlots = primarySlots.slice(2, 4);

  // Verifica se a rota atual pertence a algum item do menu "Mais"
  const primaryPaths = new Set(primarySlots.map((s) => s.path));
  const moreSubItem = moreMenuSlots.find((candidate) => {
    if (primaryPaths.has(candidate.path)) return false;
    if (location.pathname === candidate.path || location.pathname.startsWith(`${candidate.path}/`)) {
      return true;
    }
    if (
      candidate.path === "/orcamentos" &&
      (location.pathname === "/categorias" || location.pathname.startsWith("/categorias/"))
    ) {
      return true;
    }
    if (
      candidate.path === "/investments" &&
      (location.pathname === "/investimentos" ||
        location.pathname.startsWith("/investimentos/") ||
        location.pathname === "/carteira" ||
        location.pathname.startsWith("/carteira/"))
    ) {
      return true;
    }
    return false;
  });

  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const isMoreRoot = location.pathname === "/mais" || location.pathname.startsWith("/mais/");

  const isMoreActive = isMoreRoot || Boolean(moreSubItem) || moreSheetOpen;
  const MoreIcon = moreSubItem ? moreSubItem.icon : Ellipsis;

  // Botão "Mais" renderizado
  const renderMoreButton = () => (
    <button
      type="button"
      aria-label={moreSubItem ? `Mais (${moreSubItem.label})` : "Mais opções"}
      onClick={() => {
        triggerSensory("action");
        setMoreSheetOpen(true);
      }}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors relative cursor-pointer w-full",
        isMoreActive ? "text-primary-strong font-semibold" : "text-muted-foreground",
      )}
    >
      <div className="relative">
        <MoreIcon
          key={moreSubItem?.path ?? "mais"}
          className="size-5 animate-spring-pop transform-gpu"
          aria-hidden="true"
        />
        {totalCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-surface",
              urgentCount > 0 ? "bg-danger" : "bg-primary",
            )}
          />
        )}
      </div>
      <span className="w-full text-center leading-tight tracking-tight line-clamp-1">Mais</span>
    </button>
  );

  return (
    <>
      <MoreMenuSheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen} />
      <nav
        className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-border bg-surface/90 backdrop-blur pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        aria-label="Navegação principal"
      >
        {create ? (
          /* Layout Padrão com FAB Central (5 Colunas) */
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1.5 sm:px-2">
            {leftSlots.map((slot) => (
              <SlotLink key={slot.path} item={slot} end={slot.path === "/"} />
            ))}
            {leftSlots.length < 2 &&
              Array.from({ length: 2 - leftSlots.length }).map((_, i) => (
                <div key={`left-empty-${i}`} className="flex min-h-11 items-center justify-center" aria-hidden="true" />
              ))}

            {/* Slot Central: FAB de Criação */}
            <NavLink
              to={create.to}
              aria-label={create.label}
              className="flex min-h-11 items-center justify-center"
              onClick={() => triggerSensory("action")}
            >
              <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-background shadow-xs transform-gpu">
                <span className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-primary shadow-sm transition-transform active:scale-95 hover:border-primary-strong hover:text-primary-strong transform-gpu">
                  <Plus className="size-6" aria-hidden="true" />
                </span>
              </span>
            </NavLink>

            {rightSlots.map((slot) => (
              <SlotLink key={slot.path} item={slot} end={slot.path === "/"} />
            ))}

            {moreMenuSlots.length > 0
              ? renderMoreButton()
              : rightSlots.length < 2
                ? Array.from({ length: 2 - rightSlots.length }).map((_, i) => (
                    <div key={`right-empty-${i}`} className="flex min-h-11 items-center justify-center" aria-hidden="true" />
                  ))
                : null}
          </div>
        ) : (
          /* Layout Somente-Leitura (Sem FAB) com Distribuição Homogênea Proporcional */
          <div
            className={cn(
              "mx-auto grid h-16 max-w-md items-center px-2",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) === 2 && "grid-cols-2",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) === 3 && "grid-cols-3",
              primarySlots.length + (moreMenuSlots.length > 0 ? 1 : 0) >= 4 && "grid-cols-4",
            )}
          >
            {primarySlots.map((slot) => (
              <SlotLink key={slot.path} item={slot} end={slot.path === "/"} />
            ))}
            {moreMenuSlots.length > 0 && renderMoreButton()}
          </div>
        )}
      </nav>
    </>
  );
}


