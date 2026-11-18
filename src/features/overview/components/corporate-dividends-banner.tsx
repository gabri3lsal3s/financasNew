import { Coins } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";

export interface CorporateDividendsBannerProps {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  onInspect: () => void;
}

/**
 * Banner de alerta do carrossel para proventos disponíveis ou provisionados na corretora.
 */
export function CorporateDividendsBanner({
  availableCount,
  projectedCount,
  totalAvailableAmount,
  totalProjectedAmount,
  onInspect,
}: CorporateDividendsBannerProps) {
  const hasAvailable = availableCount > 0;

  return (
    <div
      role="alert"
      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
    >
      <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/20 bg-portfolio/10 text-portfolio">
          <Coins className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              {hasAvailable ? "Proventos Creditados na Corretora" : "Proventos Previstos no Mês"}
            </span>
            <Badge variant="muted" size="xs" className="shrink-0">
              {hasAvailable
                ? `${availableCount} ${availableCount === 1 ? "disponível" : "disponíveis"}`
                : "PROVISIONADO"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {hasAvailable ? (
              <>
                {availableCount} proventos disponíveis totalizando{" "}
                <MoneyText cents={numberToCents(totalAvailableAmount)} className="font-semibold" />.
              </>
            ) : (
              <>
                {projectedCount} proventos previstos totalizando{" "}
                <MoneyText cents={numberToCents(totalProjectedAmount)} className="font-semibold" />.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          onClick={onInspect}
          className="shrink-0 w-full sm:w-auto font-semibold cursor-pointer"
        >
          Conferir
        </Button>
      </div>
    </div>
  );
}
