import { ChevronRight, Compass } from "lucide-react";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import {
  coreOnboardingProgress,
  coreOnboardingSteps,
  type FeaturePredicate,
  type OnboardingCounts,
} from "@/domain/onboarding";
import type { OnboardingGoalId } from "@/types";
import { AlertCarouselCard } from "./alert-carousel-card";
import { ONBOARDING_STEP_META } from "./overview/onboarding-step-meta";

export interface OnboardingCarouselBannerProps {
  counts: OnboardingCounts;
  hasFeature?: FeaturePredicate;
  initialGoal?: OnboardingGoalId | null;
  onContinue: () => void;
  onDismiss?: () => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

/**
 * Card discreto e dispensável de progresso dos primeiros passos no Carrossel da Home (Fase 2).
 * Segue estritamente Regra 13 (Nível 2), Regra 19 e Regra 35.
 */
export function OnboardingCarouselBanner({
  counts,
  hasFeature,
  initialGoal,
  onContinue,
  onDismiss,
  onSelectPreset,
}: OnboardingCarouselBannerProps) {
  const progress = coreOnboardingProgress(counts, hasFeature, initialGoal);
  const pendingSteps = coreOnboardingSteps(counts, hasFeature, initialGoal).filter(
    (s) => !s.done,
  );
  const nextStep = pendingSteps[0];
  const nextStepLabel = nextStep ? ONBOARDING_STEP_META[nextStep.id]?.label : null;
  const policy = resolveCarouselCardPolicy("onboarding.checklist");

  return (
    <AlertCarouselCard
      id="onboarding.checklist"
      tone="info"
      role="region"
      ariaLabel="Progresso dos primeiros passos"
      icon={<Compass className="size-4.5" />}
      title="Primeiros passos no Axir"
      badge={{
        label: `${progress.done}/${progress.total} concluídos`,
        variant: "default",
      }}
      description={
        nextStepLabel
          ? `Próximo passo: ${nextStepLabel}`
          : "Finalize os passos iniciais quando preferir."
      }
      primaryAction={{
        label: "Continuar",
        onClick: onContinue,
        variant: "outline",
        icon: <ChevronRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.();
              },
              label: "Dispensar guia de primeiros passos",
            }
          : undefined
      }
    />
  );
}
