import { NavLink } from "react-router";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav-items";

function pick(...paths: string[]) {
  return paths
    .map((path) => navItems.find((item) => item.path === path))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
}

const tabs = pick("/", "/transacoes", "/relatorios");
const quickEntry = "/transacoes?novo=despesa";

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {tabs.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
                isActive ? "text-primary-strong" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}

        {/* FAB central: lançamento rápido (D10 — wizard abre via ?novo=despesa em F2). */}
        <NavLink
          to={quickEntry}
          aria-label="Lançar despesa ou receita"
          className="flex items-center justify-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-strong text-primary-foreground shadow-lg transition-transform active:scale-95">
            <Plus className="size-6" aria-hidden="true" />
          </span>
        </NavLink>

        <NavLink
          to="/mais"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
              isActive ? "text-primary-strong" : "text-muted-foreground",
            )
          }
        >
          <span className="flex size-5 items-center justify-center">
            <span className="flex size-1.5 rounded-full bg-current" aria-hidden="true" />
            <span className="flex size-1.5 rounded-full bg-current" aria-hidden="true" />
            <span className="flex size-1.5 rounded-full bg-current" aria-hidden="true" />
          </span>
          Mais
        </NavLink>
      </div>
    </nav>
  );
}
