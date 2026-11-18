import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink, Smartphone } from "lucide-react";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { buildAppDeepLink } from "@/services/native/app-links";
import { isMobileDevice, isNativePlatform } from "@/services/native/platform";
import { isStandaloneMode } from "@/app/pwa";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface SharedLinkHeaderNavProps {
  /** Rótulo da badge do tipo de link compartilhado (ex: "Modo Viagem", "Racha de Conta", "Meta Coletiva") */
  badgeLabel?: string;
  /** Caminho relativo da rota para deep link nativo (ex: "viagem/abc123xyz") */
  targetPath?: string;
  /** Largura máxima do conteúdo do header (default: "5xl") */
  maxWidth?: "md" | "2xl" | "3xl" | "5xl" | "full";
}

const MAX_WIDTH_CLASS: Record<NonNullable<SharedLinkHeaderNavProps["maxWidth"]>, string> = {
  md: "max-w-md",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  full: "w-full",
};

/**
 * SharedLinkHeaderNav — Cabeçalho institucional e responsivo para páginas públicas.
 *
 * - Sticky header com `z-sticky` e `.pt-safe`;
 * - Alternador de tema integrado;
 * - Botão "Abrir no App" (scheme `axir://`) exibido exclusivamente em dispositivos móveis web;
 * - Atalho direto ao painel quando o usuário já está autenticado.
 */
export function SharedLinkHeaderNav({
  badgeLabel = "Compartilhamento",
  targetPath = "",
  maxWidth = "5xl",
}: SharedLinkHeaderNavProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [appOpenAttempted, setAppOpenAttempted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStandalone = isStandaloneMode();
  const isNative = isNativePlatform();
  const isAppShell = isStandalone || isNative;
  const showOpenInApp = !isAppShell && Boolean(targetPath) && isMobileDevice();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleOpenInApp = useCallback(() => {
    setAppOpenAttempted(true);
    window.location.href = buildAppDeepLink(targetPath);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAppOpenAttempted(false);
    }, 1500);
  }, [targetPath]);

  return (
    <header className="sticky top-0 z-sticky w-full bg-surface/90 backdrop-blur-md border-b border-border/80 transition-colors pt-safe">
      <div
        className={cn(
          "mx-auto px-4 sm:px-6 md:px-8 h-14 flex items-center justify-between gap-2 sm:gap-3 min-w-0",
          MAX_WIDTH_CLASS[maxWidth],
        )}
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {isAppShell ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent="selection"
              onClick={() => navigate("/")}
              className="gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline font-medium">Voltar ao Início</span>
              <span className="sm:hidden font-medium">Início</span>
            </Button>
          ) : (
            <Link
              to={session?.user ? "/" : "/apresentacao"}
              className="inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg shrink-0 min-h-11 sm:min-h-0"
              aria-label="Ir para a página inicial do Axir"
            >
              <BrandLogo
                showWordmark
                showSubtitle={false}
                markClassName="size-7"
                wordmarkClassName="text-sm font-bold tracking-tight hidden sm:inline"
              />
            </Link>
          )}

          <Badge
            variant="muted"
            size="xs"
            className="shrink-0 font-medium truncate max-w-[140px] sm:max-w-none text-[11px]"
            title={badgeLabel}
          >
            {badgeLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showOpenInApp ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleOpenInApp}
              className="gap-1.5 h-8 px-2 sm:px-2.5 text-xs text-primary-strong border-primary/30 hover:bg-primary/5 shrink-0"
              title="Abrir no aplicativo instalado no dispositivo"
              aria-label="Abrir no aplicativo instalado no dispositivo"
            >
              <Smartphone className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{appOpenAttempted ? "Abrindo…" : "Abrir no App"}</span>
              <span className="sm:hidden">{appOpenAttempted ? "…" : "App"}</span>
            </Button>
          ) : null}

          {!isAppShell && session?.user ? (
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0",
              )}
              title="Acessar Meu Painel"
              aria-label="Acessar Meu Painel"
            >
              <span className="hidden sm:inline">Meu Painel</span>
              <span className="sm:hidden text-xs">Painel</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}

          <ThemeToggle className="rounded-lg border border-border/80 hover:bg-surface-hover" />
        </div>
      </div>
    </header>
  );
}
