import { useCallback, useState } from "react";
import { Layers, Shield, Smartphone, Sparkles } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { isNativePlatform } from "@/services/native/platform";
import {
  hasSeenNativeOnboarding,
  markNativeOnboardingSeen,
  startDemo,
} from "@/state/demo-mode";

export interface NativeOnboardingDialogProps {
  /** Controle externo de visibilidade (opcional). */
  open?: boolean;
  /** Callback acionado ao alterar o estado de abertura. */
  onOpenChange?: (open: boolean) => void;
  /** Callback acionado quando o usuário aceita e inicia o tour nativo. */
  onStartNativeTour?: () => void;
  /** Força a exibição ignorando localStorage e plataforma. */
  forceShow?: boolean;
}

/**
 * Diálogo de Onboarding no Primeiro Uso / Instalação do APK Nativo Android.
 */
export function NativeOnboardingDialog({
  open,
  onOpenChange,
  onStartNativeTour,
  forceShow = false,
}: NativeOnboardingDialogProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    return isNativePlatform() && !hasSeenNativeOnboarding();
  });

  const isVisible = open !== undefined ? open : internalOpen;

  const handleClose = useCallback(() => {
    markNativeOnboardingSeen();
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleStartTour = useCallback(() => {
    markNativeOnboardingSeen();
    startDemo("app_native_apk");
    setInternalOpen(false);
    onOpenChange?.(false);
    onStartNativeTour?.();
  }, [onOpenChange, onStartNativeTour]);

  if (!isVisible) return null;

  return (
    <Modal
      open={isVisible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          setInternalOpen(true);
          onOpenChange?.(true);
        }
      }}
      title="Bem-vindo ao App Nativo Android"
      description="Seu aplicativo foi instalado com sucesso. Conheça as vantagens exclusivas e aceleração nativa."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Depois
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleStartTour}
            className="gap-2 font-semibold"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            <span>Fazer Tour Rápido (1 min)</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3 py-2" role="group" aria-label="Recursos nativos exclusivos">
        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface p-3 shadow-xs">
          <Smartphone
            className="size-4 shrink-0 text-primary-strong mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Desempenho Acelerado
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Transições instantâneas e rolagem ultra-fluida com aceleração nativa de hardware.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface p-3 shadow-xs">
          <Shield
            className="size-4 shrink-0 text-positive-strong mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Biometria Física &amp; Escudo de Privacidade
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Proteção por impressão digital e ocultação automática de saldos ao alternar de tela.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface p-3 shadow-xs">
          <Layers
            className="size-4 shrink-0 text-portfolio mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Atalhos Rápidos de Sistema
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Lançamentos rápidos direto da grade de aplicativos e compartilhamento de comprovantes.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
