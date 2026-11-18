import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shouldOfferAndroidApk } from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import {
  hasSeenWelcomeFeatureModal,
  markWelcomeFeatureModalSeen,
} from "@/state/demo-mode";
import { WELCOME_SLIDES } from "./welcome-feature-modal-data";

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
 * Modal Interativo de Boas-Vindas ("A Mágica da Captura Sem Fricção").
 * Suprime automaticamente a promoção Android em Desktop e iOS (M10).
 */
export function WelcomeFeatureModal({
  open,
  onOpenChange,
  onDismiss,
  forceShow = false,
}: WelcomeFeatureModalProps) {
  const canOfferAndroid = shouldOfferAndroidApk();

  const slides = useMemo(
    () =>
      canOfferAndroid
        ? WELCOME_SLIDES
        : WELCOME_SLIDES.filter((slide) => slide.id !== "notifications"),
    [canOfferAndroid],
  );

  const [currentSlide, setCurrentSlide] = useState(0);

  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    if (!canOfferAndroid) return false;
    return !hasSeenWelcomeFeatureModal();
  });

  const isVisible = open !== undefined ? open : internalOpen;
  const safeSlideIndex = Math.min(currentSlide, Math.max(0, slides.length - 1));

  const handleComplete = useCallback(() => {
    markWelcomeFeatureModalSeen();
    setInternalOpen(false);
    onOpenChange?.(false);
    onDismiss?.();
  }, [onDismiss, onOpenChange]);

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => {
      const clamped = Math.min(prev, Math.max(0, slides.length - 1));
      if (clamped < slides.length - 1) {
        return clamped + 1;
      }
      handleComplete();
      return clamped;
    });
  }, [handleComplete, slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerSensory("selection");
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerSensory("selection");
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, handleNext, handlePrev]);

  if (!isVisible) return null;

  const slide = slides[safeSlideIndex] ?? slides[0]!;
  const Icon = slide.icon;
  const isLastSlide = safeSlideIndex === slides.length - 1;

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
      description="Descubra como o Axir automatiza seu controle financeiro com privacidade local."
      size="md"
      footer={
        <ModalFooter borderless>
          {safeSlideIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              sensoryIntent="selection"
              onClick={handlePrev}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Voltar</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={handleComplete}
              className="text-muted-foreground hover:text-foreground"
            >
              Pular
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            sensoryIntent={isLastSlide ? "action" : "selection"}
            onClick={handleNext}
            className="gap-1.5 font-semibold"
          >
            <span>{isLastSlide ? "Começar a usar" : "Próximo"}</span>
            {isLastSlide ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4" aria-hidden="true" />
            )}
          </Button>
        </ModalFooter>
      }
    >
      <div
        className="flex flex-col items-center text-center py-4 px-1 focus:outline-none"
        tabIndex={0}
        aria-live="polite"
        data-testid={`slide-${slide.id}`}
      >
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised text-foreground shadow-xs mb-3.5 transition-transform duration-200">
          <Icon className="size-6 text-foreground" aria-hidden="true" />
        </div>

        <Badge variant="muted" size="sm" className="mb-2">
          {slide.badge}
        </Badge>

        <h3 className="font-display text-lg font-bold text-foreground tracking-tight">
          {slide.title}
        </h3>

        <p className="mt-1 text-xs font-semibold text-muted-foreground">{slide.headline}</p>

        <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
          {slide.description}
        </p>

        <div
          className="mt-5 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Progresso da apresentação de recursos"
        >
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === safeSlideIndex}
              aria-label={`Slide ${idx + 1} de ${slides.length}: ${s.title}`}
              onClick={() => {
                triggerSensory("selection");
                setCurrentSlide(idx);
              }}
              className={cn(
                "relative h-1.5 rounded-full transition-all duration-200 cursor-pointer after:absolute after:-inset-2",
                idx === safeSlideIndex
                  ? "w-6 bg-primary"
                  : "w-2 bg-border/80 hover:bg-muted-foreground/60",
              )}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
