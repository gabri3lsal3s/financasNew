import { Link } from "react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { buttonVariants } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
          <BrandLogo markClassName="size-8" wordmarkClassName="text-base sm:text-lg" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Navegação Principal">
          <button
            type="button"
            onClick={() => scrollToSection("recursos")}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Recursos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("investimentos")}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Investimentos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("simulador")}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Simulador FIRE
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("precos")}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("faq")}
            className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Dúvidas
          </button>
        </nav>

        {/* Action CTAs & Theme Toggle */}
        <div className="hidden items-center gap-3 sm:flex">
          <ThemeToggle />
          <Link to="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className={cn(buttonVariants({ size: "sm" }), "shadow-sm inline-flex items-center gap-1.5")}
          >
            Começar grátis
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen ? (
        <div className="border-b border-border bg-background p-4 shadow-lg sm:hidden animate-fade-slide-in">
          <nav className="flex flex-col gap-3 text-sm font-medium">
            <button
              type="button"
              onClick={() => scrollToSection("recursos")}
              className="flex items-center py-2 text-left text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Recursos
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("investimentos")}
              className="flex items-center py-2 text-left text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Investimentos & Aportes
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("simulador")}
              className="flex items-center py-2 text-left text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Simulador FIRE
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("precos")}
              className="flex items-center py-2 text-left text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Planos & Preços
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("faq")}
              className="flex items-center py-2 text-left text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Dúvidas Frequentes
            </button>
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-border">
              <Link
                to="/entrar"
                className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
                onClick={() => setMobileMenuOpen(false)}
              >
                Entrar na minha conta
              </Link>
              <Link
                to="/cadastro"
                className={cn(buttonVariants(), "w-full justify-center")}
                onClick={() => setMobileMenuOpen(false)}
              >
                Criar conta gratuita
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
