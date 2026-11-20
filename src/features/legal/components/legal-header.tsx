import { Link, useNavigate } from "react-router";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { cn } from "@/lib/utils";

export interface LegalHeaderProps {
  activeTab: "terms" | "privacy";
}

export function LegalHeader({ activeTab }: LegalHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-sticky w-full border-b border-border/80 bg-background/90 backdrop-blur-md shadow-xs pt-safe">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 min-w-0">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
          aria-label="Axir - Ir para a página inicial"
        >
          <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
        </Link>

        {/* Links horizontais apenas em >= 1024px (lg:) — Regra 22 */}
        <nav
          aria-label="Documentos Legais"
          className="hidden lg:flex items-center gap-1 p-1 bg-surface-raised/80 rounded-xl border border-border/80"
        >
          <Link
            to="/termos"
            aria-current={activeTab === "terms" ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === "terms"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Termos de Uso</span>
          </Link>
          <Link
            to="/privacidade"
            aria-current={activeTab === "privacy" ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === "privacy"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Privacidade (LGPD)</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/entrar")}
            className="hidden sm:inline-flex px-3 text-xs font-medium border-border/80 bg-surface hover:bg-surface-hover shadow-xs"
          >
            Acessar Plataforma
          </Button>
        </div>
      </div>

      {/* Navegação Mobile & Tablet (< lg) */}
      <div className="lg:hidden border-t border-border/60 bg-surface/60 px-4 py-2">
        <nav
          aria-label="Documentos Legais (Mobile)"
          className="flex items-center justify-center gap-1 p-1 bg-surface-raised/80 rounded-xl border border-border/80"
        >
          <Link
            to="/termos"
            aria-current={activeTab === "terms" ? "page" : undefined}
            className={cn(
              "flex-1 flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeTab === "terms"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Termos de Uso</span>
          </Link>
          <Link
            to="/privacidade"
            aria-current={activeTab === "privacy" ? "page" : undefined}
            className={cn(
              "flex-1 flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeTab === "privacy"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Privacidade (LGPD)</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
