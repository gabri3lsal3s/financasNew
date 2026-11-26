import { createPortal } from "react-dom";
import { Link } from "react-router";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { LANDING_NAV_LINKS } from "./landing-nav-links";

export interface LandingMobileDrawerProps {
  open: boolean;
  isSubpage: boolean;
  isLoggedIn: boolean;
  activeSection: string;
  canInstall: boolean;
  onClose: () => void;
  onBack: () => void;
  onSelectSection: (id: string) => void;
  onInstall: () => void;
}

export function LandingMobileDrawer({
  open,
  isSubpage,
  isLoggedIn,
  activeSection,
  canInstall,
  onClose,
  onBack,
  onSelectSection,
  onInstall,
}: LandingMobileDrawerProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 top-[calc(4rem+max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] bg-background/75 backdrop-blur-xs z-40 lg:hidden animate-fade-in cursor-pointer touch-none"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Menu principal"
        data-mobile-menu="open"
        className="fixed inset-x-0 top-[calc(4rem+max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] z-40 max-h-[calc(100dvh-4rem-max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] overflow-y-auto overscroll-contain border-b border-border bg-background p-4 shadow-xl lg:hidden animate-fade-slide-in"
      >
        <nav className="flex flex-col gap-1.5 text-sm font-medium" aria-label="Menu móvel">
          {isSubpage ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onBack();
              }}
              className="flex items-center gap-2 min-h-11 py-2 px-3 rounded-lg text-left text-muted-foreground hover:text-foreground cursor-pointer font-semibold border-b border-border/60 pb-2.5 mb-1"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Voltar à Apresentação</span>
            </button>
          ) : null}

          {LANDING_NAV_LINKS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "location" : undefined}
                onClick={() => onSelectSection(item.id)}
                className={cn(
                  "flex items-center py-2.5 px-3 min-h-11 rounded-lg border text-left transition-colors cursor-pointer",
                  isActive
                    ? "border-primary/30 bg-primary/12 text-primary-strong dark:text-primary font-semibold"
                    : "border-transparent text-foreground hover:text-primary-strong hover:bg-surface-hover/60",
                )}
              >
                {item.mobileLabel}
              </button>
            );
          })}

          <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-border">
            {isLoggedIn ? (
              <Link
                to="/"
                className={cn(buttonVariants(), "w-full justify-center min-h-11")}
                onClick={onClose}
              >
                Acessar meu App
              </Link>
            ) : (
              <>
                <Link
                  to="/cadastro"
                  className={cn(buttonVariants(), "w-full justify-center gap-1.5 shadow-sm min-h-11")}
                  onClick={onClose}
                >
                  Criar conta gratuita
                </Link>
                <Link
                  to="/entrar"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full justify-center text-sm font-medium text-foreground hover:text-primary min-h-11",
                  )}
                  onClick={onClose}
                >
                  Já tenho conta · Entrar
                </Link>
              </>
            )}

            {canInstall ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onInstall();
                }}
                className="w-full justify-center gap-1.5 cursor-pointer mt-1 min-h-11"
              >
                <Download className="size-4" aria-hidden="true" />
                <span>Instalar Aplicativo no Dispositivo</span>
              </Button>
            ) : null}
          </div>
        </nav>
      </div>
    </>,
    document.body,
  );
}
