import { ChevronRight, Coins } from "lucide-react";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export interface CorporateDividendsBannerProps {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  hasUncertainTax?: boolean;
  onInspect: () => void;
  onDismiss?: (days: 7 | 30) => void;
}

/**
 * Banner de alerta do carrossel para proventos disponíveis ou provisionados na corretora.
 */
export function CorporateDividendsBanner({
  availableCount,
  projectedCount,
  totalAvailableAmount,
  totalProjectedAmount,
  hasUncertainTax = false,
  onInspect,
  onDismiss,
}: CorporateDividendsBannerProps) {
  const hasAvailable = availableCount > 0;

  return (
    <div
      role="region"
      aria-label="Aviso de proventos"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className={cn("flex items-center gap-3 min-w-0", onDismiss && "pr-6 sm:pr-0")}>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            hasAvailable && hasUncertainTax
              ? "border-warning/20 bg-warning/15 text-warning-strong"
              : "border-portfolio/20 bg-portfolio/10 text-portfolio",
          )}
        >
          <Coins className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2
              className="text-sm font-semibold text-foreground truncate"
              title={hasAvailable ? "Proventos a Conferir" : "Proventos Provisionados"}
            >
              {hasAvailable ? "Proventos a Conferir" : "Proventos Provisionados"}
            </h2>
            <Badge
              variant={hasAvailable && hasUncertainTax ? "warning" : "portfolio"}
              size="xs"
              className="shrink-0"
            >
              {hasAvailable
                ? hasUncertainTax
                  ? "Conferir alíquota"
                  : `${availableCount} ${availableCount === 1 ? "disponível" : "disponíveis"}`
                : "Provisionado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
            {hasAvailable ? (
              <>
                {availableCount} {availableCount === 1 ? "provento disponível" : "proventos disponíveis"} totalizando{" "}
                <MoneyText cents={numberToCents(totalAvailableAmount)} variant="caption" tone="default" className="font-semibold" />
                {hasUncertainTax ? " (revise IR/tipo antes de aprovar)." : "."}
              </>
            ) : (
              <>
                {projectedCount} {projectedCount === 1 ? "provento previsto" : "proventos previstos"} totalizando{" "}
                <MoneyText cents={numberToCents(totalProjectedAmount)} variant="caption" tone="default" className="font-semibold" />.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          onClick={onInspect}
          className="shrink-0 flex-1 sm:flex-initial justify-center font-semibold cursor-pointer gap-1.5"
        >
          <span>{hasAvailable && hasUncertainTax ? "Conferir e Aprovar" : "Conferir"}</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover
              onDismiss={onDismiss}
              label="Dispensar aviso de proventos"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
