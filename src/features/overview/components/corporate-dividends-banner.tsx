import { ChevronRight, Coins } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import { MoneyText } from "@/components/ui";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { numberToCents } from "@/domain/money";

export interface CorporateDividendsBannerProps {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  hasUncertainTax?: boolean;
  onInspect: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
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
  onSelectPreset,
}: CorporateDividendsBannerProps) {
  const hasAvailable = availableCount > 0;
  const cardKey = hasAvailable
    ? "portfolio.dividends_available"
    : "portfolio.dividends_projected";
  const policy = resolveCarouselCardPolicy(cardKey);

  return (
    <AlertCarouselCard
      id={cardKey}
      tone={hasAvailable && hasUncertainTax ? "warning" : "portfolio"}
      role="region"
      ariaLabel="Aviso de proventos"
      icon={<Coins className="size-4.5" />}
      title={hasAvailable ? "Proventos a Conferir" : "Proventos Provisionados"}
      badge={{
        label: hasAvailable
          ? hasUncertainTax
            ? "Conferir alíquota"
            : `${availableCount} ${availableCount === 1 ? "disponível" : "disponíveis"}`
          : "Provisionado",
        variant: hasAvailable && hasUncertainTax ? "warning" : "portfolio",
      }}
      description={
        hasAvailable ? (
          <>
            {availableCount}{" "}
            {availableCount === 1
              ? "provento disponível"
              : "proventos disponíveis"}{" "}
            totalizando{" "}
            <MoneyText
              cents={numberToCents(totalAvailableAmount)}
              variant="caption"
              tone="default"
              className="font-semibold"
            />
            {hasUncertainTax
              ? " (revise IR/tipo antes de aprovar)."
              : "."}
          </>
        ) : (
          <>
            {projectedCount}{" "}
            {projectedCount === 1 ? "provento previsto" : "proventos previstos"}{" "}
            totalizando{" "}
            <MoneyText
              cents={numberToCents(totalProjectedAmount)}
              variant="caption"
              tone="default"
              className="font-semibold"
            />
            .
          </>
        )
      }
      primaryAction={{
        label: hasAvailable && hasUncertainTax ? "Conferir e Aprovar" : "Conferir",
        onClick: onInspect,
        variant: "default",
        icon: <ChevronRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar aviso de proventos",
            }
          : undefined
      }
    />
  );
}
