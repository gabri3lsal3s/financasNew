import { useNavigate } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import type { SurplusAllocationIntent } from "@/domain/overview";
import { cn } from "@/lib/utils";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

export interface SurplusAporteBannerProps {
  surplusCents: number;
  allocationIntent?: SurplusAllocationIntent;
  emergencyMonthsCovered?: number | null;
  emergencyTargetMonths?: 3 | 6 | 12;
  className?: string;
  onSimulate?: () => void;
  onReinforceReserve?: () => void;
  onDismiss?: (days: 7 | 30) => void;
}

/**
 * Banner proativo de Sobra de Caixa (§F50 / Fase 3):
 *   - `emergency_fund`: prioriza liquidez quando a Reserva de Emergência estiver abaixo da meta;
 *   - `portfolio_aporte`: orienta aporte de rebalanceamento na carteira quando a reserva está completa ou externa.
 */
export function SurplusAporteBanner({
  surplusCents,
  allocationIntent = "portfolio_aporte",
  emergencyMonthsCovered = null,
  emergencyTargetMonths = 6,
  className,
  onSimulate,
  onReinforceReserve,
  onDismiss,
}: SurplusAporteBannerProps) {
  const navigate = useNavigate();

  if (surplusCents <= 0) return null;

  const isEmergencyPriority = allocationIntent === "emergency_fund";

  const handleAction = () => {
    if (isEmergencyPriority) {
      if (onReinforceReserve) onReinforceReserve();
      else navigate("/insights?aba=projection");
      return;
    }
    if (onSimulate) onSimulate();
    else navigate(`/investments?tab=aporte&valor=${surplusCents}`);
  };

  const reserveBadgeLabel =
    emergencyMonthsCovered !== null && Number.isFinite(emergencyMonthsCovered)
      ? `${emergencyMonthsCovered.toFixed(1).replace(".", ",")}m / ${emergencyTargetMonths}m`
      : "Prioridade";

  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            isEmergencyPriority
              ? "bg-positive/10 border-positive/20 text-positive-strong"
              : "bg-portfolio/10 border-portfolio/20 text-portfolio",
          )}
          aria-hidden="true"
        >
          {isEmergencyPriority ? <ShieldCheck className="size-4.5" /> : <Sparkles className="size-4.5" />}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {isEmergencyPriority ? "Reforçar Reserva de Emergência" : "Capacidade de Aporte Estimada"}
            </h2>
            <Badge variant={isEmergencyPriority ? "positive" : "portfolio"} size="xs">
              {isEmergencyPriority ? reserveBadgeLabel : "Disponível"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-1 break-words">
            {isEmergencyPriority ? (
              <>
                Você tem{" "}
                <MoneyText cents={surplusCents} tone="positive" className="font-semibold text-foreground" />{" "}
                livres no ciclo para fortalecer sua liquidez de segurança.
              </>
            ) : (
              <>
                Sobra calculada de{" "}
                <MoneyText cents={surplusCents} tone="portfolio" className="font-semibold text-foreground" />{" "}
                disponível para aporte na carteira.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant={isEmergencyPriority ? "positive" : "portfolio"}
          size="sm"
          onClick={handleAction}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer flex-1 sm:flex-initial justify-center"
        >
          <span>{isEmergencyPriority ? "Ver Reserva" : "Simular Aporte"}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover
              onDismiss={onDismiss}
              label={
                isEmergencyPriority
                  ? "Dispensar aviso de reforço da reserva"
                  : "Dispensar aviso de capacidade de aporte"
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
