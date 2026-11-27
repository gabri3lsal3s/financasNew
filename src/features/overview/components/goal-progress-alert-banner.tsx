import { ArrowRight, CheckCircle2, Plus, Sparkles, Target } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import type { PublicShare } from "@/types";

export interface GoalProgressAlertBannerProps {
  goalShare: PublicShare;
  liveCurrentCents?: number;
  surplusCents?: number | null;
  calculationBreakdown?: CalculationBreakdown;
  onOpenDeposit: (share: PublicShare) => void;
  onNavigateGoals?: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
  className?: string;
}

export function GoalProgressAlertBanner({
  goalShare,
  liveCurrentCents,
  surplusCents,
  calculationBreakdown,
  onOpenDeposit,
  onNavigateGoals,
  onDismiss,
  onSelectPreset,
  className,
}: GoalProgressAlertBannerProps) {
  const payload = goalShare.payload ?? {};
  const title = (payload.title as string) || "Meta Financeira";
  const targetCents = Number(payload.target_cents ?? 0);
  const currentCents =
    liveCurrentCents !== undefined
      ? liveCurrentCents
      : Number(payload.current_cents ?? 0);
  const percentage =
    targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
  const hasTarget = targetCents > 0;
  const isCompleted = hasTarget
    ? currentCents >= targetCents
    : payload.status === "completed";
  const isFinalStretch = percentage >= 80 && !isCompleted;
  const hasSurplus =
    surplusCents !== null && surplusCents !== undefined && surplusCents > 0;
  const remainingCents = Math.max(0, targetCents - currentCents);

  const cardKey = `goal.progress.${goalShare.id}`;
  const policy = resolveCarouselCardPolicy(cardKey, {
    goalStage: isCompleted
      ? "completed"
      : isFinalStretch
        ? "final_stretch"
        : hasSurplus
          ? "has_surplus"
          : "regular",
  });

  const bannerTitle = isCompleted
    ? `Meta Conquistada: ${title}`
    : isFinalStretch
      ? `Reta Final: ${title}`
      : hasSurplus
        ? `Aporte Sugerido: ${title}`
        : `Meta: ${title}`;

  return (
    <AlertCarouselCard
      id={cardKey}
      tone={isCompleted ? "positive" : isFinalStretch ? "warning" : "info"}
      role="region"
      ariaLabel={`Alerta da meta ${title}`}
      className={className}
      icon={
        isCompleted ? (
          <CheckCircle2 className="size-4.5" />
        ) : isFinalStretch ? (
          <Sparkles className="size-4.5" />
        ) : (
          <Target className="size-4.5" />
        )
      }
      title={bannerTitle}
      badge={{
        label: isCompleted ? "100% Batido" : `${percentage}% alcançado`,
        variant: isCompleted
          ? "positive"
          : isFinalStretch
            ? "warning"
            : "default",
      }}
      description={
        isCompleted ? (
          <span>Parabéns! Você alcançou o valor planejado com sucesso.</span>
        ) : isFinalStretch ? (
          <span>
            Faltam apenas{" "}
            <MoneyText
              cents={remainingCents}
              tone="positive"
              className="font-semibold"
            />{" "}
            para conquistar seu objetivo!
          </span>
        ) : hasSurplus ? (
          <span>
            Você possui sobra de{" "}
            <MoneyText
              cents={surplusCents}
              tone="positive"
              className="font-semibold"
            />{" "}
            no mês para destinar a esta meta.
          </span>
        ) : (
          <span>
            Acumulado{" "}
            <MoneyText
              cents={currentCents}
              tone="default"
              className="font-semibold"
            />{" "}
            de <MoneyText cents={targetCents} className="font-semibold" />.
          </span>
        )
      }
      calculationBreakdown={calculationBreakdown}
      calculationMemoryLabel={`Memória de cálculo da meta ${title}`}
      primaryAction={
        !isCompleted
          ? {
              label: "Aportar",
              onClick: () => onOpenDeposit(goalShare),
              variant: "default",
              icon: <Plus className="size-3.5" aria-hidden="true" />,
            }
          : onNavigateGoals
            ? {
                label: "Ver Meta",
                onClick: onNavigateGoals,
                variant: "outline",
                icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
              }
            : undefined
      }
      secondaryAction={
        !isCompleted && onNavigateGoals
          ? {
              label: "Ver Meta",
              onClick: onNavigateGoals,
              variant: "outline",
              icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
            }
          : undefined
      }
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: `Dispensar alerta da meta ${title}`,
            }
          : undefined
      }
    />
  );
}
