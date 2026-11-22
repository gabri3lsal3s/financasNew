import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import type { CashGapAnalysisResult } from "@/domain/projection";
import { cn } from "@/lib/utils";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

export interface CashGapAlertProps {
  result: CashGapAnalysisResult;
  className?: string;
  onResolve?: () => void;
  onDismiss?: (days: 7 | 30) => void;
}

/**
 * Radar Preditivo de Descasamento de Fluxo (Cash-Gap Alert) — FASE 51.
 *
 * Alerta antecipadamente o usuário sobre risco de saldo bancário insuficiente
 * antes da data de entrada do salário/recebimentos.
 */
export function CashGapAlert({ result, className, onResolve, onDismiss }: CashGapAlertProps) {
  const navigate = useNavigate();

  if (!result.isCashGapDetected || result.severity === "none") {
    return null;
  }

  const isCritical = result.severity === "critical";

  const handleAction = () => {
    if (onResolve) {
      onResolve();
    } else {
      navigate("/dividas?type=payable");
    }
  };

  return (
    <div
      role={isCritical ? "alert" : "region"}
      aria-label="Alerta de descasamento de fluxo"
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all",
        isCritical
          ? "border-critical/40 bg-critical/5 text-foreground"
          : "border-warning/40 bg-warning/5 text-foreground",
        className,
      )}
    >
      <div className={cn("flex items-start sm:items-center gap-3 min-w-0 flex-1", onDismiss && "pr-6 sm:pr-0")}>
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              isCritical
                ? "bg-critical/10 border-critical/20 text-critical-strong"
                : "bg-warning/15 border-warning/20 text-warning-strong",
            )}
            aria-hidden="true"
          >
            {isCritical ? <ShieldAlert className="size-4.5" /> : <AlertTriangle className="size-4.5" />}
          </span>

          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground truncate">
                {isCritical ? "Atenção: saldo pode ficar negativo" : "Fluxo de caixa apertado"}
              </h2>
              <Badge
                variant={isCritical ? "critical" : "warning"}
                size="xs"
              >
                Déficit de <MoneyText cents={result.maxDeficitCents} tone="default" className="text-[10px] font-semibold" />
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-1 break-words">
              {result.recommendationMessage}
            </p>
          </div>
        </div>

      <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          variant={isCritical ? "destructive" : "warning"}
          size="sm"
          onClick={handleAction}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer flex-1 sm:flex-initial justify-center"
        >
          <span>Ver Contas e Vencimentos</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover
              onDismiss={onDismiss}
              label="Dispensar alerta de descasamento de fluxo"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
