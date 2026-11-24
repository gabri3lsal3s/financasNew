import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { SmartAdvisorCardSkeleton } from "@/components/modules/smart-advisor-card-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildSmartAdvisorBreakdown } from "@/domain/calculation-memory/builders/insights-breakdown";
import type { SmartAdvisorCardContext, SmartAdvisorInsight } from "@/domain/insights/advisor";
import { resolveInsightThemeFamily } from "@/domain/insights/attention-budget";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { pushToast } from "@/services/toast";
import { SmartAdvisorCardFooter } from "./smart-advisor-card-footer";
import { SmartAdvisorCardHeader } from "./smart-advisor-card-header";
import { AdvisorCategoryIcon } from "./smart-advisor-category-icon";
import {
  resolveSmartAdvisorActionRoute,
  resolveSmartAdvisorPresentation,
  type SmartAdvisorPresentation,
} from "./smart-advisor-routing";

const CAROUSEL_ICON_TONES: Record<SmartAdvisorPresentation["badgeVariant"], string> = {
  critical: "bg-critical/10 border-critical/20 text-critical-strong",
  warning: "bg-warning/15 border-warning/20 text-warning-strong",
  positive: "bg-positive/10 border-positive/20 text-positive-strong",
  portfolio: "bg-portfolio/10 border-portfolio/20 text-portfolio",
  muted: "bg-primary/10 border-primary/20 text-primary-strong",
};

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
  suppressedThemeKeys?: readonly string[];
  embeddedInCarousel?: boolean;
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
  suppressedThemeKeys,
  embeddedInCarousel = false,
}: SmartAdvisorCardProps) {
  const navigate = useNavigate();
  const isCurrentMonth = month ? month === currentMonth() : true;
  const hook = useSmartAdvisorInsights({
    month,
    enabled: controlledInsight === undefined && isCurrentMonth,
    savingsSurplusCents,
    safeToSpendCents,
    committedObligationsCents,
    suppressedThemeKeys,
  });

  const activeInsight = controlledInsight !== undefined ? controlledInsight : hook.insight;
  const currentIndex = controlledCurrentIndex ?? hook.currentIndex;
  const totalCount = controlledTotalCount ?? hook.totalCount;
  const cardContext = controlledCardContext ?? activeInsight?.cardContext ?? activeInsight?.metadata?.cardContext;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const breakdown = useMemo(() => {
    if (!activeInsight) return undefined;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return buildSmartAdvisorBreakdown(activeInsight, {
      referenceMonthLabel: month,
      dayOfMonth,
      daysInMonth,
    });
  }, [activeInsight, month]);

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

  const handleDismiss = (days?: 7 | 30) => {
    const resolvedDays = days ?? 30;
    if (onDismiss) {
      if (days !== undefined) onDismiss(activeInsight.themeKey, days);
      else onDismiss(activeInsight.themeKey);
    } else if (days !== undefined) {
      hook.dismiss(activeInsight.themeKey, days);
    } else {
      hook.dismiss(activeInsight.themeKey);
    }
    pushToast({
      title: "Sugestão dispensada",
      description:
        resolvedDays === 7
          ? "Esta recomendação foi pausada por 7 dias."
          : "Esta recomendação foi pausada e reaparecerá após 30 dias.",
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
    if (reason === "essential") {
      return handleMarkEssential().then(() => {
        if (onDismiss) onDismiss(activeInsight.themeKey);
        else hook.dismiss(activeInsight.themeKey);
      });
    }
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

  const handleConfirmRecurrenceAction = () => {
    const p = activeInsight.primaryAction?.payload as { key?: string } | undefined;
    const key = p?.key ?? activeInsight.themeKey.replace(/^calib:/, "");
    void runWithSubmitting(async () => {
      if (onConfirmRecurrence) await onConfirmRecurrence(key);
      else {
        await hook.confirmRecurrence(key);
        hook.dismiss(activeInsight.themeKey);
      }
    });
  };

  const handleConfirmIncomeAction = () => {
    const p = activeInsight.primaryAction?.payload as
      | { name: string; valueCents: number; categoryId: string; date?: string }
      | undefined;
    if (!p) return;
    void runWithSubmitting(() =>
      onConfirmIncome ? Promise.resolve(onConfirmIncome(p)) : hook.confirmIncome(p),
    );
  };

  const handleConfirmExpenseAction = () => {
    const p = activeInsight.primaryAction?.payload as
      | { name: string; valueCents: number; categoryId: string; date?: string; forma?: string; cardId?: string }
      | undefined;
    if (!p) return;
    void runWithSubmitting(() =>
      onConfirmExpense ? Promise.resolve(onConfirmExpense(p)) : hook.confirmExpense(p),
    );
  };

  const handleMarkTxOneOff = () => {
    const p = activeInsight.primaryAction?.payload as
      | { occurrenceKey?: string; name?: string }
      | undefined;
    const key = p?.occurrenceKey ?? activeInsight.themeKey.replace(/^calib_tx:/, "tx_one_off:");
    void runWithSubmitting(async () => {
      await hook.markTxOneOff(key, p?.name ?? activeInsight.title);
      hook.dismiss(activeInsight.themeKey);
    });
  };

  const activeFamily = resolveInsightThemeFamily(activeInsight.themeKey);
  const canPauseFamily = (hook.decayByFamily?.[activeFamily]?.dismissCount ?? 0) >= 2;
  const handlePauseFamily = () => {
    hook.muteFamily(activeInsight.themeKey);
    pushToast({
      title: "Tema pausado",
      description: "Você pode reativar este tema a qualquer momento na Memória do Copiloto.",
      variant: "default",
    });
  };

  const handlePrimaryActionClick = () => {
    const route = resolveSmartAdvisorActionRoute(activeInsight, window.location.search);
    if (route) navigate?.(route);
  };

  if (embeddedInCarousel) {
    return (
      <div
        role="region"
        aria-label="Assistente Proativo de Insights"
        className={cn(
          "relative group w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all motion-reduce:transition-none",
          className,
        )}
      >
        <div
          key={activeInsight.id}
          data-testid="smart-advisor-content-body"
          className="flex items-start sm:items-center gap-3 min-w-0 pr-8 sm:pr-0 flex-1 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transition-none"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              CAROUSEL_ICON_TONES[presentation.badgeVariant],
            )}
            aria-hidden="true"
          >
            <AdvisorCategoryIcon kind={presentation.iconKind} sizeClass="size-4.5" inheritColor />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
                {activeInsight.title}
              </h3>
              <Badge variant={presentation.badgeVariant} size="xs" className="shrink-0 font-medium">
                {presentation.badgeLabel}
              </Badge>
              {breakdown ? (
                <CalculationMemoryModal
                  breakdown={breakdown}
                  label={`Memória de cálculo de ${presentation.badgeLabel}`}
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-1 break-words">
              {activeInsight.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
          <SmartAdvisorCardFooter
            insight={activeInsight}
            cardContext={cardContext}
            isSubmitting={isSubmitting}
            hasExternalConfirmRecurrence={Boolean(onConfirmRecurrence)}
            hasExternalConfirmIncome={Boolean(onConfirmIncome)}
            hasExternalConfirmExpense={Boolean(onConfirmExpense)}
            onConfirmRecurrence={handleConfirmRecurrenceAction}
            onIgnoreRecurrence={(reason) => void handleIgnoreRecurrence(reason)}
            onMarkTxOneOff={handleMarkTxOneOff}
            onPauseFamily={handlePauseFamily}
            canPauseFamily={canPauseFamily}
            onConfirmIncome={handleConfirmIncomeAction}
            onConfirmExpense={handleConfirmExpenseAction}
            onActionClick={handlePrimaryActionClick}
            onDismiss={() => handleDismiss()}
            embeddedInCarousel
          />

          {isTopSavingsEssential ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Manter como essencial"
              title="Manter como essencial"
              sensoryIntent={onMarkEssential ? "action" : false}
              onClick={() => void handleMarkEssential()}
              disabled={isSubmitting}
              className="relative h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Manter como essencial</span>
              <span className="sr-only sm:hidden">Manter como essencial</span>
            </Button>
          ) : (
            <div className="absolute top-3 right-3 sm:static">
              <CarouselDismissPopover
                onDismiss={(days) => handleDismiss(days)}
                label="Dispensar sugestão"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Assistente Proativo de Insights"
      className={cn(
        "group w-full flex flex-col justify-between gap-3 min-h-[148px] sm:min-h-[140px] rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all motion-reduce:transition-none",
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
        onDismiss={(days) => handleDismiss(days)}
        hasExternalMarkEssential={Boolean(onMarkEssential)}
        breakdown={breakdown}
        embeddedInCarousel={false}
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
          onConfirmRecurrence={handleConfirmRecurrenceAction}
          onIgnoreRecurrence={(reason) => void handleIgnoreRecurrence(reason)}
          onMarkTxOneOff={handleMarkTxOneOff}
          onPauseFamily={handlePauseFamily}
          canPauseFamily={canPauseFamily}
          onConfirmIncome={handleConfirmIncomeAction}
          onConfirmExpense={handleConfirmExpenseAction}
          onActionClick={handlePrimaryActionClick}
          onDismiss={() => handleDismiss()}
        />
      </div>
    </div>
  );
}
