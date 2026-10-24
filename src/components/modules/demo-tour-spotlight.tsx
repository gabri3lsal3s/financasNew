import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { getTourHandoffDestination, getTourSteps } from "@/domain/demo-simulation";
import {
  endDemo,
  goToNextStep,
  goToPrevStep,
  markTourCompleted,
  useDemoSession,
} from "@/state/demo-mode";

export interface DemoTourSpotlightProps {
  /** Callback opcional acionado quando o usuário avança para o próximo passo. */
  onNextStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário retrocede para o passo anterior. */
  onPrevStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário encerra ou fecha o tour. */
  onClose?: () => void;
  /** Classes extras aplicadas ao contêiner raiz do card popover. */
  className?: string;
}

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

/**
 * Componente de Foco e Apresentação Guiada (DemoTourSpotlight).
 * Renderiza um backdrop escurecido com recorte preciso (spotlight) ao redor
 * do elemento alvo do passo atual, bloqueia ruídos e cliques externos indesejados,
 * e posiciona um card popover adaptativo com saída em 1 clique.
 */
export function DemoTourSpotlight({
  onNextStep,
  onPrevStep,
  onClose,
  className,
}: DemoTourSpotlightProps) {
  const session = useDemoSession();
  const navigate = useNavigate();
  const location = useLocation();

  const { isDemoActive, activeTrack, currentStepIndex } = session;

  const steps = useMemo(
    () => (activeTrack ? getTourSteps(activeTrack) : []),
    [activeTrack],
  );
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const currentStepNumber = currentStepIndex + 1;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && currentStepIndex >= totalSteps - 1;

  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const cardRef = useRef<HTMLDivElement>(null);

  // Encerramento limpo sem fricção
  const handleClose = useCallback(() => {
    triggerSensory("action");
    endDemo();
    onClose?.();
  }, [onClose]);

  // Hand-off direto para o primeiro uso na conta real
  const handleStartRealAccount = useCallback(() => {
    triggerSensory("action");
    if (activeTrack) {
      markTourCompleted(activeTrack);
    }
    endDemo();
    if (onClose) {
      onClose();
    } else {
      const destination = getTourHandoffDestination(activeTrack, location.pathname);
      navigate(destination);
    }
  }, [activeTrack, location.pathname, navigate, onClose]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      triggerSensory("selection");
      const nextIndex = currentStepIndex + 1;
      goToNextStep();
      const nextStep = steps[nextIndex];
      if (nextStep) {
        navigate(nextStep.targetRoute);
      }
      onNextStep?.(nextIndex);
    } else {
      handleStartRealAccount();
    }
  }, [currentStepIndex, handleStartRealAccount, isLastStep, navigate, onNextStep, steps]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      triggerSensory("selection");
      const prevIndex = Math.max(0, currentStepIndex - 1);
      goToPrevStep();
      const prevStep = steps[prevIndex];
      if (prevStep) {
        navigate(prevStep.targetRoute);
      }
      onPrevStep?.(prevIndex);
    }
  }, [currentStepIndex, isFirstStep, navigate, onPrevStep, steps]);

  // Atualização das dimensões e escuta de redimensionamento
  const updateTargetRect = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsMobile(window.innerWidth < 768);

    if (!currentStep?.targetSelector) {
      setRect(null);
      return;
    }

    const element = document.querySelector(currentStep.targetSelector);
    if (!element) {
      setRect(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const padding = currentStep.spotlightPadding ?? 10;

    setRect({
      x: Math.max(0, elementRect.left - padding),
      y: Math.max(0, elementRect.top - padding),
      width: Math.min(window.innerWidth, elementRect.width + padding * 2),
      height: Math.min(window.innerHeight, elementRect.height + padding * 2),
      borderRadius: 14,
    });
  }, [currentStep]);

  // Scroll suave para centralizar o alvo na tela ao trocar de passo
  useEffect(() => {
    if (!isDemoActive || !currentStep?.targetSelector) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const attemptScrollAndMeasure = (attemptsLeft: number) => {
      if (attemptsLeft <= 0) {
        updateTargetRect();
        return;
      }

      const element = document.querySelector(currentStep.targetSelector ?? "");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Pequena pausa para aguardar a rolagem finalizar antes de medir as coordenadas
        timer = setTimeout(updateTargetRect, 200);
      } else {
        timer = setTimeout(() => attemptScrollAndMeasure(attemptsLeft - 1), 100);
      }
    };

    attemptScrollAndMeasure(5);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentStep, isDemoActive, updateTargetRect]);

  // Listener para redimensionamento da janela e rolagem manual
  useEffect(() => {
    if (!isDemoActive) return;

    const handleResizeOrScroll = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleResizeOrScroll, { passive: true });
    window.addEventListener("scroll", handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll);
    };
  }, [isDemoActive, updateTargetRect]);

  // Suporte a atalhos de teclado (Escape para sair, setas para navegar)
  useEffect(() => {
    if (!isDemoActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleNext, handlePrev, isDemoActive]);

  if (!isDemoActive || !activeTrack || !currentStep) {
    return null;
  }

  const trackLabel =
    activeTrack === "finances" ? "Finanças Diárias" : "Investimentos";

  // Posicionamento do card popover no desktop
  const desktopCardStyle = (): React.CSSProperties => {
    if (!rect || typeof window === "undefined") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const cardEstimatedHeight = 220;
    const cardWidth = 380;
    const spaceBelow = window.innerHeight - (rect.y + rect.height);
    const spaceAbove = rect.y;

    let top = rect.y + rect.height + 12;

    if (currentStep.preferredPlacement === "top" && spaceAbove > cardEstimatedHeight + 20) {
      top = Math.max(16, rect.y - cardEstimatedHeight - 12);
    } else if (spaceBelow < cardEstimatedHeight + 20 && spaceAbove > spaceBelow) {
      top = Math.max(16, rect.y - cardEstimatedHeight - 12);
    }

    const left = Math.max(
      16,
      Math.min(rect.x, window.innerWidth - cardWidth - 16),
    );

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
    };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour guiado interativo"
      className="fixed inset-0 z-modal overflow-hidden select-none"
    >
      {/* Máscara SVG recortada com corte iluminado */}
      <svg
        className="fixed inset-0 size-full pointer-events-auto"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <defs>
          <mask id="demo-tour-spotlight-mask">
            {/* Fundo branco: opaco na máscara */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Retângulo preto: fura a máscara deixando o elemento 100% visível */}
            {rect && (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={rect.borderRadius}
                ry={rect.borderRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Camada escurecida sobreposta que absorve os cliques externos */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#demo-tour-spotlight-mask)"
        />

        {/* Borda acentuada suave em volta da área recortada */}
        {rect && (
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={rect.borderRadius}
            ry={rect.borderRadius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="4 2"
            className="animate-pulse"
            opacity="0.9"
          />
        )}
      </svg>

      {/* Card Popover Adaptativo */}
      <aside
        ref={cardRef}
        style={!isMobile ? desktopCardStyle() : undefined}
        className={cn(
          "pointer-events-auto border border-border/80 bg-surface shadow-lg transition-all duration-200",
          isMobile
            ? "fixed inset-x-3 bottom-3 rounded-2xl p-4 max-h-[85vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),12px)]"
            : "fixed rounded-xl p-4.5 z-modal",
          className,
        )}
      >
        {/* Cabeçalho do Card: Badges e Botão [X] de saída imediata */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="default" size="xs" className="gap-1 font-semibold">
              <Sparkles className="size-3" aria-hidden="true" />
              <span>
                Passo {currentStepNumber} de {totalSteps}
              </span>
            </Badge>
            <Badge variant="muted" size="xs" className="text-muted-foreground">
              {trackLabel}
            </Badge>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Encerrar tour demonstrativo"
            title="Encerrar tour (ESC)"
            className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Conteúdo Explicativo */}
        <div className="mt-2.5 space-y-1">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {currentStep.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Rodapé com Navegação e Hand-off */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="h-8 px-2.5 text-xs cursor-pointer gap-1"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Anterior</span>
          </Button>

          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((step, idx) => (
              <span
                key={step.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  idx === currentStepIndex
                    ? "bg-primary w-3.5"
                    : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          {isLastStep ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleStartRealAccount}
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1.5"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Começar Conta Real</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleNext}
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1"
            >
              <span>Próximo</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
