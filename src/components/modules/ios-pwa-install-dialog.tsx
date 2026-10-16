import { Share, PlusSquare, Check, Smartphone } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";

export interface IosPwaInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INSTALL_STEPS = [
  {
    step: 1,
    icon: Share,
    title: "Toque em Compartilhar",
    description: "No Safari do seu iPhone ou iPad, toque no botão de compartilhamento na barra de navegação.",
  },
  {
    step: 2,
    icon: PlusSquare,
    title: "Adicionar à Tela de Início",
    description: "Role a folha de opções para baixo e selecione a opção 'Adicionar à Tela de Início'.",
  },
  {
    step: 3,
    icon: Check,
    title: "Confirme em 'Adicionar'",
    description: "No canto superior direito da confirmação, toque em 'Adicionar' para fixar o ícone na sua tela de aplicativos.",
  },
] as const;

/**
 * Diálogo passo a passo de orientação de instalação do PWA no iOS (Safari/WebKit).
 * Como o iOS não dispara `beforeinstallprompt`, este modal instrui o usuário
 * sobre o fluxo manual padrão do sistema Apple.
 */
export function IosPwaInstallDialog({ open, onOpenChange }: IosPwaInstallDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Instalar no iPhone ou iPad"
      description="Adicione o aplicativo à tela de início para desfrutar da experiência em tela cheia e acesso instantâneo."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end">
          <Button
            type="button"
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Entendi
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Lista de passos visuais */}
        <div className="space-y-3">
          {INSTALL_STEPS.map(({ step, icon: Icon, title, description }) => (
            <div
              key={step}
              className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-surface-hover text-[11px] font-bold text-foreground">
                    {step}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Card informativo de benefícios */}
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-primary-strong" aria-hidden="true" />
          <span>
            Após a instalação, o aplicativo abrirá como um app nativo, sem barras de endereço do navegador e com carregamento instantâneo.
          </span>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
