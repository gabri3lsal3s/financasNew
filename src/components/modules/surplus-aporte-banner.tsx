import { useNavigate } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import type { SurplusAllocationIntent } from "@/domain/overview";
import { AlertCarouselCard } from "./alert-carousel-card";

export interface SurplusAporteBannerProps {
  surplusCents: number;
  allocationIntent?: SurplusAllocationIntent;
  emergencyMonthsCovered?: number | null;
  emergencyTargetMonths?: 3 | 6 | 12;
  calculationBreakdown?: CalculationBreakdown;
  nextCycleInvoicesCents?: number;
  futureInvoicesCents?: number;
  className?: string;
  onSimulate?: () => void;
  onReinforceReserve?: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
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
  calculationBreakdown,
  nextCycleInvoicesCents = 0,
  futureInvoicesCents = 0,
  className,
  onSimulate,
  onReinforceReserve,
  onDismiss,
  onSelectPreset,
}: SurplusAporteBannerProps) {
  const navigate = useNavigate();

  if (surplusCents <= 0) return null;

  const isEmergencyPriority = allocationIntent === "emergency_fund";
  const policy = resolveCarouselCardPolicy("cashflow.surplus");

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
    <AlertCarouselCard
      id="cashflow.surplus"
      tone={isEmergencyPriority ? "positive" : "portfolio"}
      className={className}
      icon={
        isEmergencyPriority ? (
          <ShieldCheck className="size-4.5" />
        ) : (
          <Sparkles className="size-4.5" />
        )
      }
      title={
        isEmergencyPriority
          ? "Reforçar Reserva de Emergência"
          : "Capacidade de Aporte Estimada"
      }
      badge={{
        label: isEmergencyPriority ? reserveBadgeLabel : "Disponível",
        variant: isEmergencyPriority ? "positive" : "portfolio",
      }}
      description={
        isEmergencyPriority ? (
          nextCycleInvoicesCents > 0 ? (
            <>
              Você tem{" "}
              <MoneyText
                cents={surplusCents}
                tone="positive"
                className="font-semibold text-foreground"
              />{" "}
              livres no ciclo para reserva (com{" "}
              <MoneyText
                cents={nextCycleInvoicesCents}
                tone="default"
                className="font-medium text-foreground"
              />{" "}
              na próxima fatura de cartão).
            </>
          ) : futureInvoicesCents > 0 ? (
            <>
              Você tem{" "}
              <MoneyText
                cents={surplusCents}
                tone="positive"
                className="font-semibold text-foreground"
              />{" "}
              livres no ciclo para reserva (com{" "}
              <MoneyText
                cents={futureInvoicesCents}
                tone="default"
                className="font-medium text-foreground"
              />{" "}
              em faturas futuras).
            </>
          ) : (
            <>
              Você tem{" "}
              <MoneyText
                cents={surplusCents}
                tone="positive"
                className="font-semibold text-foreground"
              />{" "}
              livres no ciclo para fortalecer sua liquidez de segurança.
            </>
          )
        ) : nextCycleInvoicesCents > 0 ? (
          <>
            Sobra de{" "}
            <MoneyText
              cents={surplusCents}
              tone="portfolio"
              className="font-semibold text-foreground"
            />{" "}
            no ciclo para aporte (considere{" "}
            <MoneyText
              cents={nextCycleInvoicesCents}
              tone="default"
              className="font-medium text-foreground"
            />{" "}
            na próxima fatura de cartão).
          </>
        ) : futureInvoicesCents > 0 ? (
          <>
            Sobra de{" "}
            <MoneyText
              cents={surplusCents}
              tone="portfolio"
              className="font-semibold text-foreground"
            />{" "}
            no ciclo para aporte (considere{" "}
            <MoneyText
              cents={futureInvoicesCents}
              tone="default"
              className="font-medium text-foreground"
            />{" "}
            em faturas futuras).
          </>
        ) : (
          <>
            Sobra calculada de{" "}
            <MoneyText
              cents={surplusCents}
              tone="portfolio"
              className="font-semibold text-foreground"
            />{" "}
            disponível para aporte na carteira.
          </>
        )
      }
      calculationBreakdown={calculationBreakdown}
      primaryAction={{
        label: isEmergencyPriority ? "Ver Reserva" : "Simular Aporte",
        onClick: handleAction,
        variant: isEmergencyPriority ? "positive" : "portfolio",
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
              label: isEmergencyPriority
                ? "Dispensar aviso de reforço da reserva"
                : "Dispensar aviso de capacidade de aporte",
            }
          : undefined
      }
    />
  );
}
