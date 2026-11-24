import { Check, ChevronRight, CreditCard, X } from "lucide-react";
import { QualifiedDismissPopover } from "@/components/modules/qualified-dismiss-popover";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import type { SmartAdvisorCardContext, SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { cn } from "@/lib/utils";

export interface SmartAdvisorCardFooterProps {
  insight: SmartAdvisorInsight;
  cardContext?: SmartAdvisorCardContext;
  isSubmitting: boolean;
  hasExternalConfirmRecurrence: boolean;
  hasExternalConfirmIncome: boolean;
  hasExternalConfirmExpense: boolean;
  onConfirmRecurrence: () => void;
  onIgnoreRecurrence: (reason: CalibrationDecision) => void;
  onMarkTxOneOff?: () => void;
  onPauseFamily?: () => void;
  canPauseFamily?: boolean;
  onConfirmIncome: () => void;
  onConfirmExpense: () => void;
  onActionClick: () => void;
  onDismiss: () => void;
  embeddedInCarousel?: boolean;
}

/**
 * Rodapé de ações 1-toque e contexto de fatura/cartão do SmartAdvisor.
 */
export function SmartAdvisorCardFooter({
  insight,
  cardContext,
  isSubmitting,
  hasExternalConfirmRecurrence,
  hasExternalConfirmIncome,
  hasExternalConfirmExpense,
  onConfirmRecurrence,
  onIgnoreRecurrence,
  onMarkTxOneOff,
  onPauseFamily,
  canPauseFamily = false,
  onConfirmIncome,
  onConfirmExpense,
  onActionClick,
  onDismiss,
  embeddedInCarousel = false,
}: SmartAdvisorCardFooterProps) {
  const isSavingsAction =
    insight.category === "savings" &&
    (insight.primaryAction?.kind === "cut_subscription" ||
      insight.primaryAction?.kind === "set_category_budget");
  const isTxOneOffCalibration = insight.primaryAction?.kind === "mark_tx_one_off";

  return (
    <>
      <div
        className={
          embeddedInCarousel
            ? "flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap [&>button]:flex-1 [&>button]:sm:flex-initial"
            : "flex flex-wrap items-center gap-2 pt-0.5"
        }
      >
        {isTxOneOffCalibration ? (
          <>
            <Button
              size="sm"
              variant="default"
              sensoryIntent={false}
              onClick={onMarkTxOneOff}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer shrink-0"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{insight.primaryAction?.label ?? "Sim, foi pontual"}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              sensoryIntent="action"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            >
              <span>{insight.secondaryAction?.label ?? "Manter na rotina"}</span>
            </Button>
          </>
        ) : insight.category === "calibration" ? (
          <>
            <Button
              size="sm"
              variant="default"
              sensoryIntent={hasExternalConfirmRecurrence ? "success" : false}
              onClick={onConfirmRecurrence}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer shrink-0"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Sim, monitorar</span>
            </Button>
            <QualifiedDismissPopover
              occurrenceName={insight.title}
              averageCents={insight.metadata?.valueCents}
              onSelectReason={onIgnoreRecurrence}
            >
              <Button
                size="sm"
                variant="ghost"
                sensoryIntent="action"
                disabled={isSubmitting}
                className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                <span>Não, foi pontual</span>
              </Button>
            </QualifiedDismissPopover>
          </>
        ) : isSavingsAction && insight.primaryAction ? (
          <>
            <Button
              size="sm"
              variant="default"
              sensoryIntent="selection"
              onClick={onActionClick}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 cursor-pointer"
            >
              <span>{insight.primaryAction.label}</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              sensoryIntent="action"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Dispensar</span>
            </Button>
          </>
        ) : insight.primaryAction?.kind === "confirm_expense" ? (
          <Button
            size="sm"
            variant="default"
            sensoryIntent={hasExternalConfirmExpense ? "success" : false}
            onClick={onConfirmExpense}
            disabled={isSubmitting}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{insight.primaryAction.label}</span>
          </Button>
        ) : insight.category === "income" && insight.primaryAction?.kind === "confirm_income" ? (
          <Button
            size="sm"
            sensoryIntent={hasExternalConfirmIncome ? "success" : false}
            onClick={onConfirmIncome}
            disabled={isSubmitting}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{insight.primaryAction.label}</span>
          </Button>
        ) : insight.primaryAction ? (
          <Button
            size="sm"
            variant="default"
            sensoryIntent="selection"
            onClick={onActionClick}
            disabled={isSubmitting}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <span>{insight.primaryAction.label}</span>
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}

        {canPauseFamily && onPauseFamily ? (
          <Button
            size="sm"
            variant="ghost"
            sensoryIntent="action"
            onClick={onPauseFamily}
            disabled={isSubmitting}
            className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Pausar este tema
          </Button>
        ) : null}
      </div>

      {!embeddedInCarousel && cardContext ? (
        <div
          data-testid="smart-advisor-card-context"
          className={cn(
            "flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/80 text-xs",
            cardContext.exceedsAvailableLimit
              ? "text-critical-strong font-medium"
              : cardContext.isSeverelyCompromised
                ? "text-warning-strong font-medium"
                : "text-muted-foreground",
          )}
        >
          <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Previsto na fatura {cardContext.cardName}</span>
          <span aria-hidden="true">·</span>
          {cardContext.availableLimitCents !== null ? (
            <>
              <span className="whitespace-nowrap">
                Limite restante:{" "}
                <MoneyText
                  cents={cardContext.availableLimitCents}
                  className={cn(
                    "tabular-nums tracking-tight whitespace-nowrap inline font-medium",
                    cardContext.exceedsAvailableLimit
                      ? "text-critical-strong"
                      : cardContext.isSeverelyCompromised
                        ? "text-warning-strong"
                        : "text-foreground",
                  )}
                />
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span className="whitespace-nowrap">
            {cardContext.closingLabel ??
              (cardContext.daysUntilClosing === 1
                ? "Fecha em 1 dia"
                : `Fecha em ${cardContext.daysUntilClosing} dias`)}
          </span>
          {cardContext.orientationMessage ? (
            <span className="w-full sm:w-auto text-[11px] block sm:inline">
              · {cardContext.orientationMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
