import { NavLink, useLocation } from "react-router";
import { Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav-items";
import type { NavItem } from "@/components/layout/nav-items";
import { triggerHaptic } from "@/services/haptics";

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

/**
 * Ação do FAB por página (F12): o + abre a criação do contexto atual.
 * Páginas sem fluxo de criação próprio caem no wizard de lançamento
 * (o deep-link `?novo=<tipo>` abre o diálogo de criação na página-alvo).
 */
const createActions: Record<string, { to: string; label: string }> = {
  "/": { to: "/transacoes/novo", label: "Nova transação" },
  "/transacoes": { to: "/transacoes/novo", label: "Nova transação" },
  "/cartoes": { to: "/cartoes?novo=cartao", label: "Novo cartão" },
  "/dividas": { to: "/dividas?novo=divida", label: "Nova dívida" },
  "/categorias": { to: "/categorias?novo=categoria", label: "Nova categoria" },
};

const defaultCreate = { to: "/transacoes/novo", label: "Nova transação" };

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
  const location = useLocation();
  const create = createActions[location.pathname] ?? defaultCreate;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-bottom-nav border-t border-border bg-surface/90 backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        <SlotLink item={inicio} end />
        <SlotLink item={transacoes} />

        {/* FAB central elevado: criação do contexto da página atual (F12 —
            sem botões "Novo X" duplicados no mobile). Haptic leve (F8 — Decisão 3). */}
        <NavLink
          to={create.to}
          aria-label={create.label}
          className="flex min-h-11 items-center justify-center"
          onClick={() => triggerHaptic("light")}
        >
          {/* FAB com fundo na cor do tema e contorno nítido suave (sem serrilhamento de box-shadow ring) */}
          <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-background shadow-xs transform-gpu">
            <span className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-primary shadow-sm transition-transform active:scale-95 hover:border-primary-strong hover:text-primary-strong transform-gpu">
              <Plus className="size-6" aria-hidden="true" />
            </span>
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
