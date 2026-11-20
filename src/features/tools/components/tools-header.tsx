import { Link, useLocation } from "react-router";
import { ArrowLeft, Layers, PieChart, ShieldAlert, TrendingUp } from "lucide-react";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

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
    <header className="sticky top-0 z-sticky w-full border-b border-border/80 bg-background/95 backdrop-blur-md pt-safe">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 min-w-0">
        <div className="flex items-center gap-4 shrink-0 min-w-0">
          <Link
            to="/apresentacao"
            className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
            aria-label="Ir para a página de apresentação do Axir"
          >
            <BrandLogo showWordmark showSubtitle />
          </Link>
          <Link
            to="/apresentacao"
            className="hidden xl:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-lg hover:bg-surface-hover/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Conhecer a Plataforma</span>
          </Link>
        </div>

        {/* Links horizontais apenas em >= 1024px (lg:) — Regra 22 */}
        <nav
          aria-label="Simuladores Financeiros Abertos"
          className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth rounded-full border border-border/80 bg-surface p-1"
        >
          {TOOLS_NAV_TABS.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary-strong text-primary-foreground dark:bg-primary shadow-xs font-semibold"
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

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeToggle />
          <Link
            to="/apresentacao"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:inline-flex xl:hidden text-xs font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            Apresentação
          </Link>
          <Link
            to="/entrar"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs font-medium")}
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "text-xs font-semibold shadow-xs",
            )}
          >
            Criar Conta
          </Link>
        </div>
      </div>

      {/* Navegação horizontal rolável em Mobile & Tablet (< lg) */}
      <div className="flex lg:hidden border-t border-border/80 bg-surface/60 px-4 py-2 overflow-x-auto no-scrollbar scroll-smooth gap-1.5">
        {TOOLS_NAV_TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "shrink-0 min-w-fit min-h-11 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? "bg-primary-strong text-primary-foreground dark:bg-primary font-semibold"
                  : "bg-surface text-muted-foreground hover:text-foreground border border-border/80",
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
