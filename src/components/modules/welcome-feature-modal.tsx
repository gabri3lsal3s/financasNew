import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import {
  WELCOME_MODAL_STORAGE_KEY,
  WELCOME_SLIDES,
} from "./welcome-feature-modal-data";

export interface WelcomeFeatureModalProps {
  /** Controle externo de visibilidade (opcional). Se omitido, deriva do localStorage. */
  open?: boolean;
  /** Callback acionado ao alterar estado de abertura. */
  onOpenChange?: (open: boolean) => void;
  /** Callback acionado quando o modal é dispensado ou concluído. */
  onDismiss?: () => void;
  /** Força a exibição ignorando o estado salvo no localStorage. */
  forceShow?: boolean;
}

/**
 * Modal Interativo de Boas-Vindas ("A Mágica da Captura Sem Fricção" — Fase 6).
 * Apresenta a hierarquia de captura (notificações, comprovantes e inteligência semântica)
 * no primeiro login do usuário, com navegação por teclado e persistência de dismiss.
 */
export function WelcomeFeatureModal({
  open,
  onOpenChange,
  onDismiss,
  forceShow = false,
}: WelcomeFeatureModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      return window.localStorage.getItem(WELCOME_MODAL_STORAGE_KEY) !== "true";
    } catch {
      return false;
    }
  });

  const isVisible = open !== undefined ? open : internalOpen;

  const handleComplete = useCallback(() => {
    triggerSensory("action");
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "true");
      }
    } catch {
      // Ignora erro se localStorage inacessível
    }
    setInternalOpen(false);
    onOpenChange?.(false);
    onDismiss?.();
  }, [onDismiss, onOpenChange]);

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev < WELCOME_SLIDES.length - 1) {
        triggerSensory("selection");
        return prev + 1;
      }
      handleComplete();
      return prev;
    });
  }, [handleComplete]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev > 0) {
        triggerSensory("selection");
        return prev - 1;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, handleNext, handlePrev]);

  if (!isVisible) return null;

  const slide = WELCOME_SLIDES[currentSlide] ?? WELCOME_SLIDES[0]!;
  const Icon = slide.icon;

  return (
    <Modal
      open={isVisible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleComplete();
        } else {
          setInternalOpen(true);
          onOpenChange?.(true);
        }
      }}
      title="A Mágica da Captura Sem Fricção"
      description="Descubra como o Áxis Finance automatiza seu controle financeiro com privacidade local."
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          {/* Indicador de passos (Dots) acessível */}
          <div
            className="flex items-center justify-center sm:justify-start gap-1.5"
            role="tablist"
            aria-label="Progresso da apresentação de recursos"
          >
            {WELCOME_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={idx === currentSlide}
                aria-label={`Slide ${idx + 1} de ${WELCOME_SLIDES.length}: ${s.title}`}
                onClick={() => {
                  triggerSensory("selection");
                  setCurrentSlide(idx);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200 cursor-pointer",
                  idx === currentSlide
                    ? "w-6 bg-primary"
                    : "w-2 bg-border/80 hover:bg-muted-foreground/60",
                )}
              />
            ))}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 justify-end">
            {currentSlide > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="gap-1 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Voltar</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleComplete}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Pular
              </Button>
            )}

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleNext}
              className="gap-1.5 cursor-pointer font-semibold"
            >
              <span>{currentSlide === WELCOME_SLIDES.length - 1 ? "Começar a usar" : "Próximo"}</span>
              {currentSlide === WELCOME_SLIDES.length - 1 ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className="flex flex-col items-center text-center py-4 px-1 focus:outline-none"
        tabIndex={0}
        aria-live="polite"
        data-testid={`slide-${slide.id}`}
      >
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-surface-hover/80 text-foreground shadow-2xs mb-3.5 transition-transform duration-200">
          <Icon className="size-6 text-foreground" aria-hidden="true" />
        </div>

        <Badge variant="muted" size="sm" className="mb-2">
          {slide.badge}
        </Badge>

        <h3 className="font-display text-lg font-bold text-foreground tracking-tight">
          {slide.title}
        </h3>

        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {slide.headline}
        </p>

        <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
          {slide.description}
        </p>
      </div>
    </Modal>
  );
}
