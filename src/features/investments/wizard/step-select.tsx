import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { FormField, SearchInput } from "@/components/ui";
import {
  buildAporteSuggestions,
  cleanTicker,
  searchTickers,
  type AporteSuggestionItem,
  type TickerSearchResult,
} from "@/domain/portfolio/tickers-catalog";
import {
  getAporteSuggestions,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorTargetInput,
} from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";
import { AssetQuickPickGrid } from "./asset-quick-pick-grid";
import { AssetSearchComboboxList } from "./asset-search-combobox-list";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepSelectProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  existingAssets: readonly PortfolioAsset[];
  assetRows: readonly {
    assetId: string;
    ticker: string;
    valueBRL: number;
    pct: number;
    assetClass?: string | null;
    priceBRL?: number;
  }[];
  classTargets?: readonly { name: string; target_percentage: number }[];
  sectorTargets?: readonly { className: string; sectorName: string; target_percentage: number }[];
  totalPortfolioBRL: number;
  cashAvailableBRL?: number;
  onSelectResult: (result: TickerSearchResult) => void;
  onSelectSuggestion: (item: AporteSuggestionItem) => void;
}

export function StepSelect({
  state,
  onChange,
  existingAssets,
  assetRows,
  classTargets,
  sectorTargets,
  totalPortfolioBRL,
  cashAvailableBRL = 0,
  onSelectResult,
  onSelectSuggestion,
}: StepSelectProps) {
  const searchResults = useMemo(
    () => searchTickers(state.searchQuery, existingAssets, 8),
    [state.searchQuery, existingAssets],
  );

  const hasTargets = Boolean((classTargets && classTargets.length > 0) || (sectorTargets && sectorTargets.length > 0));
  const hasSectorTargets = Boolean(sectorTargets && sectorTargets.length > 0);
  const [viewMode, setViewMode] = useState<"sector_radar" | "direct_asset">(
    hasSectorTargets ? "sector_radar" : "direct_asset",
  );

  const unifiedAporte = useMemo(() => {
    if (!hasTargets) return null;
    const aporteAssets: AporteAssetInput[] = existingAssets.map((asset) => {
      const row = assetRows.find((r) => r.assetId === asset.id);
      return {
        id: asset.id,
        ticker: asset.ticker,
        name: asset.notes ?? asset.ticker,
        assetClass: asset.asset_class,
        sector: asset.sector,
        currency: (asset.currency ?? "BRL") as "BRL" | "USD",
        currentValueBRL: row?.valueBRL ?? 0,
        priceBRL: row?.priceBRL ?? Number(asset.average_price ?? 0),
        averageCost: Number(asset.average_price ?? 0),
        score: asset.score ?? null,
        allocationStatus: asset.allocation_status ?? "active",
      };
    });

    const normalizedClassTargets: ClassTargetInput[] = (classTargets ?? []).map((ct) => ({
      className: ct.name,
      targetPercentage: ct.target_percentage,
    }));
    const normalizedSectorTargets: SectorTargetInput[] = (sectorTargets ?? []).map((st) => ({
      className: st.className,
      sectorName: st.sectorName,
      targetPercentage: st.target_percentage,
    }));

    return getAporteSuggestions({
      mode: "sector_oriented",
      aporteAmount: 0,
      cashAvailableBRL: cashAvailableBRL > 0 ? cashAvailableBRL : 0,
      assets: aporteAssets,
      classTargets: normalizedClassTargets,
      sectorTargets: normalizedSectorTargets,
      totalPortfolioBRL,
    });
  }, [hasTargets, existingAssets, assetRows, classTargets, sectorTargets, totalPortfolioBRL, cashAvailableBRL]);

  const topSectorGroups = useMemo(() => {
    if (!unifiedAporte?.sectorGroups) return [];
    return unifiedAporte.sectorGroups
      .filter((g) => (g.budgetAllocatedBRL > 0 || g.gapBRL > 0 || g.deficitRel > 0) && g.assets.length > 0)
      .slice(0, 3);
  }, [unifiedAporte]);

  const aporteSuggestions = useMemo(
    () => (hasTargets ? buildAporteSuggestions(existingAssets, assetRows, totalPortfolioBRL, 3, classTargets, sectorTargets) : []),
    [hasTargets, existingAssets, assetRows, classTargets, sectorTargets, totalPortfolioBRL],
  );

  const suggestionByAsset = useMemo(
    () => new Map(aporteSuggestions.map((s) => [s.assetId, s])),
    [aporteSuggestions],
  );

  const isSearching = state.searchQuery.length > 0;
  const currentCleanTicker = cleanTicker(state.ticker);

  return (
    <div className="flex flex-col gap-5">
      <FormField label="Buscar ou digitar ativo" htmlFor="wizard-ticker-search">
        <SearchInput
          id="wizard-ticker-search"
          value={state.searchQuery}
          onChange={(e) => onChange({ searchQuery: e.target.value.toUpperCase() })}
          onClear={() => onChange({ searchQuery: "" })}
          placeholder="Ex: PETR4, MXRF11, O, Tesouro Selic, Apple..."
          className="font-mono uppercase"
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {!isSearching && hasTargets && aporteSuggestions.length > 0 && (
            <Sparkles className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
          )}
          {isSearching
            ? "Resultados sugeridos"
            : hasTargets && aporteSuggestions.length > 0
              ? "Sugeridos para rebalanceamento"
              : "Seus ativos em carteira"}
        </p>

        {!isSearching ? (
          <AssetQuickPickGrid
            hasTargets={hasTargets}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            topSectorGroups={topSectorGroups}
            aporteSuggestions={aporteSuggestions}
            existingAssets={existingAssets}
            assetRows={assetRows}
            cashAvailableBRL={cashAvailableBRL}
            currentCleanTicker={currentCleanTicker}
            onSelectResult={onSelectResult}
            onSelectSuggestion={onSelectSuggestion}
          />
        ) : (
          <AssetSearchComboboxList
            searchQuery={state.searchQuery}
            searchResults={searchResults}
            suggestionByAsset={suggestionByAsset}
            currentCleanTicker={currentCleanTicker}
            onSelectResult={onSelectResult}
          />
        )}
      </div>
    </div>
  );
}
