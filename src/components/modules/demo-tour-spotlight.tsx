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
  setStepIndex,
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
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number>(220);
  const [prevStepIndex, setPrevStepIndex] = useState<number>(currentStepIndex);
  const [isPulsing, setIsPulsing] = useState<boolean>(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Captura e armazena o elemento com foco antes de abrir o tour (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    if (!isDemoActive) {
      previousActiveElementRef.current = null;
      return;
    }

    if (typeof document !== "undefined" && !previousActiveElementRef.current) {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        previousActiveElementRef.current = document.activeElement;
      }
    }
  }, [isDemoActive]);

  // Foca automaticamente o primeiro botão interativo ao montar o passo (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    if (!isDemoActive || !cardRef.current) return;

    const focusables = cardRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length > 0) {
      focusables[0]?.focus();
    }
  }, [currentStep?.id, isDemoActive]);

  // Restaura o foco para o elemento original ao sair do tour (Fase 4 — Tarefa 4.1)
  const restoreFocus = useCallback(() => {
    if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
      if (previousActiveElementRef.current.isConnected) {
        previousActiveElementRef.current.focus();
      }
      previousActiveElementRef.current = null;
    }
  }, []);

  // Garante a restauração do foco caso o componente seja desmontado (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    return () => {
      restoreFocus();
    };
  }, [restoreFocus]);

  // Reinicia o pulso ao trocar de etapa durante o render (padrão oficial React para ajuste de estado por prop/store)
  if (prevStepIndex !== currentStepIndex) {
    setPrevStepIndex(currentStepIndex);
    setIsPulsing(true);
  }

  // Animação de pulso da borda cessa suavemente após 3 segundos (Fase 3 — Tarefa 3.3)
  useEffect(() => {
    const pulseTimer = setTimeout(() => {
      setIsPulsing(false);
    }, 3000);

    return () => clearTimeout(pulseTimer);
  }, [currentStepIndex]);

  // Monitora a altura real do card popover no desktop (Fase 2 — Tarefa 2.5)
  useEffect(() => {
    if (!cardRef.current) return;
    if (cardRef.current.offsetHeight > 0) {
      setMeasuredCardHeight(cardRef.current.offsetHeight);
    }
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (height > 0) {
          setMeasuredCardHeight(height);
        } else if (cardRef.current && cardRef.current.offsetHeight > 0) {
          setMeasuredCardHeight(cardRef.current.offsetHeight);
        }
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [currentStep?.id]);

  // Encerramento limpo sem fricção com restauração de foco (Fase 4 — Tarefa 4.1)
  const handleClose = useCallback(() => {
    triggerSensory("action");
    restoreFocus();
    endDemo();
    onClose?.();
  }, [onClose, restoreFocus]);

  // Hand-off direto para o primeiro uso na conta real com restauração de foco (Fase 4 — Tarefa 4.1)
  const handleStartRealAccount = useCallback(() => {
    triggerSensory("action");
    restoreFocus();
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
  }, [activeTrack, location.pathname, navigate, onClose, restoreFocus]);

  const currentRoute = `${location.pathname}${location.search}`;
  const previousRouteRef = useRef<string>(currentRoute);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      triggerSensory("selection");
      const nextIndex = currentStepIndex + 1;
      goToNextStep();
      const nextStep = steps[nextIndex];
      if (nextStep) {
        if (nextStep.targetRoute !== currentStep?.targetRoute) {
          const container = document.getElementById("main-content");
          if (container) {
            container.scrollTop = 0;
          }
        }
        navigate(nextStep.targetRoute);
      }
      onNextStep?.(nextIndex);
    } else {
      handleStartRealAccount();
    }
  }, [currentStep?.targetRoute, currentStepIndex, handleStartRealAccount, isLastStep, navigate, onNextStep, steps]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      triggerSensory("selection");
      const prevIndex = Math.max(0, currentStepIndex - 1);
      goToPrevStep();
      const prevStep = steps[prevIndex];
      if (prevStep) {
        if (prevStep.targetRoute !== currentStep?.targetRoute) {
          const container = document.getElementById("main-content");
          if (container) {
            container.scrollTop = 0;
          }
        }
        navigate(prevStep.targetRoute);
      }
      onPrevStep?.(prevIndex);
    }
  }, [currentStep?.targetRoute, currentStepIndex, isFirstStep, navigate, onPrevStep, steps]);

  // Navegação direta por dots interativos (Fase 4 — Tarefa 4.2)
  const handleGoToStep = useCallback((index: number) => {
    if (index === currentStepIndex || index < 0 || index >= steps.length) return;
    triggerSensory("selection");
    setStepIndex(index);
    const targetStep = steps[index];
    if (targetStep) {
      if (targetStep.targetRoute !== currentStep?.targetRoute) {
        const container = document.getElementById("main-content");
        if (container) {
          container.scrollTop = 0;
        }
      }
      navigate(targetStep.targetRoute);
    }
    if (index > currentStepIndex) {
      onNextStep?.(index);
    } else {
      onPrevStep?.(index);
    }
  }, [currentStep?.targetRoute, currentStepIndex, navigate, onNextStep, onPrevStep, steps]);

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
      borderRadius: 16,
    });
  }, [currentStep]);

  // Scroll suave contextual e observação de redimensionamento do alvo (Fase 2 — Tarefa 2.2)
  useEffect(() => {
    if (!isDemoActive || !currentStep?.targetSelector) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let cancelSettle: (() => void) | undefined;

    // Reseta o scroll do #main-content imediatamente ao mudar de rota antes de buscar o novo elemento (Fase 2 — Tarefa 2.2)
    const activeRoute = `${location.pathname}${location.search}`;
    if (previousRouteRef.current !== activeRoute) {
      previousRouteRef.current = activeRoute;
      const container = document.getElementById("main-content");
      if (container) {
        container.scrollTop = 0;
      }
    }

    const attemptScrollAndMeasure = (attemptsLeft: number) => {
      const element = document.querySelector(currentStep.targetSelector ?? "");
      if (element) {
        const container = document.getElementById("main-content");
        const headerHeight = 64; // altura do header fixo
        const spacing = 16;

        if (container) {
          const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;
          let targetScrollTop = 0;

          if (element instanceof HTMLElement && typeof element.getBoundingClientRect === "function") {
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            if (isMobileScreen && (elementRect.top !== 0 || containerRect.top !== 0)) {
              const elCenterY = elementRect.top + elementRect.height / 2;
              const willAnchorTop = elCenterY > (window.innerHeight || 800) * 0.45;
              if (willAnchorTop) {
                targetScrollTop = container.scrollTop + (elementRect.bottom - containerRect.bottom) + spacing;
              } else {
                const containerTopOffset = containerRect.top > 0 ? 0 : headerHeight;
                targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - containerTopOffset - spacing;
              }
            } else if (elementRect.top !== 0 || containerRect.top !== 0) {
              const containerTopOffset = containerRect.top > 0 ? 0 : headerHeight;
              targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - containerTopOffset - spacing;
            } else {
              targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
            }
          } else if (element instanceof HTMLElement) {
            targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
          }

          const safeScrollTop = Math.max(0, targetScrollTop);

          if (typeof container.scrollTo === "function") {
            container.scrollTo({ top: safeScrollTop, behavior: "smooth" });
          } else {
            container.scrollTop = safeScrollTop;
          }
        } else if (typeof element.scrollIntoView === "function") {
          const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;
          let blockAlignment: ScrollLogicalPosition = "center";

          if (isMobileScreen) {
            const elRect = element.getBoundingClientRect();
            const elCenterY = elRect.top + elRect.height / 2;
            const willAnchorTop = elCenterY > window.innerHeight * 0.45;
            // Se o popover ancorar no topo, alinha o alvo com block: "end"
            // Se o popover ancorar na base, alinha com block: "center"
            blockAlignment = willAnchorTop ? "end" : "center";
          }

          element.scrollIntoView({ behavior: "smooth", block: blockAlignment });
        }

        // Acopla ResizeObserver para recalcular dimensões após carregamento assíncrono de dados
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            updateTargetRect();
          });
          resizeObserver.observe(element);
        }

        // Sincronização Precisa pós-Estabilização (Fim Real da Rolagem) (Fase 2 — Tarefa 2.3)
        let isSettled = false;
        let rafId: number | undefined;
        let maxTimeout: ReturnType<typeof setTimeout> | undefined;
        let onScrollEnd: (() => void) | null = null;
        const scrollTarget = container ?? (typeof window !== "undefined" ? window : null);

        const settleAndMeasure = () => {
          if (isSettled) return;
          isSettled = true;
          if (rafId) cancelAnimationFrame(rafId);
          if (maxTimeout) {
            clearTimeout(maxTimeout);
            maxTimeout = undefined;
          }
          if (scrollTarget && onScrollEnd) {
            scrollTarget.removeEventListener("scrollend", onScrollEnd);
          }
          updateTargetRect();
        };

        onScrollEnd = () => {
          settleAndMeasure();
        };

        if (scrollTarget) {
          scrollTarget.addEventListener("scrollend", onScrollEnd, { once: true });
        }

        // Fallback determinístico via requestAnimationFrame (2 frames consecutivos sem variação de scrollTop)
        let lastScrollTop = container ? container.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0);
        let stableFrames = 0;

        const checkScrollStabilization = () => {
          if (isSettled) return;

          const currentScrollTop = container ? container.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0);
          if (Math.abs(currentScrollTop - lastScrollTop) < 1) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
            lastScrollTop = currentScrollTop;
          }

          if (stableFrames >= 2) {
            settleAndMeasure();
          } else {
            rafId = requestAnimationFrame(checkScrollStabilization);
          }
        };

        rafId = requestAnimationFrame(checkScrollStabilization);

        // Fallback de segurança caso scrollend e RAF sejam suspensos por aba inativa
        maxTimeout = setTimeout(settleAndMeasure, 600);

        cancelSettle = () => {
          if (isSettled) return;
          isSettled = true;
          if (rafId) cancelAnimationFrame(rafId);
          if (maxTimeout) {
            clearTimeout(maxTimeout);
            maxTimeout = undefined;
          }
          if (scrollTarget && onScrollEnd) {
            scrollTarget.removeEventListener("scrollend", onScrollEnd);
          }
        };
      } else if (attemptsLeft > 0) {
        timer = setTimeout(() => attemptScrollAndMeasure(attemptsLeft - 1), 100);
      } else {
        updateTargetRect();
      }
    };

    attemptScrollAndMeasure(5);

    return () => {
      if (timer) clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      if (cancelSettle) cancelSettle();
    };
  }, [currentRoute, currentStep, isDemoActive, location.pathname, location.search, updateTargetRect]);

  // Listener para redimensionamento da janela e rolagem manual no container correto (#main-content) (Fase 2 — Tarefa 2.1)
  useEffect(() => {
    if (!isDemoActive) return;

    const handleResizeOrScroll = () => {
      updateTargetRect();
    };

    const container = document.getElementById("main-content");

    window.addEventListener("resize", handleResizeOrScroll, { passive: true });
    window.addEventListener("scroll", handleResizeOrScroll, { passive: true });
    container?.addEventListener("scroll", handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll);
      container?.removeEventListener("scroll", handleResizeOrScroll);
    };
  }, [isDemoActive, updateTargetRect]);

  // Suporte a atalhos de teclado e Focus Trap (Fase 4 — Tarefa 4.1)
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
      } else if (e.key === "Tab") {
        if (!cardRef.current) return;
        const focusableElements = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleNext, handlePrev, isDemoActive]);

  // Motor anti-colisão no mobile (Fase 2 — Tarefa 2.4):
  // Se o centro vertical do elemento alvo estiver na metade inferior (> 45% da viewport),
  // ancoramos o popover no TOPO para não encobrir o elemento em foco.
  // Caso contrário, ancoramos na BASE.
  const isAnchorTopMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (rect) {
      const elementCenterY = rect.y + rect.height / 2;
      return elementCenterY > window.innerHeight * 0.45;
    }
    if (currentStep?.targetSelector) {
      const element = document.querySelector(currentStep.targetSelector);
      if (element) {
        const elRect = element.getBoundingClientRect();
        const elementCenterY = elRect.top + elRect.height / 2;
        return elementCenterY > window.innerHeight * 0.45;
      }
    }
    return currentStep?.preferredPlacement === "top";
  }, [currentStep, rect]);

  // Colocação dinâmica no desktop (Fase 2 — Tarefa 2.5):
  // Avalia o espaço disponível real acima e abaixo para inverter dinamicamente
  // entre "top" e "bottom", evitando que o card transborde a viewport.
  const desktopPlacement = useMemo<"top" | "bottom">(() => {
    if (!rect || typeof window === "undefined") return "bottom";
    const cardHeight = measuredCardHeight;
    const spaceBelow = window.innerHeight - (rect.y + rect.height);
    const spaceAbove = rect.y;

    if (currentStep?.preferredPlacement === "top") {
      return spaceAbove >= cardHeight + 20 ? "top" : spaceBelow >= spaceAbove ? "bottom" : "top";
    }

    return spaceBelow < cardHeight + 20 && spaceAbove > spaceBelow ? "top" : "bottom";
  }, [currentStep, measuredCardHeight, rect]);

  if (!isDemoActive || !activeTrack || !currentStep) {
    return null;
  }

  const trackLabel =
    activeTrack === "finances" ? "Finanças Diárias" : "Investimentos";

  // Posicionamento dinâmico do card popover no desktop com altura real e clamp estrito (Fase 2 — Tarefa 2.5)
  const desktopCardStyle = (): React.CSSProperties => {
    if (!rect || typeof window === "undefined") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const cardHeight = measuredCardHeight;
    const cardWidth = 380;
    const gap = 12;

    const top = desktopPlacement === "top"
      ? Math.max(16, rect.y - cardHeight - gap)
      : Math.min(window.innerHeight - cardHeight - 16, rect.y + rect.height + gap);

    // Clamp horizontal estrito contra vazamento de viewport
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
        role="presentation"
        aria-hidden="true"
        className="fixed inset-0 size-full pointer-events-auto"
        width="100%"
        height="100%"
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

        {/* Camada escurecida sobreposta que absorve os cliques externos (Fase 3 — Tarefa 3.3) */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.60)"
          mask="url(#demo-tour-spotlight-mask)"
          data-testid="spotlight-backdrop"
        />

        {/* Borda pontilhada suave em volta da área recortada (Fase 3 — Tarefa 3.3) */}
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
            data-testid="spotlight-border"
            className={cn(
              "transition-opacity duration-700",
              isPulsing ? "animate-pulse opacity-90" : "opacity-75",
            )}
          />
        )}
      </svg>

      {/* Card Popover Adaptativo com transições fluidas entre passos (Fase 3 — Tarefa 3.4) */}
      <aside
        key={currentStep.id}
        ref={cardRef}
        data-tour-step={currentStep.id}
        data-placement={isMobile ? (isAnchorTopMobile ? "top" : "bottom") : desktopPlacement}
        style={!isMobile ? desktopCardStyle() : undefined}
        className={cn(
          "pointer-events-auto border border-border/80 bg-surface shadow-lg transition-all duration-200 animate-fade-in",
          isMobile
            ? cn(
                "fixed inset-x-3 rounded-2xl p-4 max-h-[42vh] overflow-y-auto",
                isAnchorTopMobile
                  ? "top-[max(env(safe-area-inset-top,0px),16px)]"
                  : "bottom-[max(env(safe-area-inset-bottom,0px),16px)]",
              )
            : "fixed rounded-xl p-4.5 z-modal",
          className,
        )}
      >
        {/* Cabeçalho do Card: Badges e Botão [X] de saída imediata */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="muted" size="xs" className="gap-1 font-semibold text-muted-foreground">
              <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
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

        {/* Conteúdo Explicativo com anúncio acessível para leitores de tela (Fase 4 — Tarefa 4.2) */}
        <div className="mt-2.5 space-y-1" aria-live="polite" aria-atomic="true">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {currentStep.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Rodapé com Navegação Adaptativa e Hand-off (Fase 3 — Tarefa 3.1) */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstStep}
            aria-label="Passo anterior"
            className="h-8 px-2.5 text-xs cursor-pointer gap-1 shrink-0"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          {/* Indicadores de progresso interativos com suporte a clique e A11y (Fase 4 — Tarefa 4.2) */}
          <div
            role="tablist"
            aria-label="Progresso do tour demonstrativo"
            className="flex items-center justify-center gap-1.5 shrink-0"
          >
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="button"
                  onClick={() => handleGoToStep(idx)}
                  aria-label={`Ir para o passo ${idx + 1}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200 cursor-pointer p-0 border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary w-3.5"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
                  )}
                />
              );
            })}
          </div>

          {isLastStep ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleStartRealAccount}
              aria-label="Começar Conta Real"
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1.5 shrink-0"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Começar Conta Real</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleNext}
              aria-label="Próximo passo"
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1 shrink-0"
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
