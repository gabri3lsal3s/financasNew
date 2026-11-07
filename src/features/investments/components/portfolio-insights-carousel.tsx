import { useState } from "react";
import { Coins, CalendarClock, Loader2 } from "lucide-react";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { useCorporateDividends, useApproveDividendsBatch } from "@/state";
import { PendingDividendsDialog } from "./pending-dividends-dialog";
import { cn } from "@/lib/utils";

export interface PortfolioInsightsCarouselProps {
  className?: string;
}

export function PortfolioInsightsCarousel({ className }: PortfolioInsightsCarouselProps) {
  const { available, projected, totalAvailableAmount, totalProjectedAmount, isLoading } =
    useCorporateDividends();

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const approveMutation = useApproveDividendsBatch();

  const handleApproveAll = async () => {
    if (available.length === 0) return;
    const items = available.map((d) => ({
      asset_id: d.assetId,
      ticker: d.ticker,
      date: d.paymentDate,
      amount: d.totalAmount,
      notes: `Provento automático (${d.type}) apurado na B3`,
      corporate_dividend_id: d.corporateDividendId,
    }));

    await approveMutation.mutateAsync({
      dividends: items,
      sync_cash: true,
    });
  };

  if (isLoading || (available.length === 0 && projected.length === 0)) {
    return null;
  }

  const items: (DashboardAlertItem | null | undefined | false)[] = [
    // Slide 1: Proventos Disponíveis na Corretora (Aprovação em lote de 1 clique)
    available.length > 0 && {
      id: "available-dividends-alert",
      priority: 1,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-positive/10 border-positive/20 text-positive-strong"
              aria-hidden="true"
            >
              <Coins className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Proventos Creditados na Corretora
                </h4>
                <Badge size="xs" variant="muted">
                  {available.length} {available.length === 1 ? "provento" : "proventos"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {available.length} {available.length === 1 ? "provento da B3 recebido soma" : "proventos da B3 recebidos somam"}{" "}
                <MoneyText
                  cents={Math.round(totalAvailableAmount * 100)}
                  className="font-medium text-foreground tabular-nums inline"
                />{" "}
                disponíveis para reinvestimento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              Ver detalhes
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={approveMutation.isPending}
              onClick={handleApproveAll}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Creditando...
                </>
              ) : (
                "Aprovar no Caixa"
              )}
            </Button>
          </div>
        </div>
      ),
    },

    // Slide 2: Proventos Futuros / Previstos
    projected.length > 0 && {
      id: "projected-dividends-alert",
      priority: 2,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary-strong"
              aria-hidden="true"
            >
              <CalendarClock className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Proventos Previstos no Mês
                </h4>
                <Badge size="xs" variant="muted">
                  {projected.length} futuros
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {projected.length} {projected.length === 1 ? "provento programado soma" : "proventos programados somam"}{" "}
                <MoneyText
                  cents={Math.round(totalProjectedAmount * 100)}
                  className="font-medium text-foreground tabular-nums inline"
                />{" "}
                com liquidação futura garantida pela B3.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              Ver projeção
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <DashboardAlertsCarousel items={items} className={className} />
      {isDetailsOpen && (
        <PendingDividendsDialog
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          availableDividends={available}
          projectedDividends={projected}
        />
      )}
    </>
  );
}
