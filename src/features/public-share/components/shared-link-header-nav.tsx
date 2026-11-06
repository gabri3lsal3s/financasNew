import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ExternalLink, Smartphone } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout";
import { isNativePlatform } from "@/services/native/platform";
import { isStandaloneMode } from "@/app/pwa";
import { useAuth } from "@/hooks/use-auth";

export interface SharedLinkHeaderNavProps {
  /** Rótulo da badge do tipo de link compartilhado (ex: "Racha de Conta", "Meta Coletiva", "Orçamento Familiar") */
  badgeLabel?: string;
  /** Caminho relativo da rota para deep link nativo (ex: "r/abc123xyz") */
  targetPath?: string;
}

/**
 * SharedLinkHeaderNav — Cabeçalho inteligente e unificado para links compartilhados.
 *
 * 1. Em PWA instalado ou App Nativo (APK):
 *    Oferece botão ergonômico [← Voltar ao Início] para sair do racha/meta e
 *    retornar confortavelmente ao painel principal do app sem fechar a aplicação.
 *
 * 2. No Navegador Web comum:
 *    - Se autenticado: botão [Meu Painel] para acesso rápido.
 *    - Se no mobile/desktop: botão [Abrir no App] disparando o intent nativo
 *      (com.guiafinanceiro.app://...) com fallback suave.
 */
export function SharedLinkHeaderNav({
  badgeLabel = "Compartilhamento",
  targetPath = "",
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

    // Dispara a tentativa de abertura pelo esquema customizado
    window.location.href = nativeUri;

    // Se em 1.5s a janela continuar visível, o app provavelmente não está instalado
    setTimeout(() => {
      setAppOpenAttempted(false);
    }, 1500);
  }, [targetPath]);

  return (
    <header className="flex items-center justify-between gap-3 pb-2 pt-1 border-b border-border/40">
      <div className="flex items-center gap-2.5 min-w-0">
        {isAppShell ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => navigate("/")}
            className="gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden xs:inline">Voltar ao Início</span>
          </Button>
        ) : (
          <Link
            to={session?.user ? "/" : "/apresentacao"}
            className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg shrink-0"
            aria-label="Ir para a página inicial do Áxis Finance"
          >
            <BrandLogo showWordmark showSubtitle={false} />
          </Link>
        )}

        <Badge variant="muted" size="xs" className="shrink-0">
          {badgeLabel}
        </Badge>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isAppShell && targetPath ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpenInApp}
            className="gap-1.5 h-7 px-2.5 text-xs text-primary-strong border-primary/30 hover:bg-primary/5"
            title="Abrir no aplicativo instalado no dispositivo"
          >
            <Smartphone className="size-3" aria-hidden="true" />
            <span>{appOpenAttempted ? "Abrindo…" : "Abrir no App"}</span>
          </Button>
        ) : null}

        {!isAppShell && session?.user ? (
          <Link to="/">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Meu Painel</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </Button>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
