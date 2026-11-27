import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import type { CashGapAnalysisResult } from "@/domain/projection";
import { AlertCarouselCard } from "./alert-carousel-card";

export interface CashGapAlertProps {
  result: CashGapAnalysisResult;
  calculationBreakdown?: CalculationBreakdown;
  className?: string;
  onResolve?: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

/**
 * Radar Preditivo de Descasamento de Fluxo (Cash-Gap Alert) — FASE 51 / Fase 3.
 *
 * Alerta antecipadamente o usuário sobre risco de saldo bancário insuficiente
 * antes da data de entrada do salário/recebimentos, com Memória de Cálculo (?).
 */
export function CashGapAlert({
  result,
  calculationBreakdown,
  className,
  onResolve,
  onDismiss,
  onSelectPreset,
}: CashGapAlertProps) {
  const navigate = useNavigate();

  if (!result.isCashGapDetected || result.severity === "none") {
    return null;
  }

  const isCritical = result.severity === "critical";
  const policy = resolveCarouselCardPolicy("cashflow.cash_gap");

  const handleAction = () => {
    if (onResolve) {
      onResolve();
    } else {
      navigate("/dividas?type=payable");
    }
  };

  const title = isCritical
    ? "Atenção: saldo pode ficar negativo"
    : "Fluxo de caixa apertado";

  return (
    <AlertCarouselCard
      id="cashflow.cash_gap"
      tone={isCritical ? "critical" : "warning"}
      role={isCritical ? "alert" : "region"}
      ariaLabel="Alerta de descasamento de fluxo"
      className={className}
      icon={
        isCritical ? (
          <ShieldAlert className="size-4.5" />
        ) : (
          <AlertTriangle className="size-4.5" />
        )
      }
      title={title}
      badge={
        <Badge variant={isCritical ? "critical" : "warning"} size="xs">
          Déficit de{" "}
          <MoneyText
            cents={result.maxDeficitCents}
            tone="default"
            className="font-semibold"
          />
        </Badge>
      }
      description={result.recommendationMessage ?? ""}
      descriptionText={result.recommendationMessage ?? undefined}
      calculationBreakdown={calculationBreakdown}
      calculationMemoryLabel="Memória de cálculo do descasamento de caixa"
      primaryAction={{
        label: "Ver Contas e Vencimentos",
        onClick: handleAction,
        variant: isCritical ? "destructive" : "warning",
        icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar alerta de descasamento de fluxo",
            }
          : undefined
      }
    />
  );
}
