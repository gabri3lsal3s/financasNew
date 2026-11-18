import { FileText, RefreshCw, TrendingUp } from "lucide-react";
import { PositionTable, type PositionRow } from "@/components/modules";
import { Button } from "@/components/ui";
import type { PriceSource } from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";

export interface CustodySectionCardProps {
  rows: PositionRow[];
  highlightId: string | null;
  isSyncingQuotes: boolean;
  onOpenExecutiveReport: () => void;
  onSyncQuotes: () => void;
  onOpenDetail: (assetId: string) => void;
  onOpenEdit: (assetId: string) => void;
  onCalibrateAsset: (assetId: string, ticker: string, currentValueCents: number) => void;
  onSetManualPrice: (
    assetId: string,
    ticker: string,
    currency: AssetCurrency,
    priceBRL: number,
    source: PriceSource,
    priceQuote?: number,
    pricingMode?: string,
    usdRate?: number,
  ) => void;
  onEvaluateScore: (assetId: string) => void;
}

export function CustodySectionCard({
  rows,
  highlightId,
  isSyncingQuotes,
  onOpenExecutiveReport,
  onSyncQuotes,
  onOpenDetail,
  onOpenEdit,
  onCalibrateAsset,
  onSetManualPrice,
  onEvaluateScore,
}: CustodySectionCardProps) {
  return (
    <section
      aria-label="Posições da Carteira"
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="mb-4 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground truncate">Posição Consolidada</h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenExecutiveReport}
            className="size-9 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
            title="Visualizar e Imprimir Relatório Executivo da Carteira"
            aria-label="Relatório Executivo"
          >
            <FileText aria-hidden="true" className="size-3.5" />
            <span className="hidden md:inline">Relatório</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSyncQuotes}
            disabled={isSyncingQuotes}
            className="size-9 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
            title="Atualizar cotações de mercado via API"
            aria-label="Atualizar cotações"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${isSyncingQuotes ? "animate-spin" : ""}`}
            />
            <span className="hidden md:inline">
              {isSyncingQuotes ? "Atualizando…" : "Atualizar"}
            </span>
          </Button>
        </div>
      </div>

      <PositionTable
        rows={rows}
        sortable
        highlightId={highlightId}
        onListTransactions={onOpenDetail}
        onEditAsset={onOpenEdit}
        onCalibrateAsset={onCalibrateAsset}
        onSetManualPrice={onSetManualPrice}
        onEvaluateScore={onEvaluateScore}
      />
    </section>
  );
}
