import { Check, Layers, Sparkles, Target } from "lucide-react";
import { Badge, MoneyText, SegmentedControl } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { computeCashFitSummary, type SectorAporteGroup } from "@/domain/portfolio";
import { cleanTicker, type AporteSuggestionItem, type TickerSearchResult } from "@/domain/portfolio/tickers-catalog";
import { getAssetPricingMode, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { PortfolioAsset } from "@/types";
import { AssetSectorRadarList } from "./asset-sector-radar-list";
import { ExistingAssetsFallbackList } from "./existing-assets-fallback-list";

export interface AssetQuickPickGridProps {
  hasTargets: boolean;
  viewMode: "sector_radar" | "direct_asset";
  onViewModeChange: (mode: "sector_radar" | "direct_asset") => void;
  topSectorGroups: readonly SectorAporteGroup[];
  aporteSuggestions: readonly AporteSuggestionItem[];
  existingAssets: readonly PortfolioAsset[];
  assetRows: readonly { assetId: string; priceBRL?: number }[];
  cashAvailableBRL: number;
  currentCleanTicker: string;
  onSelectResult: (result: TickerSearchResult) => void;
  onSelectSuggestion: (item: AporteSuggestionItem) => void;
}

export function AssetQuickPickGrid({
  hasTargets,
  viewMode,
  onViewModeChange,
  topSectorGroups,
  aporteSuggestions,
  existingAssets,
  assetRows,
  cashAvailableBRL,
  currentCleanTicker,
  onSelectResult,
  onSelectSuggestion,
}: AssetQuickPickGridProps) {
  if (!hasTargets) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-raised/60 p-3 text-xs text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <span>
            Sugestões automáticas de rebalanceamento só aparecem quando há metas configuradas. Defina suas metas na aba{" "}
            <strong>Metas de Alocação</strong> para calcular a distribuição do aporte.
          </span>
        </div>
        <ExistingAssetsFallbackList
          existingAssets={existingAssets}
          currentCleanTicker={currentCleanTicker}
          onSelectResult={onSelectResult}
        />
      </div>
    );
  }

  if (aporteSuggestions.length === 0) {
    return (
      <ExistingAssetsFallbackList
        existingAssets={existingAssets}
        currentCleanTicker={currentCleanTicker}
        onSelectResult={onSelectResult}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {topSectorGroups.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <SegmentedControl
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              {
                value: "sector_radar",
                label: "Radar de Setores",
                icon: <Layers aria-hidden="true" />,
              },
              {
                value: "direct_asset",
                label: "Por Ativo Direto",
                icon: <Target aria-hidden="true" />,
              },
            ]}
            ariaLabel="Modo de seleção de ativos"
          />
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {viewMode === "sector_radar" ? "Top 3 setores prioritários" : "Top 3 ativos diretos"}
          </span>
        </div>
      )}

      {viewMode === "sector_radar" && topSectorGroups.length > 0 ? (
        <AssetSectorRadarList
          topSectorGroups={topSectorGroups}
          currentCleanTicker={currentCleanTicker}
          onSelectSuggestion={onSelectSuggestion}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {aporteSuggestions.map((item) => {
            const asset = existingAssets.find((a) => a.id === item.assetId);
            const row = assetRows.find((r) => r.assetId === item.assetId);
            const priceBRL = row?.priceBRL ?? Number(asset?.average_price ?? 0);
            const isTotalValue =
              getAssetPricingMode(asset ?? { ticker: item.ticker, asset_class: item.assetClass, notes: null }) === "total_value" ||
              isFixedIncomeClass(item.assetClass) ||
              isTesouroAsset(item.ticker, item.assetClass);
            const isSelected = currentCleanTicker === cleanTicker(item.ticker);
            const cashInfo = computeCashFitSummary({
              gapBRL: item.gapBRL,
              assetClass: item.assetClass,
              ticker: item.ticker,
              currency: asset?.currency,
              priceBRL,
              isTotalValue,
              cashAvailableBRL,
            });

            return (
              <button
                key={item.assetId}
                type="button"
                onClick={() => onSelectSuggestion(item)}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-xs"
                    : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10",
                )}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-foreground">{item.ticker}</span>
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
                  <span className="truncate text-xs text-muted-foreground">{asset?.notes ?? item.ticker}</span>
                  <div className="text-xs text-muted-foreground">
                    {cashInfo ? (
                      <span>
                        <span className={cashInfo.fits ? "font-semibold text-positive-strong" : "text-muted-foreground"}>
                          {cashInfo.text}
                          {cashInfo.costBRL !== undefined && (
                            <>
                              <MoneyText cents={numberToCents(cashInfo.costBRL)} tone="positive" className="font-semibold text-positive-strong inline" />
                              {!isTotalValue ? ")" : ""}
                            </>
                          )}
                        </span>
                        {` · Meta: ${item.targetPercentage}%`}
                      </span>
                    ) : (
                      <span>{`Meta: ${item.targetPercentage}%`}</span>
                    )}
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <span className="text-xs font-semibold text-primary-strong">Aportar</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatPercent(item.currentPercentage)}% atual
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
