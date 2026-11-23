import { useMemo } from "react";
import { Link } from "react-router";
import { Check, Share2, Sparkles } from "lucide-react";
import { Badge, Button, Modal, Progress } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  coreOnboardingProgress,
  coreOnboardingSteps,
  onboardingSteps,
  type FeaturePredicate,
  type OnboardingCounts,
  type OnboardingStep,
} from "@/domain/onboarding";
import { cn } from "@/lib/utils";
import { requestNotificationListenerPermission } from "@/services/native";
import type { OnboardingGoalId } from "@/types";
import { ONBOARDING_STEP_META } from "./onboarding-step-meta";

export { ONBOARDING_STEP_META };

export interface OnboardingChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: OnboardingCounts;
  hasFeature?: FeaturePredicate;
  initialGoal?: OnboardingGoalId | null;
  onCalibrateCash?: () => void;
  onEnableNotifications?: () => void | Promise<void>;
  onStartQuickTour?: () => void;
  onOpenDemoTrackSelect: () => void;
}

/**
 * Modal de checklist completo para configuração inicial guiada da conta.
 * Componente de módulo puro (Regra 4.5 — sem imports de data/state).
 */
export function OnboardingChecklistModal({
  open,
  onOpenChange,
  counts,
  hasFeature,
  initialGoal = null,
  onCalibrateCash,
  onEnableNotifications,
  onStartQuickTour,
  onOpenDemoTrackSelect,
}: OnboardingChecklistModalProps) {
  const coreSteps = useMemo(
    () => coreOnboardingSteps(counts, hasFeature, initialGoal),
    [counts, hasFeature, initialGoal],
  );
  const allSteps = useMemo(() => onboardingSteps(counts, hasFeature), [counts, hasFeature]);

  const orderedSteps = useMemo(() => {
    const coreIds = new Set(coreSteps.map((s) => s.id));
    const optionalSteps = allSteps.filter((s) => !coreIds.has(s.id));
    return { coreSteps, optionalSteps, coreIds };
  }, [allSteps, coreSteps]);

  const progress = coreOnboardingProgress(counts, hasFeature, initialGoal);

  const handleEnableNotifications = async () => {
    if (onEnableNotifications) {
      await onEnableNotifications();
      return;
    }
    await requestNotificationListenerPermission();
  };

  const handleTourClick = () => {
    onOpenChange(false);
    if (onStartQuickTour) {
      onStartQuickTour();
    } else {
      onOpenDemoTrackSelect();
    }
  };

  const renderStepRow = (step: OnboardingStep, isOptional: boolean) => {
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
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {step.done ? (
            <Check
              className="size-4 shrink-0 text-positive-strong mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <Icon
              className="size-4 shrink-0 text-muted-foreground mt-0.5"
              aria-hidden="true"
            />
          )}

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
              {isOptional || step.id === "card" ? (
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
            {step.id === "cash-checkpoint" && onCalibrateCash ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onCalibrateCash();
                }}
                className="h-7 px-2.5 text-xs font-medium cursor-pointer"
              >
                Configurar
              </Button>
            ) : meta.href ? (
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
            ) : step.id === "bank-notifications" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleEnableNotifications()}
                className="h-7 px-2.5 text-xs font-medium cursor-pointer"
              >
                Configurar
              </Button>
            ) : (
              <Link
                to="/"
                onClick={() => onOpenChange(false)}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "h-7 px-2.5 text-xs font-medium",
                )}
              >
                Configurar
              </Link>
            )}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Primeiros passos no Axir"
      description="Complete as etapas essenciais no seu ritmo ou explore uma demonstração segura."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {progress.done} de {progress.total} passos essenciais concluídos
            </span>
            {progress.done < progress.total ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTourClick}
                  className="gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-medium cursor-pointer h-7 px-2.5"
                >
                  <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
                  <span>
                    {onStartQuickTour ? "Fazer Tour Rápido (1 min)" : "Explorar com Simulação"}
                  </span>
                </Button>
                {onStartQuickTour ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenDemoTrackSelect();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 cursor-pointer"
                  >
                    Outras trilhas
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <Progress
            value={(progress.done / Math.max(progress.total, 1)) * 100}
            tone="auto"
            aria-label={`Progresso da configuração: ${progress.done} de ${progress.total}`}
          />
        </div>

        <div className="space-y-3">
          <ul className="flex flex-col gap-2.5">
            {orderedSteps.coreSteps.map((step) => renderStepRow(step, false))}
          </ul>

          {orderedSteps.optionalSteps.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block px-0.5">
                Complementares · no seu ritmo
              </span>
              <ul className="flex flex-col gap-2">
                {orderedSteps.optionalSteps.map((step) => renderStepRow(step, true))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs text-muted-foreground">
          <Share2 className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-xs">Comprovantes e Cupons Fiscais</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Compartilhe ou anexe comprovantes Pix, boletos, carnês, maquininhas ou cupons fiscais
              para registro automático sem digitação.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
