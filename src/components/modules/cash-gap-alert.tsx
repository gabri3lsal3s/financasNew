import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import type { CashGapAnalysisResult } from "@/domain/projection";
import { cn } from "@/lib/utils";

export interface CashGapAlertProps {
  result: CashGapAnalysisResult;
  className?: string;
  onResolve?: () => void;
}

/**
 * Radar Preditivo de Descasamento de Fluxo (Cash-Gap Alert) — FASE 51.
 *
 * Alerta antecipadamente o usuário sobre risco de saldo bancário insuficiente
 * antes da data de entrada do salário/recebimentos.
 */
export function CashGapAlert({ result, className, onResolve }: CashGapAlertProps) {
  const navigate = useNavigate();

  if (!result.isCashGapDetected || result.severity === "none") {
    return null;
  }

  const isCritical = result.severity === "critical";

  const handleAction = () => {
    if (onResolve) {
      onResolve();
    } else {
      navigate("/dividas");
    }
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 sm:p-5 shadow-xs transition-all",
        isCritical
          ? "border-critical/40 bg-critical/5 text-foreground"
          : "border-warning/40 bg-warning/5 text-foreground",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border mt-0.5",
              isCritical
                ? "bg-critical/10 border-critical/20 text-critical-strong"
                : "bg-warning/10 border-warning/20 text-warning-strong",
            )}
            aria-hidden="true"
          >
            {isCritical ? <ShieldAlert className="size-4.5" /> : <AlertTriangle className="size-4.5" />}
          </span>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">
                {isCritical ? "Alerta de Iminência de Saldo Insuficiente" : "Radar de Descasamento de Fluxo"}
              </h3>
              <Badge
                variant={isCritical ? "critical" : "warning"}
                size="xs"
              >
                Déficit de <MoneyText cents={result.maxDeficitCents} tone="default" className="text-[10px] font-semibold" />
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {result.recommendationMessage}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant={isCritical ? "destructive" : "outline"}
          size="sm"
          onClick={handleAction}
          className="gap-1.5 text-xs h-8 shrink-0 self-end sm:self-center font-medium"
        >
          <span>Ver Contas e Vencimentos</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
