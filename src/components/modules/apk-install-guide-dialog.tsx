import { useState } from "react";
import {
  ShieldAlert,
  Settings,
  ShieldCheck,
  Download,
  Globe,
  Sparkles,
  Check,
} from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ApkInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Callback disparado quando o usuário opta por baixar o arquivo APK.
   */
  onDownloadApk?: () => void;
  /**
   * Callback opcional disparado quando o usuário opta por continuar pelo PWA.
   */
  onSelectPwa?: () => void;
  /**
   * URL do APK caso o diálogo deva acionar o download diretamente.
   */
  apkUrl?: string;
}

const APK_INSTALL_STEPS = [
  {
    step: 1,
    icon: ShieldAlert,
    title: "Aviso 'Arquivo pode ser nocivo'",
    badge: "Alerta padrão Android",
    description:
      "Ao iniciar o download, seu navegador exibirá um alerta padrão do Android para qualquer arquivo baixado fora da Play Store. Toque em 'Fazer o download mesmo assim'.",
  },
  {
    step: 2,
    icon: Settings,
    title: "Permitir desta fonte",
    badge: "Configuração rápida",
    description:
      "Ao abrir o instalador baixado, o Android pode solicitar permissão para instalar fontes desconhecidas. Toque em 'Configurações' e ative 'Permitir desta fonte'.",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Verificação e Conclusão",
    badge: "100% Verificado",
    description:
      "Caso o Google Play Protect exiba uma mensagem de verificação, selecione 'Mais detalhes' e em seguida 'Instalar assim mesmo'. Em aparelhos Samsung Galaxy com One UI 6+, se o botão estiver bloqueado, desative temporariamente o 'Bloqueador Automático' em Configurações > Segurança.",
  },
] as const;


/**
 * Diálogo interativo de orientação passo a passo para instalação do APK Beta do Android.
 * Orienta o usuário sobre os alertas rotineiros do sistema operacional Android
 * e oferece saída imediata para utilizar o produto universal via PWA (sem downloads).
 */
export function ApkInstallGuideDialog({
  open,
  onOpenChange,
  onDownloadApk,
  onSelectPwa,
  apkUrl = "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk",
}: ApkInstallGuideDialogProps) {
  const [showPwaInstructions, setShowPwaInstructions] = useState(false);

  const handleDownload = () => {
    if (onDownloadApk) {
      onDownloadApk();
    } else if (apkUrl) {
      const link = document.createElement("a");
      link.href = apkUrl;
      link.download = "axis-pro.apk";
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
    if (onSelectPwa) {
      onSelectPwa();
    }
  };

  const handleClose = () => {
    setShowPwaInstructions(false);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title={showPwaInstructions ? "Usar no Navegador (PWA)" : "Instalação do Aplicativo Android (Beta)"}
      description={
        showPwaInstructions
          ? "Você tem acesso completo a todas as funções de controle financeiro e aportes sem precisar baixar nenhum arquivo."
          : "Como nosso app possui automação de segundo plano e zero taxas de intermediários, o download é feito diretamente por aqui."
      }
      size="md"
      footer={
        showPwaInstructions ? (
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPwaInstructions(false)}
              className="w-full sm:w-auto"
            >
              Voltar ao guia do APK
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              Entendi, vou usar no navegador
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleChoosePwa}
              className="w-full sm:w-auto gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Prefiro usar no navegador (PWA)</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="w-full sm:w-auto gap-2"
            >
              <Download className="size-4 shrink-0" aria-hidden="true" />
              <span>Baixar APK (Beta)</span>
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 py-1">
        {showPwaInstructions ? (
          /* Visual de instruções de PWA imediato */
          <div className="space-y-3.5">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-foreground">
                  Experiência 100% Funcional no PWA
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                O PWA do Áxis roda direto no seu navegador com carregamento instantâneo, funciona em qualquer smartphone (iOS ou Android) e computador, sem ocupar armazenamento do seu celular.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-bold text-foreground">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground">Abra o menu do navegador</div>
                  <p>No Chrome, toque no menu de três pontos no canto superior direito.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-bold text-foreground">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground">Instalar ou Adicionar à Tela Inicial</div>
                  <p>Selecione &quot;Instalar aplicativo&quot; ou &quot;Adicionar à tela inicial&quot;.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-bold text-foreground">
                  3
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground">Pronto para usar</div>
                  <p>Um ícone será criado na sua grade de apps, abrindo em tela cheia sem barras de navegação.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Visual do Guia de 3 Passos do APK */
          <div className="space-y-3.5">
            {/* Header explicativo do Beta */}
            <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                O APK Android é uma versão beta opcional voltada a usuários que desejam a leitura passiva em segundo plano de notificações bancárias.
              </span>
            </div>

            {/* Lista dos 3 passos */}
            <div className="space-y-2.5">
              {APK_INSTALL_STEPS.map(({ step, icon: Icon, title, badge, description }) => (
                <div
                  key={step}
                  className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-hover text-muted-foreground">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex size-4 items-center justify-center rounded-full bg-surface-hover text-[10px] font-bold text-foreground">
                          {step}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                          {title}
                        </h4>
                      </div>
                      <Badge variant="muted" size="xs">
                        {badge}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Garantia de segurança e assinatura */}
            <div className="flex items-center gap-2 rounded-xl border border-positive/20 bg-positive/5 px-3 py-2 text-xs text-positive-strong">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Assinatura SHA-256 oficial e livre de malwares ou rastreadores terceiros.</span>
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
