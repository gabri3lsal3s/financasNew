import { CalendarClock, Coins, Loader2 } from "lucide-react";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { InsightSlide } from "./insight-slide";

export function buildDividendInsightItems({
  availableCount,
  projectedCount,
  totalAvailableAmount,
  totalProjectedAmount,
  hasUncertainTax = false,
  isApproving,
  isAvailableDismissed = false,
  isProjectedDismissed = false,
  onApproveAll,
  onOpenDetails,
  onDismissAvailable,
  onDismissProjected,
  className,
}: {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  hasUncertainTax?: boolean;
  isApproving: boolean;
  isAvailableDismissed?: boolean;
  isProjectedDismissed?: boolean;
  onApproveAll: () => void;
  onOpenDetails: () => void;
  onDismissAvailable?: (days: 7 | 30) => void;
  onDismissProjected?: (days: 7 | 30) => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  return [
    availableCount > 0 &&
      !isAvailableDismissed && {
        id: "available-dividends-alert",
        priority: 1,
        content: (
          <InsightSlide
            tone={hasUncertainTax ? "warning" : "positive"}
            icon={<Coins className="size-4.5" />}
            title="Proventos Creditados na Corretora"
            badgeText={
              hasUncertainTax
                ? "Alíquota a conferir"
                : `${availableCount} ${availableCount === 1 ? "provento" : "proventos"}`
            }
            badgeVariant={hasUncertainTax ? "warning" : "positive"}
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
                  {availableCount === 1 ? "provento da B3 soma" : "proventos da B3 somam"}{" "}
                  <MoneyText
                    cents={Math.round(totalAvailableAmount * 100)}
                    variant="caption"
                    tone="default"
                    className="font-medium text-foreground inline"
                  />{" "}
                  para confirmação no Caixa.
                </>
              )
            }
            onDismiss={onDismissAvailable}
            className={className}
            actions={
              hasUncertainTax ? (
                <Button type="button" variant="default" size="sm" onClick={onOpenDetails}>
                  Conferir e Aprovar
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={onOpenDetails}>
                    Ver detalhes
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={isApproving}
                    onClick={onApproveAll}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                        Creditando...
                      </>
                    ) : (
                      "Aprovar no Caixa"
                    )}
                  </Button>
                </>
              )
            }
          />
        ),
      },
    projectedCount > 0 &&
      !isProjectedDismissed && {
        id: "projected-dividends-alert",
        priority: 2,
        content: (
          <InsightSlide
            tone="primary"
            icon={<CalendarClock className="size-4.5" />}
            title="Proventos Previstos no Mês"
            badgeText={`${projectedCount} ${projectedCount === 1 ? "agendado" : "agendados"}`}
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
            onDismiss={onDismissProjected}
            className={className}
            actions={
              <Button type="button" variant="outline" size="sm" onClick={onOpenDetails}>
                Ver projeção
              </Button>
            }
          />
        ),
      },
  ];
}
