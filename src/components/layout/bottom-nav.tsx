import { NavLink } from "react-router";
import { Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav-items";
import type { NavItem } from "@/components/layout/nav-items";

/** Resolve um slot obrigatório da BottomNav a partir da fonte única de navegação. */
function requiredSlot(path: string): NavItem {
  const item = navItems.find((candidate) => candidate.path === path);
  if (item === undefined) {
    throw new Error(`BottomNav: slot de navegação ausente em navItems: ${path}`);
  }
  return item;
}

/** Grid de 5 posições simétrico (F7.1): Início | Transações | FAB Novo | Cartões | Mais. */
const inicio = requiredSlot("/");
const transacoes = requiredSlot("/transacoes");
const cartoes = requiredSlot("/cartoes");

const quickEntry = "/transacoes?novo=despesa";

function SlotLink({ item, end = false }: { item: NavItem; end?: boolean }) {
  return (
    <NavLink
      to={item.path}
      end={end}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          // Área de toque mínima 44×44px e destaque semântico (DESIGN_SYSTEM §13).
          "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
          isActive ? "text-primary-strong" : "text-muted-foreground",
        )
      }
    >
      <item.icon className="size-5" aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        <SlotLink item={inicio} end />
        <SlotLink item={transacoes} />

        {/* FAB central elevado: lançamento rápido (D10 — wizard abre via ?novo=despesa em F2). */}
        <NavLink
          to={quickEntry}
          aria-label="Lançar despesa ou receita"
          className="flex min-h-11 items-center justify-center"
        >
          <span className="-mt-6 flex size-12 items-center justify-center rounded-full bg-primary-strong text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95">
            <Plus className="size-6" aria-hidden="true" />
          </span>
        </NavLink>

        <SlotLink item={cartoes} />

        <NavLink
          to="/mais"
          className={({ isActive }) =>
            cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
              isActive ? "text-primary-strong" : "text-muted-foreground",
            )
          }
        >
          <Ellipsis className="size-5" aria-hidden="true" />
          <span>Mais</span>
        </NavLink>
      </div>
    </nav>
  );
}
