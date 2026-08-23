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
  totalPortfolioBRL,
  onSelectResult,
  onSelectSuggestion,
}: StepSelectProps) {
  const searchResults = useMemo(
    () => searchTickers(state.searchQuery, existingAssets, 8),
    [state.searchQuery, existingAssets],
  );

  const aporteSuggestions = useMemo(
    () => buildAporteSuggestions(existingAssets, assetRows, targets, totalPortfolioBRL, 3),
    [existingAssets, assetRows, targets, totalPortfolioBRL],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Campo de Busca com Autocomplete e UPPERCASE */}
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
            autoFocus
          />
        </div>
      </div>

      {/* Sugestões Preditivas baseadas em Metas de Aporte (quando não estiver buscando ativamente) */}
      {!state.searchQuery && aporteSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Recomendados para aporte hoje (com base nas suas metas)</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {aporteSuggestions.map((item) => (
              <button
                key={item.assetId}
                type="button"
                onClick={() => onSelectSuggestion(item)}
                className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface/90 p-2.5 text-left transition-all hover:border-primary hover:bg-surface-hover/80 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-foreground">{item.ticker}</span>
                  <Badge variant="muted" className="text-[10px] py-0 px-1">
                    {item.assetClass}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Faltam <span className="font-medium text-foreground"><MoneyText cents={numberToCents(item.gapBRL)} /></span> para a meta ({item.targetPercentage}%)
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Resultados de Busca / Catálogo */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {state.searchQuery ? "Resultados sugeridos" : "Seus ativos em carteira"}
        </span>

        {searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum ativo encontrado para &quot;{state.searchQuery}&quot;.</p>
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
                  assetClass: "Ações",
                });
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Cadastrar {cleanTicker(state.searchQuery)} como novo ativo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
            {searchResults.map((res) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
