import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { cleanTicker, type TickerSearchResult } from "@/domain/portfolio/tickers-catalog";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import type { PortfolioAsset } from "@/types";

export interface ExistingAssetsFallbackListProps {
  existingAssets: readonly PortfolioAsset[];
  currentCleanTicker: string;
  onSelectResult: (result: TickerSearchResult) => void;
}

export function ExistingAssetsFallbackList({
  existingAssets,
  currentCleanTicker,
  onSelectResult,
}: ExistingAssetsFallbackListProps) {
  if (existingAssets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhum ativo cadastrado na carteira. Digite o ticker acima para cadastrar ou buscar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface">
      {existingAssets.map((asset) => {
        const isSelected = currentCleanTicker === cleanTicker(asset.ticker);
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() =>
              onSelectResult({
                ticker: asset.ticker,
                name: asset.notes ?? asset.ticker,
                assetClass: asset.asset_class ?? "Ações",
                currency: asset.currency ?? "BRL",
                isExisting: true,
                existingAssetId: asset.id,
                currentQuantity: asset.quantity,
                currentAveragePrice: asset.average_price,
              })
            }
            className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-3 text-left transition-all hover:bg-surface-hover/80 active:scale-[0.99] cursor-pointer",
              isSelected && "bg-primary/10 border-l-2 border-l-primary",
            )}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">{asset.ticker}</span>
                <Badge variant="muted" size="xs">
                  Na carteira
                </Badge>
                {isSelected && (
                  <Badge variant="default" size="xs" className="gap-1 bg-primary text-primary-foreground shrink-0">
                    <Check className="size-3" aria-hidden="true" />
                    Selecionado
                  </Badge>
                )}
              </div>
              <span className="truncate text-xs text-muted-foreground">{asset.notes ?? asset.ticker}</span>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
              <span className="text-xs font-semibold text-primary-strong">Aportar</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatAssetQuantity(asset.quantity, asset.asset_class ?? undefined)} cota(s)
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
