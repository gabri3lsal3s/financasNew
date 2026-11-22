import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Download, Menu, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { cn } from "@/lib/utils";
import { useLandingCta, useScrollSpy } from "@/features/landing/hooks";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { registerBackHandler } from "@/services/native";
import { LANDING_NAV_LINKS } from "./landing-nav-links";
import { LandingMobileDrawer } from "./landing-mobile-drawer";

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

  const homeUrl = "/";

  const currentRouteKey = location.pathname + location.hash;
  const [prevRouteKey, setPrevRouteKey] = useState(currentRouteKey);
  if (prevRouteKey !== currentRouteKey) {
    setPrevRouteKey(currentRouteKey);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = mobileMenuOpen ? "hidden" : "";
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    return registerBackHandler(() => {
      setMobileMenuOpen(false);
      return true;
    });
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNavigateBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(homeUrl);
    }
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-x-0 w-full transition-all duration-300 pt-safe",
          mobileMenuOpen ? "z-50" : "z-sticky",
          isScrolled
            ? "border-b border-border/80 bg-background/90 backdrop-blur-md shadow-xs"
            : "border-b border-border/30 bg-background/70 backdrop-blur-xs",
        )}
      >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 xl:px-12 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <Link
            to={homeUrl}
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            <BrandLogo markClassName="size-8" showWordmark wordmarkClassName="text-base sm:text-lg" />
          </Link>
        </div>

        {/* Navegação Desktop apenas em >= 1024px (lg:) — Regra 22 */}
        <nav
          className="hidden items-center gap-1.5 text-sm font-medium lg:flex"
          aria-label="Navegação Principal"
        >
          {LANDING_NAV_LINKS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "location" : undefined}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap",
                  isActive
                    ? "border-primary/30 bg-primary/12 text-primary-strong dark:text-primary font-semibold shadow-2xs"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-hover/60",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* CTAs Desktop apenas em >= 1024px (lg:) para evitar colisão em Tablets */}
        <div className="hidden items-center gap-2.5 lg:flex shrink-0">
          {canInstall ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void install()}
              className="gap-1.5 font-medium cursor-pointer"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Instalar App</span>
            </Button>
          ) : null}
          <ThemeToggle />
          {isSubpage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNavigateBack}
              aria-label="Voltar para a página anterior"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar</span>
            </Button>
          ) : isLoggedIn ? (
            <Link
              to="/"
              className={cn(
                buttonVariants({ size: "sm" }),
                "shadow-sm inline-flex items-center gap-1.5",
              )}
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
                className={cn(buttonVariants({ size: "sm" }), "shadow-sm font-medium")}
              >
                Criar conta grátis
              </Link>
            </>
          )}
        </div>

        {/* Gatilho compacto Mobile & Tablet (< lg) */}
        <div className="flex items-center gap-1.5 lg:hidden shrink-0">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={mobileMenuOpen}
            className="min-h-11 min-w-11"
          >
            {mobileMenuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 h-[2px] bg-primary/80 transition-all duration-75 ease-out pointer-events-none"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-label="Progresso de leitura da página"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      </header>

      <div className="h-16 pt-safe box-content shrink-0" aria-hidden="true" />

      <LandingMobileDrawer
        open={mobileMenuOpen}
        isSubpage={isSubpage}
        isLoggedIn={isLoggedIn}
        activeSection={activeSection}
        canInstall={canInstall}
        onClose={() => setMobileMenuOpen(false)}
        onBack={handleNavigateBack}
        onSelectSection={scrollToSection}
        onInstall={() => void install()}
      />
    </>
  );
}
