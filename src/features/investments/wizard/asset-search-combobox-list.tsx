import { Check, Plus } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cleanTicker, type AporteSuggestionItem, type TickerSearchResult } from "@/domain/portfolio/tickers-catalog";
import { inferCurrencyFromTicker } from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";

export interface AssetSearchComboboxListProps {
  searchQuery: string;
  searchResults: readonly TickerSearchResult[];
  suggestionByAsset: ReadonlyMap<string, AporteSuggestionItem>;
  currentCleanTicker: string;
  onSelectResult: (result: TickerSearchResult) => void;
}

export function AssetSearchComboboxList({
  searchQuery,
  searchResults,
  suggestionByAsset,
  currentCleanTicker,
  onSelectResult,
}: AssetSearchComboboxListProps) {
  if (searchResults.length === 0) {
    const cleaned = cleanTicker(searchQuery);
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
        <p className="text-xs text-muted-foreground">Nenhum ativo encontrado para "{searchQuery}".</p>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => {
            onSelectResult({
              ticker: cleaned,
              name: `Ativo personalizado (${cleaned})`,
              assetClass: "Ações",
              currency: inferCurrencyFromTicker(cleaned),
              isExisting: false,
            });
          }}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Cadastrar {cleaned} como novo ativo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface">
      {searchResults.map((res) => {
        const suggestion = res.existingAssetId ? suggestionByAsset.get(res.existingAssetId) : undefined;
        const isSelected = currentCleanTicker === cleanTicker(res.ticker);
        return (
          <button
            key={res.ticker}
            type="button"
            onClick={() => onSelectResult(res)}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-3 text-left transition-all hover:bg-surface-hover/80 active:scale-[0.99] cursor-pointer",
              isSelected && "bg-primary/10 border-l-2 border-l-primary",
            )}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">{res.ticker}</span>
                <Badge variant={res.isExisting ? "default" : "muted"} size="xs">
                  {res.isExisting ? "Na carteira" : res.assetClass}
                </Badge>
                {isSelected && (
                  <Badge variant="default" size="xs" className="gap-1 bg-primary text-primary-foreground shrink-0">
                    <Check className="size-3" aria-hidden="true" />
                    Selecionado
                  </Badge>
                )}
              </div>
              <span className="truncate text-xs text-muted-foreground">{res.name}</span>
              {suggestion && (
                <span className="text-xs text-muted-foreground pt-0.5">{`Meta: ${suggestion.targetPercentage}%`}</span>
              )}
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
              {res.isExisting ? (
                <>
                  <span className="text-xs font-semibold text-primary-strong">Aportar</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{res.currentQuantity} cota(s)</span>
                </>
              ) : (
                <Badge variant={isSelected ? "default" : "muted"} size="xs" className="gap-1">
                  {isSelected ? (
                    <>
                      <Check className="size-3" aria-hidden="true" />
                      Selecionado
                    </>
                  ) : (
                    <>
                      <Plus className="size-3" aria-hidden="true" />
                      Novo
                    </>
                  )}
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
