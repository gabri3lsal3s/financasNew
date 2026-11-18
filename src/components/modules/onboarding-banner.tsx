import { useState } from "react";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { Button, Progress } from "@/components/ui";
import {
  coreOnboardingProgress,
  coreOnboardingSteps,
  type FeaturePredicate,
  type OnboardingCounts,
} from "@/domain/onboarding";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/state";
import { getStoredInitialGoal } from "@/state/demo-mode";
import { DemoTrackSelectModal } from "./demo-track-select-modal";
import {
  ONBOARDING_STEP_META,
  OnboardingChecklistModal,
} from "./overview/onboarding-checklist-modal";

export interface OnboardingBannerProps {
  counts: OnboardingCounts;
  hasFeature?: FeaturePredicate;
  onDismiss: () => void;
  onEnableNotifications?: () => void | Promise<void>;
  className?: string;
}

/**
 * Banner compacto de configuração inicial (§5.7) com modal guiado de passos.
 */
export function OnboardingBanner({
  counts,
  hasFeature,
  onDismiss,
  onEnableNotifications,
  className,
}: OnboardingBannerProps) {
  const [open, setOpen] = useState(false);
  const [demoTrackModalOpen, setDemoTrackModalOpen] = useState(false);
  const userPreferencesQuery = useUserPreferences();
  const initialGoal =
    userPreferencesQuery.data?.custom_settings?.initialGoal ?? getStoredInitialGoal();
  const progress = coreOnboardingProgress(counts, hasFeature, initialGoal);
  const pendingSteps = coreOnboardingSteps(counts, hasFeature, initialGoal).filter((s) => !s.done);

  return (
    <>
      <div
        role="region"
        aria-label="Configuração inicial da conta"
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border/80 bg-surface px-4 py-2.5 shadow-xs transition-all",
          className,
        )}
      >
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground leading-none">
            Configure sua conta
          </span>
          <span className="num text-xs font-medium text-muted-foreground leading-none">
            {progress.done}/{progress.total}
          </span>
          {pendingSteps.length > 0 ? (
            <span className="hidden sm:inline text-xs text-muted-foreground truncate">
              — {pendingSteps[0] ? (ONBOARDING_STEP_META[pendingSteps[0].id]?.label ?? "") : ""}
              {pendingSteps.length > 1 ? ` e mais ${pendingSteps.length - 1}` : ""}
            </span>
          ) : null}
        </div>

        <div className="hidden sm:flex w-20 shrink-0">
          <Progress
            value={(progress.done / Math.max(progress.total, 1)) * 100}
            tone="auto"
            aria-hidden="true"
            className="h-1.5"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-7 px-2.5 text-xs font-medium shrink-0 cursor-pointer gap-1"
        >
          Continuar
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="relative size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
          aria-label="Dispensar aviso de configuração"
          title="Não mostrar novamente"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <OnboardingChecklistModal
        open={open}
        onOpenChange={setOpen}
        counts={counts}
        hasFeature={hasFeature}
        onEnableNotifications={onEnableNotifications}
        onOpenDemoTrackSelect={() => setDemoTrackModalOpen(true)}
      />

      <DemoTrackSelectModal
        open={demoTrackModalOpen}
        onOpenChange={setDemoTrackModalOpen}
      />
    </>
  );
}
