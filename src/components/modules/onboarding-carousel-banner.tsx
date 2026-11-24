import { ChevronRight, Compass, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  coreOnboardingProgress,
  coreOnboardingSteps,
  type FeaturePredicate,
  type OnboardingCounts,
} from "@/domain/onboarding";
import type { OnboardingGoalId } from "@/types";
import { ONBOARDING_STEP_META } from "./overview/onboarding-step-meta";

export interface OnboardingCarouselBannerProps {
  counts: OnboardingCounts;
  hasFeature?: FeaturePredicate;
  initialGoal?: OnboardingGoalId | null;
  onContinue: () => void;
  onDismiss: () => void;
}

/**
 * Card discreto e dispensável de progresso dos primeiros passos no Carrossel da Home (Fase 2).
 * Segue estritamente Regra 13 (Nível 2) e Regra 19 (altura uniforme, teto 2 linhas, CTA h-8).
 */
export function OnboardingCarouselBanner({
  counts,
  hasFeature,
  initialGoal,
  onContinue,
  onDismiss,
}: OnboardingCarouselBannerProps) {
  const progress = coreOnboardingProgress(counts, hasFeature, initialGoal);
  const pendingSteps = coreOnboardingSteps(counts, hasFeature, initialGoal).filter((s) => !s.done);
  const nextStep = pendingSteps[0];
  const nextStepLabel = nextStep ? ONBOARDING_STEP_META[nextStep.id]?.label : null;

  return (
    <div
      role="region"
      aria-label="Progresso dos primeiros passos"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong"
          aria-hidden="true"
        >
          <Compass className="size-4.5" />
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2
              className="text-sm font-semibold tracking-tight text-foreground truncate"
              title="Primeiros passos no Axir"
            >
              Primeiros passos no Axir
            </h2>
            <Badge size="xs" variant="default" className="num shrink-0">
              {progress.done}/{progress.total} concluídos
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            {nextStepLabel
              ? `Próximo passo: ${nextStepLabel}`
              : "Finalize os passos iniciais quando preferir."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onContinue}
          className="w-full sm:w-auto h-8 text-xs font-medium cursor-pointer gap-1.5"
        >
          <span>Continuar</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        <div className="absolute top-3 right-3 sm:static">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            aria-label="Dispensar guia de primeiros passos"
            title="Dispensar guia"
            className="relative size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
