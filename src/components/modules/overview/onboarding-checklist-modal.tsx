import { useMemo } from "react";
import { Link } from "react-router";
import { Check, Share2, Sparkles } from "lucide-react";
import { Badge, Button, Modal, Progress } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  coreOnboardingProgress,
  onboardingSteps,
  type FeaturePredicate,
  type OnboardingCounts,
} from "@/domain/onboarding";
import { cn } from "@/lib/utils";
import { requestNotificationListenerPermission } from "@/services/native";
import { useUserPreferences } from "@/state";
import { getStoredInitialGoal } from "@/state/demo-mode";
import { ONBOARDING_STEP_META } from "./onboarding-step-meta";

export { ONBOARDING_STEP_META };

export interface OnboardingChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: OnboardingCounts;
  hasFeature?: FeaturePredicate;
  onEnableNotifications?: () => void | Promise<void>;
  onOpenDemoTrackSelect: () => void;
}

/**
 * Modal de checklist completo para configuração inicial guiada da conta.
 */
export function OnboardingChecklistModal({
  open,
  onOpenChange,
  counts,
  hasFeature,
  onEnableNotifications,
  onOpenDemoTrackSelect,
}: OnboardingChecklistModalProps) {
  const userPreferencesQuery = useUserPreferences();
  const initialGoal =
    userPreferencesQuery.data?.custom_settings?.initialGoal ?? getStoredInitialGoal();
  const rawSteps = onboardingSteps(counts, hasFeature);

  const steps = useMemo(() => {
    if (!initialGoal) return rawSteps;
    const priorityId =
      initialGoal === "cards" ? "card" : initialGoal === "ocr" ? "first-transaction" : null;
    if (!priorityId) return rawSteps;
    const target = rawSteps.find((s) => s.id === priorityId);
    if (!target) return rawSteps;
    return [target, ...rawSteps.filter((s) => s.id !== priorityId)];
  }, [rawSteps, initialGoal]);

  const progress = coreOnboardingProgress(counts, hasFeature, initialGoal);

  const handleEnableNotifications = async () => {
    if (onEnableNotifications) {
      await onEnableNotifications();
      return;
    }
    await requestNotificationListenerPermission();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configure sua conta"
      description="Complete os primeiros passos para aproveitar todos os recursos do app."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {progress.done} de {progress.total} passos concluídos
            </span>
            {progress.done < progress.total ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenDemoTrackSelect();
                }}
                className="gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-medium cursor-pointer h-7 px-2.5"
              >
                <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
                <span>Explorar com Simulação</span>
              </Button>
            ) : null}
          </div>
          <Progress
            value={(progress.done / progress.total) * 100}
            tone="auto"
            aria-label={`Progresso da configuração: ${progress.done} de ${progress.total}`}
          />
        </div>

        <ul className="flex flex-col gap-2.5">
          {steps.map((step) => {
            const meta = ONBOARDING_STEP_META[step.id];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 transition-colors",
                  step.done
                    ? "border-border/80 bg-surface-hover/20 text-muted-foreground"
                    : "border-border/80 bg-surface shadow-xs",
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      step.done
                        ? "border-positive/20 bg-positive/10 text-positive-strong"
                        : "border-border/80 bg-surface-hover text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-xs sm:text-sm font-semibold break-words",
                          step.done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {meta.label}
                      </p>
                      {step.id === "bank-notifications" ? (
                        <Badge variant="muted" size="xs" className="shrink-0">
                          Opcional
                        </Badge>
                      ) : null}
                    </div>

                    {!step.done ? (
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed break-words">
                        {meta.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!step.done ? (
                  <div className="shrink-0 pl-2">
                    {meta.href ? (
                      <Link
                        to={meta.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "h-7 px-2.5 text-xs font-medium",
                        )}
                      >
                        Configurar
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleEnableNotifications()}
                        className="h-7 px-2.5 text-xs font-medium cursor-pointer"
                      >
                        Configurar
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs text-muted-foreground">
          <Share2 className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-xs">Comprovantes e Cupons Fiscais</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Compartilhe ou anexe comprovantes Pix, boletos, carnês, maquininhas ou cupons fiscais para registro automático sem digitação.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
