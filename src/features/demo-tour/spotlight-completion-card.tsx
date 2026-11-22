import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui";
import type { AnyTourTrackId, BlockHandoffInfo, TourStep } from "@/domain/demo-simulation";
import { cn } from "@/lib/utils";
import type { MotionLevel } from "@/hooks/use-visual-customization";

export interface SpotlightCompletionCardProps {
  steps: readonly TourStep[];
  currentStepIndex: number;
  isFirstStep: boolean;
  isNarrowCard: boolean;
  blockHandoff: BlockHandoffInfo | null;
  motionLevel: MotionLevel;
  onPrev: () => void;
  onGoToStep: (index: number) => void;
  onClose: () => void;
  onStartRealAccount: () => void;
  onStartNextBlock: (nextTrackId: AnyTourTrackId) => void;
}

/**
 * Rodapé de conclusão do último passo do tour com prioridade confortável de retorno à conta real.
 */
export function SpotlightCompletionCard({
  steps,
  currentStepIndex,
  isFirstStep,
  isNarrowCard,
  blockHandoff,
  motionLevel,
  onPrev,
  onGoToStep,
  onClose,
  onStartRealAccount,
  onStartNextBlock,
}: SpotlightCompletionCardProps) {
  const isReduced = motionLevel === "reduced";

  return (
    <div className="mt-3.5 pt-3 border-t border-border/80 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          onClick={onPrev}
          disabled={isFirstStep}
          aria-label="Passo anterior"
          className="h-8 px-2.5 text-xs gap-1 shrink-0"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Anterior</span>
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
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Encerrar tour"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span>Fechar</span>
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-2 pt-0.5 w-full",
          blockHandoff?.nextTrackId ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onStartRealAccount}
          aria-label="Voltar para minha conta"
          title="Voltar para minha conta"
          className="h-8.5 px-3 text-xs font-semibold gap-1.5 w-full min-w-0 justify-center"
        >
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sm:hidden truncate">Minha conta</span>
          <span className="hidden sm:inline truncate">
            {isNarrowCard ? "Minha conta" : "Voltar para minha conta"}
          </span>
        </Button>
        {blockHandoff?.nextTrackId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onStartNextBlock(blockHandoff.nextTrackId!)}
            aria-label={`Avançar para ${blockHandoff.nextTrackLabel ?? "Próxima Trilha"}`}
            title={blockHandoff.nextTrackLabel ?? "Próxima Trilha"}
            className="h-8.5 px-3 text-xs font-medium gap-1.5 w-full min-w-0 justify-center"
          >
            <span className="truncate">{blockHandoff.nextTrackLabel ?? "Próxima Trilha"}</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
