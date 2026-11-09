import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink, Smartphone } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { isNativePlatform } from "@/services/native/platform";
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

/**
 * SharedLinkHeaderNav — Cabeçalho inteligente, padronizado e responsivo para páginas públicas.
 *
 * Características:
 * 1. Barra de navegação sticky com backdrop-blur suave e distribuição desktop limpa;
 * 2. Alternador de temas integrado (Claro / Escuro / OLED / Sistema) para todos os visitantes;
 * 3. Deep link nativo ergonômico no mobile ("Abrir no App") e atalho ao painel quando logado;
 * 4. Botão "Voltar ao Início" quando instalado como PWA ou App Nativo.
 */
export function SharedLinkHeaderNav({
  badgeLabel = "Compartilhamento",
  targetPath = "",
  maxWidth = "5xl",
}: SharedLinkHeaderNavProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [appOpenAttempted, setAppOpenAttempted] = useState(false);

  const isStandalone = isStandaloneMode();
  const isNative = isNativePlatform();
  const isAppShell = isStandalone || isNative;

  const handleOpenInApp = useCallback(() => {
    setAppOpenAttempted(true);
    const cleanPath = targetPath.replace(/^\/+/, "");
    const nativeUri = `com.guiafinanceiro.app://${cleanPath}`;

    window.location.href = nativeUri;

    setTimeout(() => {
      setAppOpenAttempted(false);
    }, 1500);
  }, [targetPath]);

  const maxWidthClass =
    maxWidth === "md"
      ? "max-w-md"
      : maxWidth === "2xl"
      ? "max-w-2xl"
      : maxWidth === "3xl"
      ? "max-w-3xl"
      : maxWidth === "full"
      ? "w-full"
      : "max-w-5xl";

  return (
    <header className="sticky top-0 z-30 w-full bg-surface/90 backdrop-blur-md border-b border-border/80 transition-colors pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))]">
      <div className={cn("mx-auto px-4 sm:px-6 md:px-8 h-14 flex items-center justify-between gap-3", maxWidthClass)}>
        {/* Lado Esquerdo: Logo / Voltar + Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {isAppShell ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => navigate("/")}
              className="gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline font-medium">Voltar ao Início</span>
              <span className="sm:hidden font-medium">Início</span>
            </Button>
          ) : (
            <Link
              to={session?.user ? "/" : "/apresentacao"}
              className="inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg shrink-0"
              aria-label="Ir para a página inicial do Áxis Finance"
            >
              <BrandLogo
                showWordmark
                showSubtitle={false}
                markClassName="size-7"
                wordmarkClassName="text-sm font-bold tracking-tight hidden xs:inline"
              />
            </Link>
          )}

          <Badge
            variant="muted"
            size="xs"
            className="shrink-0 font-medium truncate max-w-[110px] xs:max-w-[160px] sm:max-w-none text-[11px]"
            title={badgeLabel}
          >
            {badgeLabel}
          </Badge>
        </div>

        {/* Lado Direito: Ações Contextuais + ThemeToggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isAppShell && targetPath ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleOpenInApp}
              className="gap-1.5 h-8 px-2 sm:px-2.5 text-xs text-primary-strong border-primary/30 hover:bg-primary/5 cursor-pointer shrink-0"
              title="Abrir no aplicativo instalado no dispositivo"
              aria-label="Abrir no aplicativo instalado no dispositivo"
            >
              <Smartphone className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{appOpenAttempted ? "Abrindo…" : "Abrir no App"}</span>
              <span className="sm:hidden">{appOpenAttempted ? "…" : "App"}</span>
            </Button>
          ) : null}

          {!isAppShell && session?.user ? (
            <Link to="/" className="shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                title="Acessar Meu Painel"
                aria-label="Acessar Meu Painel"
              >
                <span className="hidden sm:inline">Meu Painel</span>
                <span className="sm:hidden text-xs">Painel</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Button>
            </Link>
          ) : null}

          <ThemeToggle className="size-8 shrink-0 rounded-lg border border-border/60 hover:bg-surface-hover text-muted-foreground hover:text-foreground" />
        </div>
      </div>
    </header>
  );
}
