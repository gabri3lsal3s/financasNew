import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { useCarouselPauseLock } from "@/components/modules/carousel-pause-context";
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

const NOOP = () => {};

export interface SmartAdvisorDismissOptions {
  isResolution?: boolean;
}

export interface SmartAdvisorCardProps {
  className?: string;
  month?: string;
  insight?: SmartAdvisorInsight | null;
  cardContext?: SmartAdvisorCardContext;
  currentIndex?: number;
  totalCount?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onDismiss?: (themeKey?: string, days?: number, options?: SmartAdvisorDismissOptions) => void;
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
  onMarkTxOneOff?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  onPauseFamily?: (themeKey: string) => void;
  canPauseFamily?: boolean;
  savingsSurplusCents?: number;
  safeToSpendCents?: number;
  committedObligationsCents?: number;
  suppressedThemeKeys?: readonly string[];
  embeddedInCarousel?: boolean;
}

interface SmartAdvisorCardViewProps {
  className?: string;
  month?: string;
  activeInsight: SmartAdvisorInsight;
  cardContext?: SmartAdvisorCardContext;
  currentIndex: number;
  totalCount: number;
  onNext?: () => void;
  onPrev?: () => void;
  onDismiss: (themeKey?: string, days?: number, options?: SmartAdvisorDismissOptions) => void;
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
  onMarkTxOneOff?: (occurrenceKey: string, displayName?: string) => void | Promise<void>;
  onPauseFamily?: (themeKey: string) => void;
  canPauseFamily: boolean;
  embeddedInCarousel: boolean;
}

/**
 * Apresentação pura do microcard de insights (zero hooks de fetch — evita queries duplicadas em carrosséis e clones).
 */
function SmartAdvisorCardView({
  className,
  month,
  activeInsight,
  cardContext: controlledCardContext,
  currentIndex,
  totalCount,
  onNext = NOOP,
  onPrev = NOOP,
  onDismiss,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onMarkEssential,
  onConfirmIncome,
  onConfirmExpense,
  onMarkTxOneOff,
  onPauseFamily,
  canPauseFamily,
  embeddedInCarousel,
}: SmartAdvisorCardViewProps) {
  const navigate = useNavigate();
  const cardContext =
    controlledCardContext ?? activeInsight.cardContext ?? activeInsight.metadata?.cardContext;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  useCarouselPauseLock(Boolean(embeddedInCarousel && memoryOpen), "smart-advisor-memory");

  const breakdown = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return buildSmartAdvisorBreakdown(activeInsight, {
      referenceMonthLabel: month,
      dayOfMonth,
      daysInMonth,
    });
  }, [activeInsight, month]);

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
    if (days !== undefined) onDismiss(activeInsight.themeKey, days);
    else onDismiss(activeInsight.themeKey);
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
    if (!onMarkEssential) return Promise.resolve();
    const payload = (activeInsight.secondaryAction?.payload ?? activeInsight.primaryAction?.payload) as
      | { key?: string; name?: string }
      | undefined;
    const key = payload?.key ?? activeInsight.themeKey.replace(/^(savings:|calib:|price_adj:)/, "");
    const displayName = payload?.name ?? activeInsight.title;
    return runWithSubmitting(async () => {
      await onMarkEssential(key, displayName);
    });
  };

  const handleIgnoreRecurrence = (reason: CalibrationDecision = "one_off") => {
    if (reason === "essential") {
      return handleMarkEssential().then(() => {
        onDismiss(activeInsight.themeKey, undefined, { isResolution: true });
      });
    }
    if (!onIgnoreRecurrence) return Promise.resolve();
    const payload = activeInsight.secondaryAction?.payload as { key?: string } | undefined;
    const key = payload?.key ?? activeInsight.themeKey.replace(/^calib:/, "");
    return runWithSubmitting(async () => {
      await onIgnoreRecurrence(key, reason);
    });
  };

  const isTopSavingsEssential =
    activeInsight.category === "savings" &&
    (activeInsight.primaryAction?.kind === "cut_subscription" ||
      activeInsight.primaryAction?.kind === "set_category_budget");

  const handleConfirmRecurrenceAction = () => {
    if (!onConfirmRecurrence) return;
    const p = activeInsight.primaryAction?.payload as { key?: string } | undefined;
    const key = p?.key ?? activeInsight.themeKey.replace(/^calib:/, "");
    void runWithSubmitting(async () => {
      await onConfirmRecurrence(key);
    });
  };

  const handleConfirmIncomeAction = () => {
    if (!onConfirmIncome) return;
    const p = activeInsight.primaryAction?.payload as
      | { name: string; valueCents: number; categoryId: string; date?: string }
      | undefined;
    if (!p) return;
    void runWithSubmitting(() => Promise.resolve(onConfirmIncome(p)));
  };

  const handleConfirmExpenseAction = () => {
    if (!onConfirmExpense) return;
    const p = activeInsight.primaryAction?.payload as
      | { name: string; valueCents: number; categoryId: string; date?: string; forma?: string; cardId?: string }
      | undefined;
    if (!p) return;
    void runWithSubmitting(() => Promise.resolve(onConfirmExpense(p)));
  };

  const handleMarkTxOneOff = () => {
    if (!onMarkTxOneOff) return;
    const p = activeInsight.primaryAction?.payload as
      | { occurrenceKey?: string; name?: string }
      | undefined;
    const key = p?.occurrenceKey ?? activeInsight.themeKey.replace(/^calib_tx:/, "tx_one_off:");
    void runWithSubmitting(async () => {
      await onMarkTxOneOff(key, p?.name ?? activeInsight.title);
      onDismiss(activeInsight.themeKey, undefined, { isResolution: true });
    });
  };

  const handlePauseFamily = () => {
    onPauseFamily?.(activeInsight.themeKey);
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
          "relative group w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all motion-reduce:transition-none",
          className,
        )}
      >
        <div
          key={activeInsight.id}
          data-testid="smart-advisor-content-body"
          className="flex items-start sm:items-center gap-3 min-w-0 pr-9 sm:pr-0 flex-1 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transition-none"
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
              <h3
                className="text-sm font-semibold text-foreground tracking-tight line-clamp-2 break-words"
                title={activeInsight.title}
              >
                {activeInsight.title}
              </h3>
              <Badge variant={presentation.badgeVariant} size="xs" className="shrink-0 font-medium">
                {presentation.badgeLabel}
              </Badge>
              {breakdown ? (
                <CalculationMemoryModal
                  breakdown={breakdown}
                  label={`Memória de cálculo de ${presentation.badgeLabel}`}
                  priority="p0"
                  open={memoryOpen}
                  onOpenChange={setMemoryOpen}
                />
              ) : null}
            </div>
            <p
              className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words"
              title={activeInsight.description}
            >
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
        onPrev={onPrev}
        onNext={onNext}
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

