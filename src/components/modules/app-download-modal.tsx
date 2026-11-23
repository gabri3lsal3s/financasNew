import { useState } from "react";
import { Check, Download, Globe, HelpCircle, Smartphone } from "lucide-react";
import { Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import {
  AXIR_APK_DOWNLOAD_URL,
  AXIR_APK_FILENAME,
  shouldOfferAndroidApk,
} from "@/services/native/app-links";
import { isIOSDevice, isStandaloneDisplay } from "@/services/native/platform";
import { cn } from "@/lib/utils";
import { ApkInstallGuideDialog } from "./apk-install-guide-dialog";
import { IosPwaInstallDialog } from "./ios-pwa-install-dialog";

export interface AppDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apkUrl?: string;
}

/**
 * Diálogo unificado para download e instalação do aplicativo.
 *
 * Apresenta:
 * - Aplicativo Web (PWA) — visível quando o usuário ainda não está em modo standalone.
 * - App Android Pro (APK) — ofertado somente em contexto Android elegível.
 */
export function AppDownloadModal({
  open,
  onOpenChange,
  apkUrl = AXIR_APK_DOWNLOAD_URL,
}: AppDownloadModalProps) {
  const { isInstalled, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showApkGuide, setShowApkGuide] = useState(false);

  const isIOS = isIOSDevice();
  const isPwaActive = isInstalled || isStandaloneDisplay();
  const offerAndroidApk = shouldOfferAndroidApk();

  const handleInstallPwa = async () => {
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
    const cleanUrl = apkUrl.trim();
    const isSafeUrl =
      /^https:\/\//i.test(cleanUrl) || (cleanUrl.startsWith("/") && !cleanUrl.startsWith("//"));
    if (!isSafeUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = cleanUrl;
    link.download = AXIR_APK_FILENAME;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onOpenChange(false);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Baixar aplicativo"
        description="Escolha a opção ideal para o seu dispositivo e modo de uso."
        size="md"
        footer={
          <ModalFooter borderless>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3.5 py-1">
          {!isPwaActive && (
            <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground border border-border/80">
                  <Globe className="size-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-border/80">
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

          {offerAndroidApk && (
            <div
              className={cn(
                "rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3",
                isPwaActive && "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground border border-border/80">
                  <Smartphone className="size-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-border/80">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApkGuide(true)}
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
          )}

          {isPwaActive && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground border border-border/80">
              <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Você já está utilizando a versão Web (PWA) instalada neste dispositivo.</span>
            </div>
          )}
        </div>
      </Modal>

      <IosPwaInstallDialog open={showIosGuide} onOpenChange={setShowIosGuide} />

      {offerAndroidApk && (
        <ApkInstallGuideDialog
          open={showApkGuide}
          onOpenChange={setShowApkGuide}
          onDownloadApk={handleDownloadApk}
          apkUrl={apkUrl}
        />
      )}
    </>
  );
}
