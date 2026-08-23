import { useMemo } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  buildAporteSuggestions,
  cleanTicker,
  searchTickers,
  type AporteSuggestionItem,
  type TickerSearchResult,
} from "@/domain/portfolio/tickers-catalog";
import type { AllocationTarget, PortfolioAsset } from "@/types";
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
  }[];
  targets: readonly AllocationTarget[];
  classTargets?: readonly { name: string; target_percentage: number }[];
  totalPortfolioBRL: number;
  onSelectResult: (result: TickerSearchResult) => void;
  onSelectSuggestion: (item: AporteSuggestionItem) => void;
}

export function StepSelect({
  state,
  onChange,
  existingAssets,
  assetRows,
  targets,
  classTargets,
  totalPortfolioBRL,
  onSelectResult,
  onSelectSuggestion,
}: StepSelectProps) {
  const searchResults = useMemo(
    () => searchTickers(state.searchQuery, existingAssets, 8),
    [state.searchQuery, existingAssets],
  );

  // Top 3 recomendações baseadas no motor hierárquico (classe -> ativo)
  const aporteSuggestions = useMemo(
    () => buildAporteSuggestions(existingAssets, assetRows, targets, totalPortfolioBRL, 3, classTargets),
    [existingAssets, assetRows, targets, classTargets, totalPortfolioBRL],
  );

  // Mapa de sugestão por assetId para enriquecer resultados de busca
  const suggestionByAsset = useMemo(
    () => new Map(aporteSuggestions.map((s) => [s.assetId, s])),
    [aporteSuggestions],
  );

  const isSearching = state.searchQuery.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Campo de Busca */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wizard-ticker-search" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Buscar ou digitar ativo
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="wizard-ticker-search"
            value={state.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value.toUpperCase() })}
            placeholder="Ex: PETR4, MXRF11, Tesouro Selic, Apple..."
            className="pl-9 font-mono uppercase"
          />
        </div>
      </div>

      {/* Lista unificada */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {!isSearching && aporteSuggestions.length > 0 && (
            <Sparkles className="size-3" aria-hidden="true" />
          )}
          {isSearching
            ? "Resultados sugeridos"
            : aporteSuggestions.length > 0
              ? "Recomendados para aporte"
              : "Seus ativos em carteira"}
        </p>

        {/* Sem busca: recomendacoes enriquecidas ou lista de ativos existentes */}
        {!isSearching ? (
          aporteSuggestions.length === 0 ? (
            existingAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhum ativo cadastrado na carteira. Digite o ticker acima para cadastrar ou buscar.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
                {existingAssets.map((asset) => (
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
                    className="flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover/80 active:scale-[0.99]"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{asset.ticker}</span>
                        <Badge variant="default" className="text-[10px] py-0 px-1.5">
                          Na carteira
                        </Badge>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{asset.notes ?? asset.ticker}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end text-right">
                        <span className="text-[10px] uppercase font-semibold text-primary">Aportar</span>
                        <span className="text-[11px] text-muted-foreground">{asset.quantity} cota(s)</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1.5">
              {aporteSuggestions.map((item) => {
                const asset = existingAssets.find((a) => a.id === item.assetId);
                const name = asset?.notes ?? item.ticker;
                return (
                  <button
                    key={item.assetId}
                    type="button"
                    onClick={() => onSelectSuggestion(item)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{item.ticker}</span>
                        <Badge variant="default" className="text-[10px] py-0 px-1.5">Na carteira</Badge>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{name}</span>
                      <span className="text-[11px] text-muted-foreground pt-0.5">
                        {"Faltam "}
                        <MoneyText
                          cents={numberToCents(item.gapBRL)}
                          tone="default"
                          className="font-semibold text-foreground inline"
                        />
                        {" para a meta ("}
                        {item.targetPercentage}
                        {"%)"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end text-right shrink-0">
                      <span className="text-[10px] uppercase font-semibold text-primary">Aportar</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {item.currentPercentage.toFixed(1)}% atual
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
              <p className="text-xs text-muted-foreground">Nenhum ativo encontrado para "{state.searchQuery}".</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const cleaned = cleanTicker(state.searchQuery);
                  onChange({
                    mode: "new_asset",
                    step: 1,
                    ticker: cleaned,
                    assetClass: "Acoes",
                  });
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Cadastrar {cleanTicker(state.searchQuery)} como novo ativo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
              {searchResults.map((res) => {
                const suggestion = res.existingAssetId ? suggestionByAsset.get(res.existingAssetId) : undefined;
                return (
                  <button
                    key={res.ticker}
                    type="button"
                    onClick={() => onSelectResult(res)}
                    className="flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover/80 active:scale-[0.99]"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{res.ticker}</span>
                        <Badge variant={res.isExisting ? "default" : "muted"} className="text-[10px] py-0 px-1.5">
                          {res.isExisting ? "Na carteira" : res.assetClass}
                        </Badge>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{res.name}</span>
                      {suggestion ? (
                        <span className="text-[11px] text-muted-foreground pt-0.5">
                          {"Faltam "}
                          <MoneyText
                            cents={numberToCents(suggestion.gapBRL)}
                            tone="default"
                            className="font-semibold text-foreground inline"
                          />
                          {" para a meta ("}
                          {suggestion.targetPercentage}
                          {"%)"}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {res.isExisting ? (
                        <div className="flex flex-col items-end text-right">
                          <span className="text-[10px] uppercase font-semibold text-primary">Aportar</span>
                          <span className="text-[11px] text-muted-foreground">{res.currentQuantity} cota(s)</span>
                        </div>
                      ) : (
                        <Badge variant="muted" className="text-xs gap-1">
                          <Plus className="size-3" aria-hidden="true" />
                          Novo
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