/**
 * Wrapper autônomo quando SmartAdvisorCard é montado sem `insight` controlado.
 */
function SmartAdvisorCardStandalone(props: SmartAdvisorCardProps) {
  const {
    className,
    month,
    cardContext,
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
    onMarkTxOneOff,
    onPauseFamily,
    canPauseFamily,
    savingsSurplusCents,
    safeToSpendCents,
    committedObligationsCents,
    suppressedThemeKeys,
    embeddedInCarousel = false,
  } = props;

  const isCurrentMonth = month ? month === currentMonth() : true;
  const hook = useSmartAdvisorInsights({
    month,
    enabled: isCurrentMonth,
    savingsSurplusCents,
    safeToSpendCents,
    committedObligationsCents,
    suppressedThemeKeys,
  });

  if (!isCurrentMonth) return null;
  if (hook.isLoading) return <SmartAdvisorCardSkeleton className={className} />;
  if (!hook.insight) return null;

  const activeInsight = hook.insight;
  const activeFamily = resolveInsightThemeFamily(activeInsight.themeKey);
  const resolvedCanPauseFamily =
    canPauseFamily ?? (hook.decayByFamily?.[activeFamily]?.dismissCount ?? 0) >= 2;

  return (
    <SmartAdvisorCardView
      className={className}
      month={month}
      activeInsight={activeInsight}
      cardContext={cardContext}
      currentIndex={controlledCurrentIndex ?? hook.currentIndex}
      totalCount={controlledTotalCount ?? hook.totalCount}
      onNext={onNext ?? hook.nextInsight}
      onPrev={onPrev ?? hook.prevInsight}
      onDismiss={onDismiss ?? hook.dismiss}
      onConfirmRecurrence={
        onConfirmRecurrence ??
        (async (key) => {
          await hook.confirmRecurrence(key);
          hook.dismiss(activeInsight.themeKey, undefined, { isResolution: true });
        })
      }
      onIgnoreRecurrence={
        onIgnoreRecurrence ??
        (async (key, reason) => {
          if (reason === "essential") {
            await hook.markAsEssential(key, activeInsight.title);
          } else {
            await hook.ignoreRecurrence(key, reason, { skipSensory: true });
          }
          hook.dismiss(activeInsight.themeKey, undefined, { isResolution: true });
        })
      }
      onMarkEssential={onMarkEssential ?? hook.markAsEssential}
      onConfirmIncome={onConfirmIncome ?? hook.confirmIncome}
      onConfirmExpense={onConfirmExpense ?? hook.confirmExpense}
      onMarkTxOneOff={onMarkTxOneOff ?? hook.markTxOneOff}
      onPauseFamily={onPauseFamily ?? hook.muteFamily}
      canPauseFamily={resolvedCanPauseFamily}
      embeddedInCarousel={embeddedInCarousel}
    />
  );
}

/**
 * Microcard do Assistente Proativo de Insights na Home (SmartAdvisor).
 */
export function SmartAdvisorCard(props: SmartAdvisorCardProps) {
  if (props.insight !== undefined) {
    const isCurrentMonth = props.month ? props.month === currentMonth() : true;
    if (!isCurrentMonth || !props.insight) return null;

    return (
      <SmartAdvisorCardView
        className={props.className}
        month={props.month}
        activeInsight={props.insight}
        cardContext={props.cardContext}
        currentIndex={props.currentIndex ?? 0}
        totalCount={props.totalCount ?? 1}
        onNext={props.onNext}
        onPrev={props.onPrev}
        onDismiss={props.onDismiss ?? (() => undefined)}
        onConfirmRecurrence={props.onConfirmRecurrence}
        onIgnoreRecurrence={props.onIgnoreRecurrence}
        onMarkEssential={props.onMarkEssential}
        onConfirmIncome={props.onConfirmIncome}
        onConfirmExpense={props.onConfirmExpense}
        onMarkTxOneOff={props.onMarkTxOneOff}
        onPauseFamily={props.onPauseFamily}
        canPauseFamily={props.canPauseFamily ?? false}
        embeddedInCarousel={props.embeddedInCarousel ?? false}
      />
    );
  }

  return <SmartAdvisorCardStandalone {...props} />;
}
