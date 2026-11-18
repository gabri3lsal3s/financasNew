import { useState } from "react";
import { useNavigate } from "react-router";
import { SmartAdvisorCardSkeleton } from "@/components/modules/smart-advisor-card-skeleton";
import type { SmartAdvisorCardContext, SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { pushToast } from "@/services/toast";
import { SmartAdvisorCardFooter } from "./smart-advisor-card-footer";
import { SmartAdvisorCardHeader } from "./smart-advisor-card-header";
import { resolveSmartAdvisorActionRoute, resolveSmartAdvisorPresentation } from "./smart-advisor-routing";

export interface SmartAdvisorCardProps {
  className?: string;
  month?: string;
  insight?: SmartAdvisorInsight | null;
  cardContext?: SmartAdvisorCardContext;
  currentIndex?: number;
  totalCount?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onDismiss?: (themeKey?: string, days?: number) => void;
  onConfirmRecurrence?: (occurrenceKey: string) => void | Promise<void>;
  onIgnoreRecurrence?: (occurrenceKey: string, reason?: CalibrationDecision) => void | Promise<void>;
  onConfirmIncome?: (payload: { name: string; valueCents: number; categoryId: string; date?: string }) => void | Promise<void>;
  onConfirmExpense?: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
  }) => void | Promise<void>;
  onMarkEssential?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  savingsSurplusCents?: number;
  safeToSpendCents?: number;
  committedObligationsCents?: number;
}

/**
 * Microcard do Assistente Proativo de Insights na Home (SmartAdvisor).
 */
export function SmartAdvisorCard({
  className,
  month,
  insight: controlledInsight,
  cardContext: controlledCardContext,
  currentIndex: controlledCurrentIndex,
  totalCount: controlledTotalCount,
  onNext,
  onPrev,
  onDismiss,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onMarkEssential,
  onConfirmIncome,
  onConfirmExpense,
  savingsSurplusCents,
  safeToSpendCents,
  committedObligationsCents,
}: SmartAdvisorCardProps) {
  const navigate = useNavigate();
  const isCurrentMonth = month ? month === currentMonth() : true;
  const hook = useSmartAdvisorInsights({
    month,
    enabled: controlledInsight === undefined && isCurrentMonth,
    savingsSurplusCents,
    safeToSpendCents,
    committedObligationsCents,
  });

  const activeInsight = controlledInsight !== undefined ? controlledInsight : hook.insight;
  const currentIndex = controlledCurrentIndex ?? hook.currentIndex;
  const totalCount = controlledTotalCount ?? hook.totalCount;
  const cardContext = controlledCardContext ?? activeInsight?.cardContext ?? activeInsight?.metadata?.cardContext;
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCurrentMonth) return null;
  if (controlledInsight === undefined && hook.isLoading) return <SmartAdvisorCardSkeleton className={className} />;
  if (!activeInsight) return null;

  const presentation = resolveSmartAdvisorPresentation(activeInsight);

  const runWithSubmitting = async (fn: () => Promise<void>) => {
    try {
      setIsSubmitting(true);
      await fn();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss(activeInsight.themeKey);
    else hook.dismiss(activeInsight.themeKey);
    pushToast({
      title: "Sugestão dispensada",
      description: "Esta recomendação foi pausada e reaparecerá após 30 dias.",
      variant: "default",
    });
  };

  const handleMarkEssential = () => {
    const payload = (activeInsight.secondaryAction?.payload ?? activeInsight.primaryAction?.payload) as
      | { key?: string; name?: string }
      | undefined;
    const key = payload?.key ?? activeInsight.themeKey.replace(/^(savings:|calib:|price_adj:)/, "");
    const displayName = payload?.name ?? activeInsight.title;
    return runWithSubmitting(async () => {
      if (onMarkEssential) await onMarkEssential(key, displayName);
      else await hook.markAsEssential(key, displayName);
    });
  };

  const handleIgnoreRecurrence = (reason: CalibrationDecision = "one_off") => {
    if (reason === "essential") return handleMarkEssential().then(() => hook.dismiss(activeInsight.themeKey));
    const payload = activeInsight.secondaryAction?.payload as { key?: string } | undefined;
    const key = payload?.key ?? activeInsight.themeKey.replace(/^calib:/, "");
    return runWithSubmitting(async () => {
      if (onIgnoreRecurrence) await onIgnoreRecurrence(key, reason);
      else {
        await hook.ignoreRecurrence(key, reason, { skipSensory: true });
        hook.dismiss(activeInsight.themeKey);
      }
    });
  };

  const isTopSavingsEssential =
    activeInsight.category === "savings" &&
    (activeInsight.primaryAction?.kind === "cut_subscription" ||
      activeInsight.primaryAction?.kind === "set_category_budget");

  return (
    <div
      role="region"
      aria-label="Assistente Proativo de Insights"
      className={cn(
        "w-full flex flex-col justify-between gap-3 min-h-[148px] sm:min-h-[140px] rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all motion-reduce:transition-none",
        className,
      )}
    >
      <SmartAdvisorCardHeader
        presentation={presentation}
        currentIndex={currentIndex}
        totalCount={totalCount}
        isTopSavingsEssential={isTopSavingsEssential}
        isSubmitting={isSubmitting}
        onPrev={onPrev ?? hook.prevInsight}
        onNext={onNext ?? hook.nextInsight}
        onMarkEssential={() => void handleMarkEssential()}
        onDismiss={handleDismiss}
        hasExternalMarkEssential={Boolean(onMarkEssential)}
      />

      <div
        key={activeInsight.id}
        data-testid="smart-advisor-content-body"
        className="flex flex-col gap-3 min-w-0 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transition-none"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{activeInsight.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{activeInsight.description}</p>
        </div>

        <SmartAdvisorCardFooter
          insight={activeInsight}
          cardContext={cardContext}
          isSubmitting={isSubmitting}
          hasExternalConfirmRecurrence={Boolean(onConfirmRecurrence)}
          hasExternalConfirmIncome={Boolean(onConfirmIncome)}
          hasExternalConfirmExpense={Boolean(onConfirmExpense)}
          onConfirmRecurrence={() => {
            const p = activeInsight.primaryAction?.payload as { key?: string } | undefined;
            const key = p?.key ?? activeInsight.themeKey.replace(/^calib:/, "");
            void runWithSubmitting(async () => {
              if (onConfirmRecurrence) await onConfirmRecurrence(key);
              else {
                await hook.confirmRecurrence(key);
                hook.dismiss(activeInsight.themeKey);
              }
            });
          }}
          onIgnoreRecurrence={(reason) => void handleIgnoreRecurrence(reason)}
          onConfirmIncome={() => {
            const p = activeInsight.primaryAction?.payload as
              | { name: string; valueCents: number; categoryId: string; date?: string }
              | undefined;
            if (!p) return;
            void runWithSubmitting(() =>
              onConfirmIncome ? Promise.resolve(onConfirmIncome(p)) : hook.confirmIncome(p),
            );
          }}
          onConfirmExpense={() => {
            const p = activeInsight.primaryAction?.payload as
              | { name: string; valueCents: number; categoryId: string; date?: string; forma?: string; cardId?: string }
              | undefined;
            if (!p) return;
            void runWithSubmitting(() =>
              onConfirmExpense ? Promise.resolve(onConfirmExpense(p)) : hook.confirmExpense(p),
            );
          }}
          onActionClick={() => {
            const route = resolveSmartAdvisorActionRoute(activeInsight, window.location.search);
            if (route) navigate?.(route);
          }}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}
