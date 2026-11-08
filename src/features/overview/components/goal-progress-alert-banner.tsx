import { ArrowRight, CheckCircle2, Plus, Sparkles, Target } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { PublicShare } from "@/types";

export interface GoalProgressAlertBannerProps {
  goalShare: PublicShare;
  liveCurrentCents?: number;
  surplusCents?: number | null;
  onOpenDeposit: (share: PublicShare) => void;
  onNavigateGoals?: () => void;
  className?: string;
}

export function GoalProgressAlertBanner({
  goalShare,
  liveCurrentCents,
  surplusCents,
  onOpenDeposit,
  onNavigateGoals,
  className,
}: GoalProgressAlertBannerProps) {
  const payload = goalShare.payload ?? {};
  const title = (payload.title as string) || "Meta Financeira";
  const targetCents = Number(payload.target_cents ?? 0);
  const currentCents =
    liveCurrentCents !== undefined ? liveCurrentCents : Number(payload.current_cents ?? 0);
  const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
  const isCompleted = payload.status === "completed" || percentage >= 100;
  const isFinalStretch = percentage >= 80 && !isCompleted;
  const hasSurplus = surplusCents !== null && surplusCents !== undefined && surplusCents > 0;
  const remainingCents = Math.max(0, targetCents - currentCents);

  const handleDeposit = () => {
    triggerSensory("action");
    onOpenDeposit(goalShare);
  };

  return (
    <div
      role="region"
      aria-label={`Alerta da meta ${title}`}
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all text-foreground",
        isCompleted
          ? "border-positive/30 bg-positive/5"
          : isFinalStretch
            ? "border-warning/30 bg-warning/5"
            : "border-primary/25 bg-primary/5",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            isCompleted
              ? "bg-positive/10 border-positive/20 text-positive-strong"
              : isFinalStretch
                ? "bg-warning/15 border-warning/20 text-warning-strong"
                : "bg-primary/10 border-primary/20 text-primary-strong",
          )}
          aria-hidden="true"
        >
          {isCompleted ? (
            <CheckCircle2 className="size-4.5" />
          ) : isFinalStretch ? (
            <Sparkles className="size-4.5" />
          ) : (
            <Target className="size-4.5" />
          )}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {isCompleted
                ? `Meta Conquistada: ${title}`
                : isFinalStretch
                  ? `Reta Final: ${title}`
                  : hasSurplus
                    ? `Aporte Sugerido: ${title}`
                    : `Meta: ${title}`}
            </h2>
            <Badge
              variant={isCompleted ? "positive" : isFinalStretch ? "warning" : "default"}
              size="xs"
              className="font-semibold"
            >
              {isCompleted ? "100% Batido" : `${percentage}% alcançado`}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            {isCompleted ? (
              <span>Parabéns! Você alcançou o valor planejado com sucesso.</span>
            ) : isFinalStretch ? (
              <span>
                Faltam apenas{" "}
                <MoneyText cents={remainingCents} tone="positive" className="font-semibold" /> para
                conquistar seu objetivo!
              </span>
            ) : hasSurplus ? (
              <span>
                Você possui sobra de{" "}
                <MoneyText cents={surplusCents} tone="positive" className="font-semibold" /> no mês
                para destinar a esta meta.
              </span>
            ) : (
              <span>
                Acumulado <MoneyText cents={currentCents} tone="default" className="font-semibold" /> de{" "}
                <MoneyText cents={targetCents} className="font-semibold" />.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        {!isCompleted && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleDeposit}
            className="gap-1.5 flex-1 sm:flex-initial text-xs font-medium cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>+ Aportar</span>
          </Button>
        )}

        {onNavigateGoals && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onNavigateGoals}
            className="gap-1 shrink-0 text-xs font-medium cursor-pointer"
            title="Ver detalhes da meta em Orçamentos & Metas"
          >
            <span>Ver Meta</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
