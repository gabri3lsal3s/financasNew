import { useState } from "react";
import { Download, Globe, Smartphone, HelpCircle, Check } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { isIOSDevice, isStandaloneDisplay } from "@/services/native/platform";
import { triggerSensory } from "@/services/sensory";
import { IosPwaInstallDialog } from "./ios-pwa-install-dialog";
import { ApkInstallGuideDialog } from "./apk-install-guide-dialog";
import { cn } from "@/lib/utils";

const DEFAULT_APK_URL =
  "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk";

export interface AppDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apkUrl?: string;
}

/**
 * Diálogo unificado para download e instalação do aplicativo.
 *
 * Apresenta:
 * - Opção 1: Aplicativo Web (PWA) — visível somente se o usuário ainda não estiver
 *   utilizando o PWA no dispositivo.
 * - Opção 2: App Android Pro (APK) — com download direto do pacote e guia de instalação.
 */
export function AppDownloadModal({
  open,
  onOpenChange,
  apkUrl = DEFAULT_APK_URL,
}: AppDownloadModalProps) {
  const { isInstalled, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showApkGuide, setShowApkGuide] = useState(false);

  const isIOS = isIOSDevice();
  const isPwaActive = isInstalled || isStandaloneDisplay();

  const handleInstallPwa = async () => {
    triggerSensory("action");
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    try {
      await install();
      onOpenChange(false);
    } catch {
      // Falha silenciosa caso o usuário cancele o prompt do navegador
    }
  };

  const handleDownloadApk = () => {
    triggerSensory("action");
    const link = document.createElement("a");
    link.href = apkUrl;
    link.download = "axir-pro.apk";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onOpenChange(false);
  };

  const handleOpenApkGuide = () => {
    triggerSensory("action");
    setShowApkGuide(true);
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Baixar aplicativo"
        description="Escolha a opção ideal para o seu dispositivo e modo de uso."
        size="md"
        footer={
          <div className="flex w-full justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 py-1">
          {/* Opção 1: Aplicativo Web (PWA) — exibido somente se o usuário NÃO estiver já no PWA */}
          {!isPwaActive && (
            <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground border border-border/60">
                    <Globe className="size-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        Aplicativo Web (PWA)
                      </h4>
                      <Badge variant="default" size="xs">
                        Sem download
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Adicione à tela inicial direto pelo navegador. Ocupa zero
                      espaço de armazenamento, abre em tela cheia e atualiza
                      automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-1 border-t border-border/50">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleInstallPwa}
                  className="w-full sm:w-auto gap-1.5"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>{isIOS ? "Como instalar no iOS" : "Instalar App Web"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Opção 2: App Android Pro (APK) */}
          <div
            className={cn(
              "rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3",
              isPwaActive && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground border border-border/60">
                  <Smartphone className="size-4.5" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      App Android Pro (APK)
                    </h4>
                    <Badge variant="muted" size="xs">
                      Android
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Aplicativo com leitura automática de notificações bancárias (Pix
                    e cartões) em segundo plano, biometria e escudo de privacidade.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-1 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenApkGuide}
                className="w-full sm:w-auto gap-1.5"
              >
                <HelpCircle className="size-3.5" aria-hidden="true" />
                <span>Como instalar</span>
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleDownloadApk}
                className="w-full sm:w-auto gap-1.5"
              >
                <Download className="size-3.5" aria-hidden="true" />
                <span>Baixar APK</span>
              </Button>
            </div>
          </div>

          {/* Nota informativa quando o usuário já estiver navegando pelo PWA */}
          {isPwaActive && (
            <div className="flex items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-[11px] text-muted-foreground border border-border/60">
              <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Você já está utilizando a versão Web (PWA) instalada neste dispositivo.</span>
            </div>
          )}
        </div>
      </ResponsiveDialog>

      {/* Diálogos secundários de instrução */}
      <IosPwaInstallDialog
        open={showIosGuide}
        onOpenChange={setShowIosGuide}
      />

      <ApkInstallGuideDialog
        open={showApkGuide}
        onOpenChange={setShowApkGuide}
        onDownloadApk={handleDownloadApk}
        apkUrl={apkUrl}
      />
    </>
  );
}
