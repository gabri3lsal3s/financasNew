import { Link, useLocation } from "react-router";
import { BrandLogo } from "@/components/layout";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Layers, ShieldAlert, PieChart, TrendingUp } from "lucide-react";

export interface ToolNavTab {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const TOOLS_NAV_TABS: ToolNavTab[] = [
  {
    path: "/ferramentas",
    label: "Hub",
    icon: <Layers className="size-3.5" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/simulador-dividas",
    label: "Simulador de Dívidas",
    icon: <ShieldAlert className="size-3.5" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/rebalanceamento",
    label: "Rebalanceamento",
    icon: <PieChart className="size-3.5" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/juros-compostos",
    label: "Juros Compostos & FIRE",
    icon: <TrendingUp className="size-3.5" aria-hidden="true" />,
  },
];

export function ToolsHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Marca & Início */}
        <div className="flex items-center gap-6">
          <Link
            to="/apresentacao"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Ir para a página inicial do Áxis Finance"
          >
            <BrandLogo showWordmark showSubtitle />
          </Link>
        </div>

        {/* Abas Centrais de Navegação entre Ferramentas */}
        <nav
          aria-label="Simuladores Financeiros Abertos"
          className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth rounded-full border border-border/80 bg-surface/80 p-1"
        >
          {TOOLS_NAV_TABS.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Acesso e Conversão */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/entrar"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs font-medium")}
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "text-xs font-semibold shadow-xs")}
          >
            Criar Conta
          </Link>
        </div>
      </div>

      {/* Navegação Mobile Inferior do Header */}
      <div className="flex md:hidden border-t border-border/60 bg-surface/50 px-4 py-2 overflow-x-auto no-scrollbar scroll-smooth gap-1.5">
        {TOOLS_NAV_TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-surface text-muted-foreground hover:text-foreground border border-border/60",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
