import { useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";
import { IosPwaInstallDialog } from "@/components/modules/ios-pwa-install-dialog";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { isNativePlatform } from "@/services/native/platform";

export interface PublicPwaShortcutCardProps {
  /** Título exibido no card de atalho PWA. */
  title: string;
  /** Descrição contextual exibida abaixo do título. */
  description: string;
}

/**
 * Cartão compartilhado de atalho PWA para links públicos (/orcamento-familiar/:token e /meta/:token).
 *
 * Só renderiza em ambientes Web elegíveis para instalação real (`canInstall || isIOS`)
 * enquanto o app não estiver instalado (`!isInstalled` e `!isNativePlatform()`), evitando
 * exibir botões inoperantes em navegadores Desktop sem suporte ao prompt (M10).
 */
export function PublicPwaShortcutCard({ title, description }: PublicPwaShortcutCardProps) {
  const { canInstall, isIOS, isInstalled, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled || isNativePlatform() || (!canInstall && !isIOS)) {
    return null;
  }

  const handlePwaAction = () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    void install();
  };

  return (
    <>
      <section aria-label="Fixar atalho na tela inicial">
        <div className="rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="size-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5 min-w-0">
              <span className="text-sm font-semibold text-foreground block">{title}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePwaAction}
            className="gap-2 shrink-0 w-full sm:w-auto font-semibold text-xs"
          >
            {isIOS ? (
              <>
                <Share className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Como fixar no iPhone</span>
              </>
            ) : (
              <>
                <Download className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Adicionar à Tela Inicial</span>
              </>
            )}
          </Button>
        </div>
      </section>

      <IosPwaInstallDialog open={showIosGuide} onOpenChange={setShowIosGuide} />
    </>
  );
}
