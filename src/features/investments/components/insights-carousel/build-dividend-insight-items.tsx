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
  isApproving,
  onApproveAll,
  onOpenDetails,
  className,
}: {
  availableCount: number;
  projectedCount: number;
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  isApproving: boolean;
  onApproveAll: () => void;
  onOpenDetails: () => void;
  className?: string;
}): (DashboardAlertItem | false)[] {
  return [
    availableCount > 0 && {
      id: "available-dividends-alert",
      priority: 1,
      content: (
        <InsightSlide
          tone="positive"
          icon={<Coins className="size-4.5" />}
          title="Proventos Creditados na Corretora"
          badgeText={`${availableCount} ${availableCount === 1 ? "provento" : "proventos"}`}
          description={
            <>
              {availableCount}{" "}
              {availableCount === 1 ? "provento da B3 soma" : "proventos da B3 somam"}{" "}
              <MoneyText
                cents={Math.round(totalAvailableAmount * 100)}
                variant="caption"
                tone="default"
                className="font-medium text-foreground inline"
              />{" "}
              para reinvestimento.
            </>
          }
          className={className}
          actions={
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
          }
        />
      ),
    },
    projectedCount > 0 && {
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
              Previsão de{" "}
              <MoneyText
                cents={Math.round(totalProjectedAmount * 100)}
                variant="caption"
                tone="default"
                className="font-medium text-foreground inline"
              />{" "}
              nos próximos pagamentos anunciados.
            </>
          }
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
