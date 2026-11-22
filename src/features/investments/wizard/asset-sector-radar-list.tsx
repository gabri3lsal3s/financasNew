import { Check } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { CeilingPriceBadge } from "@/components/modules/portfolio";
import { numberToCents } from "@/domain/money";
import type { SectorOpportunityItem, SectorAporteGroup } from "@/domain/portfolio";
import type { AporteSuggestionItem } from "@/domain/portfolio/tickers-catalog";
import { cleanTicker } from "@/domain/portfolio/tickers-catalog";
import { sanitizeReportText } from "@/domain/reports/sanitize-text";
import { cn } from "@/lib/utils";

export interface AssetSectorRadarListProps {
  topSectorGroups: readonly SectorAporteGroup[];
  currentCleanTicker: string;
  onSelectSuggestion: (item: AporteSuggestionItem) => void;
}

export function AssetSectorRadarList({
  topSectorGroups,
  currentCleanTicker,
  onSelectSuggestion,
}: AssetSectorRadarListProps) {
  const handleSelectOpportunity = (opp: SectorOpportunityItem, groupGapBRL: number) => {
    onSelectSuggestion({
      assetId: opp.assetId,
      ticker: opp.ticker,
      assetClass: opp.assetClass,
      sector: opp.sector,
      currentValueBRL: opp.currentValueBRL,
      targetValueBRL: opp.currentValueBRL + groupGapBRL,
      gapBRL: groupGapBRL,
      targetPercentage: opp.currentWeightPct,
      currentPercentage: opp.currentWeightPct,
      suggestedQty: opp.suggestedQty,
      suggestedTotalBRL: opp.suggestedTotalBRL,
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {topSectorGroups.map((group) => {
        const groupKey = `${group.className}::${group.sectorName}`;
        const displayAssets = group.assets.slice(0, 2);

        return (
          <div
            key={groupKey}
            className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/50 pb-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                  {sanitizeReportText(group.sectorName)}
                </span>
                <Badge variant="muted" size="xs">
                  {group.className}
                </Badge>
                <Badge variant="default" size="xs">
                  Defasado
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Orçamento estimado:</span>
                <MoneyText
                  cents={numberToCents(group.budgetAllocatedBRL)}
                  tone="default"
                  className="font-bold text-foreground"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {displayAssets.map((opp) => {
                const isSelected = currentCleanTicker === cleanTicker(opp.ticker);

                return (
                  <button
                    key={opp.assetId}
                    type="button"
                    onClick={() => handleSelectOpportunity(opp, group.gapBRL)}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                        : "border-border/80 bg-surface hover:border-primary/40 hover:bg-surface-hover",
                    )}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{opp.ticker}</span>
                        {opp.ceilingPrice && opp.ceilingPrice > 0 ? (
                          <CeilingPriceBadge
                            ceilingPrice={opp.ceilingPrice}
                            currentPrice={opp.currentPrice}
                          />
                        ) : null}
                        {isSelected && (
                          <Badge variant="default" size="xs" className="gap-1 shrink-0">
                            <Check className="size-3" aria-hidden="true" />
                            Selecionado
                          </Badge>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{opp.name}</span>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <span className="text-xs font-semibold text-primary-strong">
                        {opp.suggestedQty > 0 ? `Aportar ${opp.suggestedQty} cota(s)` : "Aportar"}
                      </span>
                      {opp.suggestedTotalBRL > 0 && (
                        <MoneyText
                          cents={numberToCents(opp.suggestedTotalBRL)}
                          tone="default"
                          className="text-xs text-muted-foreground font-medium"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
