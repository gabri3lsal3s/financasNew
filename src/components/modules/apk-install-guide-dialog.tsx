import { useState } from "react";
import { Download, Globe } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { AXIR_APK_DOWNLOAD_URL, AXIR_APK_FILENAME } from "@/services/native/app-links";
import { ApkGuideStepsContent, PwaGuideStepsContent } from "./apk-install-guide-steps";

export interface ApkInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback disparado quando o usuário opta por baixar o arquivo APK. */
  onDownloadApk?: () => void;
  /** Callback opcional disparado quando o usuário opta por continuar pelo PWA. */
  onSelectPwa?: () => void;
  /** URL do APK caso o diálogo deva acionar o download diretamente. */
  apkUrl?: string;
}

/**
 * Diálogo interativo de orientação passo a passo para instalação do APK Beta do Android.
 */
export function ApkInstallGuideDialog({
  open,
  onOpenChange,
  onDownloadApk,
  onSelectPwa,
  apkUrl = AXIR_APK_DOWNLOAD_URL,
}: ApkInstallGuideDialogProps) {
  const [showPwaInstructions, setShowPwaInstructions] = useState(false);

  const handleDownload = () => {
    if (onDownloadApk) {
      onDownloadApk();
    } else if (apkUrl) {
      const link = document.createElement("a");
      link.href = apkUrl;
      link.download = AXIR_APK_FILENAME;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    onOpenChange(false);
  };

  const handleChoosePwa = () => {
    setShowPwaInstructions(true);
    onSelectPwa?.();
  };

  const handleClose = (nextOpen = false) => {
    if (!nextOpen) setShowPwaInstructions(false);
    onOpenChange(nextOpen);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title={
        showPwaInstructions
          ? "Usar no Navegador (PWA)"
          : "Instalação do Aplicativo Android (Beta)"
      }
      description={
        showPwaInstructions
          ? "Você tem acesso completo a todas as funções de controle financeiro e aportes sem precisar baixar nenhum arquivo."
          : "Como nosso app possui automação de segundo plano e zero taxas de intermediários, o download é feito diretamente por aqui."
      }
      size="md"
      footer={
        showPwaInstructions ? (
          <ModalFooter borderless>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPwaInstructions(false)}
            >
              Voltar ao guia do APK
            </Button>
            <Button type="button" variant="default" size="sm" onClick={() => handleClose(false)}>
              Entendi, vou usar no navegador
            </Button>
          </ModalFooter>
        ) : (
          <ModalFooter borderless>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleChoosePwa}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Prefiro usar no navegador (PWA)</span>
            </Button>

            <Button type="button" variant="default" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="size-4 shrink-0" aria-hidden="true" />
              <span>Baixar APK (Beta)</span>
            </Button>
          </ModalFooter>
        )
      }
    >
      <div className="py-1">
        {showPwaInstructions ? <PwaGuideStepsContent /> : <ApkGuideStepsContent />}
      </div>
    </Modal>
  );
}
