import type { CSSProperties, RefObject } from "react";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  resolveTourStepContent,
  resolveTourStepTitle,
  type AnyTourTrackId,
  type BlockHandoffInfo,
  type TourStep,
} from "@/domain/demo-simulation";
import { cn } from "@/lib/utils";
import type { MotionLevel } from "@/hooks/use-visual-customization";
import { SpotlightCompletionCard } from "./spotlight-completion-card";

export interface SpotlightStepCardProps {
  cardRef: RefObject<HTMLDivElement | null>;
  steps: readonly TourStep[];
  currentStep: TourStep;
  currentStepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  isMobile: boolean;
  isAnchorTopMobile: boolean;
  isNarrowCard: boolean;
  desktopPlacement: "top" | "bottom";
  desktopCardStyle: CSSProperties;
  trackLabel: string;
  blockHandoff: BlockHandoffInfo | null;
  motionLevel: MotionLevel;
  className?: string;
  onPrev: () => void;
  onNext: () => void;
  onGoToStep: (index: number) => void;
  onClose: () => void;
  onStartRealAccount: () => void;
  onStartNextBlock: (nextTrackId: AnyTourTrackId) => void;
}

/**
 * Card popover persistente do tour guiado com suporte a mobile (zona segura acima da BottomNav) e desktop.
 */
export function SpotlightStepCard({
  cardRef,
  steps,
  currentStep,
  currentStepIndex,
  isFirstStep,
  isLastStep,
  isMobile,
  isAnchorTopMobile,
  isNarrowCard,
  desktopPlacement,
  desktopCardStyle,
  trackLabel,
  blockHandoff,
  motionLevel,
  className,
  onPrev,
  onNext,
  onGoToStep,
  onClose,
  onStartRealAccount,
  onStartNextBlock,
}: SpotlightStepCardProps) {
  const isReduced = motionLevel === "reduced";
  const currentStepNumber = currentStepIndex + 1;

  return (
    <aside
      ref={cardRef}
      data-tour-spotlight-card="true"
      data-tour-step={currentStep.id}
      data-placement={isMobile ? (isAnchorTopMobile ? "top" : "bottom") : desktopPlacement}
      style={!isMobile ? desktopCardStyle : undefined}
      className={cn(
        "pointer-events-auto border border-border/80 bg-surface shadow-lg",
        !isReduced && "animate-fade-in",
        isMobile
          ? cn(
              "fixed inset-x-3 rounded-2xl p-4 max-h-[42vh] overflow-y-auto z-floating-tools",
              !isReduced && "transition-all duration-300 ease-out",
              isAnchorTopMobile
                ? "top-[max(env(safe-area-inset-top,0px),16px)]"
                : "bottom-[calc(5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))]",
            )
          : "fixed rounded-xl p-4.5 z-floating-tools",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="muted" size="xs" className="gap-1 font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
            <span key={currentStepNumber} className={!isReduced ? "animate-fade-in" : undefined}>
              Passo {currentStepNumber} de {steps.length}
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
          onClick={onClose}
          aria-label="Encerrar tour demonstrativo"
          title="Encerrar tour (ESC)"
          className="size-7 p-0 text-muted-foreground hover:text-foreground rounded-full"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div
        key={currentStep.id}
        className={cn("mt-2.5 space-y-1", !isReduced && "animate-fade-in")}
        aria-live="polite"
        aria-atomic="true"
      >
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {resolveTourStepTitle(currentStep, !isMobile)}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {resolveTourStepContent(currentStep, !isMobile)}
        </p>
      </div>

      {isLastStep ? (
        <SpotlightCompletionCard
          steps={steps}
          currentStepIndex={currentStepIndex}
          isFirstStep={isFirstStep}
          isNarrowCard={isNarrowCard}
          blockHandoff={blockHandoff}
          motionLevel={motionLevel}
          onPrev={onPrev}
          onGoToStep={onGoToStep}
          onClose={onClose}
          onStartRealAccount={onStartRealAccount}
          onStartNextBlock={onStartNextBlock}
        />
      ) : (
        <div className="mt-3.5 pt-3 border-t border-border/80 flex items-center justify-between gap-2 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent="selection"
            onClick={onPrev}
            disabled={isFirstStep}
            aria-label="Passo anterior"
            className="h-8 px-2.5 text-xs gap-1 shrink-0 max-w-fit"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline truncate">Anterior</span>
          </Button>

          <div
            role="group"
            aria-label="Progresso do tour demonstrativo"
            className="flex items-center justify-center gap-1.5 shrink-0"
          >
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onGoToStep(idx)}
                  aria-label={`Ir para o passo ${idx + 1}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "relative h-1.5 rounded-full cursor-pointer p-0 border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 after:absolute after:-inset-2.5",
                    !isReduced && "transition-all duration-200",
                    isActive
                      ? "bg-primary w-3.5"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
                  )}
                />
              );
            })}
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent="selection"
            onClick={onNext}
            aria-label="Próximo passo"
            className="h-8 px-3 text-xs font-semibold gap-1 shrink-0 max-w-fit"
          >
            <span className="truncate">Próximo</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      )}
    </aside>
  );
}
