import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Menu, X, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { buttonVariants } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { cn } from "@/lib/utils";
import { useLandingCta, useScrollSpy } from "@/features/landing/hooks";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useLandingCta();
  const { activeSection, scrollProgress, isScrolled } = useScrollSpy();
  const { canInstall, install } = usePWAInstall();

  const isSubpage =
    location.pathname === "/precos" ||
    location.pathname === "/planos" ||
    location.pathname === "/vendas";

  const homeUrl = isLoggedIn ? "/" : "/landing";

  // Reseta o menu mobile durante a renderização ao trocar de rota (padrão oficial React)
  const currentRouteKey = location.pathname + location.hash;
  const [prevRouteKey, setPrevRouteKey] = useState(currentRouteKey);
  if (prevRouteKey !== currentRouteKey) {
    setPrevRouteKey(currentRouteKey);
    setMobileMenuOpen(false);
  }

  // Liberação garantida da rolagem na desmontagem do cabeçalho
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Trava de rolagem do body quando o menu mobile está aberto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileMenuOpen]);

  // Fechamento com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        isScrolled
          ? "border-b border-border/80 bg-background/85 backdrop-blur-md shadow-xs"
          : "border-b border-border/30 bg-background/60 backdrop-blur-xs",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center gap-2 sm:gap-3">
          {isSubpage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(homeUrl);
                }
              }}
              aria-label="Voltar para a página anterior"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-2 sm:ml-0"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar</span>
            </Button>
          ) : null}

          <Link to={homeUrl} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
          </Link>
        </div>

        {/* Desktop Navigation com Pílulas de Foco Ativo */}
        <nav className="hidden items-center gap-1.5 text-sm font-medium md:flex" aria-label="Navegação Principal">
          <button
            type="button"
            onClick={() => scrollToSection("recursos")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              activeSection === "recursos"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            Recursos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("investimentos")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              activeSection === "investimentos"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            Investimentos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("simulador")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              activeSection === "simulador"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            Simulador FIRE
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("precos")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              activeSection === "precos"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("faq")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
              activeSection === "faq"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
            )}
          >
            Dúvidas
          </button>
        </nav>

        {/* Action CTAs & Theme Toggle */}
        <div className="hidden items-center gap-3 sm:flex">
          {canInstall && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void install()}
              className="gap-1.5 font-medium cursor-pointer"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Instalar App</span>
            </Button>
          )}
          <ThemeToggle />
          {isLoggedIn ? (
            <Link
              to="/"
              className={cn(buttonVariants({ size: "sm" }), "shadow-sm inline-flex items-center gap-1.5")}
            >
              Acessar App
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <>
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
            </>
          )}
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

      {/* Barra de Progresso de Leitura Micro-Métrica */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-primary/80 transition-all duration-75 ease-out pointer-events-none"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-label="Progresso de leitura da página"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* Backdrop do Menu Mobile */}
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 top-16 bg-background/75 backdrop-blur-xs z-30 sm:hidden animate-fade-in cursor-pointer"
          onClick={() => setMobileMenuOpen(false)}
          onTouchStart={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Mobile dropdown */}
      {mobileMenuOpen ? (
        <div className="relative z-40 border-b border-border bg-background p-4 shadow-xl sm:hidden animate-fade-slide-in">
          <nav className="flex flex-col gap-2 text-sm font-medium">
            {isSubpage ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate(homeUrl);
                  }
                }}
                className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-left text-muted-foreground hover:text-foreground cursor-pointer font-semibold border-b border-border/60 pb-2.5 mb-1"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Voltar à Apresentação</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => scrollToSection("recursos")}
              className={cn(
                "flex items-center py-2 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                activeSection === "recursos"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:text-primary",
              )}
            >
              Recursos
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("investimentos")}
              className={cn(
                "flex items-center py-2 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                activeSection === "investimentos"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:text-primary",
              )}
            >
              Investimentos & Aportes
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("simulador")}
              className={cn(
                "flex items-center py-2 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                activeSection === "simulador"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:text-primary",
              )}
            >
              Simulador FIRE
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("precos")}
              className={cn(
                "flex items-center py-2 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                activeSection === "precos"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:text-primary",
              )}
            >
              Planos & Preços
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("faq")}
              className={cn(
                "flex items-center py-2 px-2.5 rounded-lg text-left transition-colors cursor-pointer",
                activeSection === "faq"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:text-primary",
              )}
            >
              Dúvidas Frequentes
            </button>
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-border">
              {isLoggedIn ? (
                <Link
                  to="/"
                  className={cn(buttonVariants(), "w-full justify-center")}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Acessar meu App
                </Link>
              ) : (
                <>
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
                </>
              )}
              {canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void install();
                  }}
                  className="w-full justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Download className="size-4" aria-hidden="true" />
                  <span>Instalar Aplicativo no Dispositivo</span>
                </Button>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
