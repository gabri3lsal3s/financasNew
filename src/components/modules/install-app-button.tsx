import { useState } from "react";
import { Download, Share } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IosPwaInstallDialog } from "./ios-pwa-install-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface InstallAppButtonProps {
  /**
   * Estilo de apresentação do componente:
   * - 'banner': Cartão fluido padrão usado no menu 'Mais' (padrão).
   * - 'card': Card estruturado canônico do Design System para abas de configuração.
   * - 'button': Botão compacto para cabeçalhos ou barras de ferramentas.
   */
  variant?: "banner" | "card" | "button";
  className?: string;
}

/**
 * Componente unificado de instalação PWA.
 *
 * Suporta tanto o prompt nativo de navegadores Chromium (beforeinstallprompt)
 * quanto o fluxo guiado passo a passo para dispositivos Apple iOS (Safari).
 * Se o app já estiver instalado em modo standalone ou estiver rodando
 * como app nativo (Capacitor), oculta-se graciosamente.
 */
export function InstallAppButton({ variant = "banner", className }: InstallAppButtonProps) {
  const { canInstall, isIOS, isInstalled, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Se o app já estiver instalado ou a plataforma não permitir instalação
  if (!canInstall && !isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    void install();
  };

  const Icon = isIOS ? Share : Download;
  const actionLabel = isIOS ? "Como instalar no iOS" : "Instalar app";
  const descriptionText = isIOS
    ? "Veja as instruções para adicionar à tela de início no Safari"
    : "Adicione à tela inicial para acesso rápido e em tela cheia";

  return (
    <>
      {variant === "banner" && (
        <section aria-label="Instalação do aplicativo" className={cn("pt-2", className)}>
          <button
            type="button"
            onClick={handleClick}
            aria-label="Instalar app"
            className="group flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15 text-primary-strong transition-colors group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {actionLabel}
                </div>
                <p className="text-xs text-muted-foreground">
                  {descriptionText}
                </p>
              </div>
            </div>
          </button>
        </section>
      )}

      {variant === "card" && (
        <Card className={className}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Aplicativo Web Instalável (PWA)</span>
              </span>
              <Badge variant={isInstalled ? "positive" : "default"} size="sm">
                {isInstalled ? "Instalado" : "Disponível"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {isInstalled
                ? "O aplicativo já está instalado e operando em tela cheia neste dispositivo, com carregamento instantâneo do App Shell."
                : "Instale o aplicativo no seu celular ou computador para ter acesso instantâneo sem barras do navegador, ícone próprio e navegação imersiva."}
            </p>

            {!isInstalled && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-surface-hover/40 p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    {isIOS ? "Instalação no iPhone ou iPad" : "Instalação Direta"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isIOS
                      ? "Guia ilustrado passo a passo para o Safari"
                      : "Instalação instantânea em um clique"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleClick}
                  className="gap-2 shrink-0"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{actionLabel}</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {variant === "button" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          className={cn("gap-2", className)}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span>{actionLabel}</span>
        </Button>
      )}

      {/* Diálogo ilustrado passo a passo no iOS Safari */}
      <IosPwaInstallDialog open={showIosGuide} onOpenChange={setShowIosGuide} />
    </>
  );
}
