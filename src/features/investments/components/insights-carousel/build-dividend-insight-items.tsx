import { CalendarClock, Coins, Loader2 } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { MoneyText } from "@/components/ui/money-text";
import {
  buildDividendCarouselBreakdown,
  type DividendEvidenceItem,
} from "@/domain/calculation-memory/builders/portfolio-carousel-breakdown";
import { todaySaoPauloISO } from "@/domain/portfolio";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export function buildDividendInsightItems({
  availableCount,
  projectedCount,
  totalAvailableAmount,
  totalProjectedAmount,
  availableItems = [],
  projectedItems = [],
  usdRate = 5,
  competence,
  hasUncertainTax = false,
  autoCreditCash = true,
  isApproving,
  isAvailableDismissed = false,
  isProjectedDismissed = false,
  onApproveAll,
  onOpenDetails,
  onSelectPreset,
  onDismissAvailable,
  onDismissProjected,
  className,
}: {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  availableItems?: readonly DividendEvidenceItem[];
  projectedItems?: readonly DividendEvidenceItem[];
  usdRate?: number;
  competence?: string;
  hasUncertainTax?: boolean;
  autoCreditCash?: boolean;
  isApproving: boolean;
  isAvailableDismissed?: boolean;
  isProjectedDismissed?: boolean;
  onApproveAll: () => void;
  onOpenDetails: () => void;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  onDismissAvailable?: (days: 7 | 30) => void;
  onDismissProjected?: (days: 7 | 30) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  const availPolicy = resolveCarouselCardPolicy("portfolio.dividends_available");
  const projPolicy = resolveCarouselCardPolicy("portfolio.dividends_projected");

  const availableBreakdown =
    availableItems.length > 0
      ? buildDividendCarouselBreakdown({
          kind: "available",
          asOf: todaySaoPauloISO(),
          month: competence,
          items: availableItems,
          count: availableCount,
          totalBRLCents: Math.round(totalAvailableAmount * 100),
          fxRate: usdRate,
        })
      : undefined;

  const projectedBreakdown =
    projectedItems.length > 0
      ? buildDividendCarouselBreakdown({
          kind: "monthly",
          asOf: todaySaoPauloISO(),
          month: competence,
          items: projectedItems,
          count: projectedCount,
          totalBRLCents: Math.round(totalProjectedAmount * 100),
          fxRate: usdRate,
        })
      : undefined;

  return [
    availableCount > 0 &&
      !isAvailableDismissed && {
        id: "portfolio.dividends_available",
        priority: 1,
        content: (
          <AlertCarouselCard
            id="portfolio.dividends_available"
            tone={hasUncertainTax ? "warning" : "positive"}
            icon={<Coins className="size-4.5" />}
            title="Proventos a Conferir"
            badge={{
              label: hasUncertainTax
                ? "Alíquota a conferir"
                : `${availableCount} ${availableCount === 1 ? "provento" : "proventos"}`,
              variant: hasUncertainTax ? "warning" : "positive",
            }}
            description={
              hasUncertainTax ? (
                <>
                  {availableCount}{" "}
                  {availableCount === 1 ? "provento soma" : "proventos somam"}{" "}
                  <MoneyText
                    cents={Math.round(totalAvailableAmount * 100)}
                    variant="caption"
                    tone="default"
                    className="font-medium text-foreground inline"
                  />{" "}
                  com tipo/IR a conferir antes do crédito.
                </>
              ) : (
                <>
                  {availableCount}{" "}
                  {availableCount === 1 ? "provento soma" : "proventos somam"}{" "}
                  <MoneyText
                    cents={Math.round(totalAvailableAmount * 100)}
                    variant="caption"
                    tone="default"
                    className="font-medium text-foreground inline"
                  />{" "}
                  {autoCreditCash
                    ? "para confirmação no Caixa."
                    : "para confirmação no extrato."}
                </>
              )
            }
            calculationBreakdown={availableBreakdown}
            className={className}
            secondaryAction={
              !hasUncertainTax
                ? {
                    label: "Ver detalhes",
                    onClick: onOpenDetails,
                    variant: "ghost",
                  }
                : undefined
            }
            primaryAction={
              hasUncertainTax
                ? {
                    label: "Conferir e Aprovar",
                    onClick: onOpenDetails,
                    variant: "default",
                  }
                : {
                    label: isApproving
                      ? "Confirmando..."
                      : autoCreditCash
                        ? "Aprovar no Caixa"
                        : "Confirmar no Extrato",
                    onClick: onApproveAll,
                    variant: "default",
                    disabled: isApproving,
                    loading: isApproving,
                    icon: isApproving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : undefined,
                  }
            }
            dismissPolicy={
              onSelectPreset || onDismissAvailable
                ? {
                    allowedPresets: availPolicy.allowedPresets,
                    onSelectPreset: (preset) => {
                      if (onSelectPreset) {
                        onSelectPreset("portfolio.dividends_available", preset);
                      } else {
                        onDismissAvailable?.(preset === "7d" ? 7 : 30);
                      }
                    },
                  }
                : undefined
            }
          />
        ),
      },
    projectedCount > 0 &&
      !isProjectedDismissed && {
        id: "portfolio.dividends_projected",
        priority: 2,
        content: (
          <AlertCarouselCard
            id="portfolio.dividends_projected"
            tone="info"
            icon={<CalendarClock className="size-4.5" />}
            title="Proventos Previstos no Mês"
            badge={{
              label: `${projectedCount} ${projectedCount === 1 ? "agendado" : "agendados"}`,
              variant: "default",
            }}
            description={
              <>
                Provisionado{" "}
                <MoneyText
                  cents={Math.round(totalProjectedAmount * 100)}
                  variant="caption"
                  tone="default"
                  className="font-medium text-foreground inline"
                />{" "}
                nos próximos pagamentos anunciados.
              </>
            }
            calculationBreakdown={projectedBreakdown}
            className={className}
            primaryAction={{
              label: "Ver projeção",
              onClick: onOpenDetails,
              variant: "outline",
            }}
            dismissPolicy={
              onSelectPreset || onDismissProjected
                ? {
                    allowedPresets: projPolicy.allowedPresets,
                    onSelectPreset: (preset) => {
                      if (onSelectPreset) {
                        onSelectPreset("portfolio.dividends_projected", preset);
                      } else {
                        onDismissProjected?.(preset === "7d" ? 7 : 30);
                      }
                    },
                  }
                : undefined
            }
          />
        ),
      },
  ];
}
