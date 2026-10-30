import { useCallback, useState } from "react";
import { Bell, Shield, Smartphone, Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { isNativePlatform } from "@/services/native/platform";
import { triggerSensory } from "@/services/sensory";
import {
  hasSeenNativeOnboarding,
  markNativeOnboardingSeen,
  startDemo,
} from "@/state/demo-mode";

export interface NativeOnboardingDialogProps {
  /** Controle externo de visibilidade (opcional). Se omitido, deriva de isNativePlatform() && !hasSeenNativeOnboarding(). */
  open?: boolean;
  /** Callback acionado ao alterar o estado de abertura. */
  onOpenChange?: (open: boolean) => void;
  /** Callback acionado quando o usuário aceita e inicia o tour nativo. */
  onStartNativeTour?: () => void;
  /** Força a exibição ignorando localStorage e plataforma (útil para testes unitários ou demonstrações). */
  forceShow?: boolean;
}

/**
 * Diálogo de Onboarding no Primeiro Uso / Instalação do APK Nativo Android.
 * Apresentado quando o aplicativo nativo é inicializado pela primeira vez para sugerir
 * o micro-tour dos recursos nativos (aceleração, captura de notificações bancárias e biometria).
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
    triggerSensory("action");
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
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Depois
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleStartTour}
            className="w-full sm:w-auto gap-2 cursor-pointer font-semibold"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            <span>Fazer Tour Rápido (1 min)</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2" role="group" aria-label="Recursos nativos exclusivos">
        {/* Recurso 1: Desempenho Acelerado */}
        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
          <Smartphone
            className="size-4 shrink-0 text-primary mt-0.5"
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

        {/* Recurso 2: Leitor de Notificações Bancárias */}
        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
          <Bell
            className="size-4 shrink-0 text-positive-strong mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Leitor de Notificações Bancárias
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Detecção automática de compras de cartões e comprovantes Pix sem digitação manual.
            </p>
          </div>
        </div>

        {/* Recurso 3: Biometria e Escudo de Privacidade */}
        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
          <Shield
            className="size-4 shrink-0 text-portfolio mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Biometria & Escudo de Privacidade
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Proteção por impressão digital e ocultação automática de saldos ao alternar de tela.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
