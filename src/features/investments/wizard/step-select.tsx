import { useMemo } from "react";
import { Check, Plus, Search, Sparkles } from "lucide-react";
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
import {
  getAssetPricingMode,
  inferCurrencyFromTicker,
  isFixedIncomeClass,
  isTesouroAsset,
} from "@/domain/portfolio/valuation";
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
    priceBRL?: number;
  }[];
  targets: readonly AllocationTarget[];
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
  targets,
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

  const hasTargets = targets.length > 0 || (classTargets && classTargets.length > 0) || (sectorTargets && sectorTargets.length > 0);

  // Top 3 recomendações baseadas no motor hierárquico (só são calculadas se houver metas)
  const aporteSuggestions = useMemo(
    () =>
      hasTargets
        ? buildAporteSuggestions(existingAssets, assetRows, targets, totalPortfolioBRL, 3, classTargets, sectorTargets)
        : [],
    [hasTargets, existingAssets, assetRows, targets, classTargets, sectorTargets, totalPortfolioBRL],
  );

  // Mapa de sugestão por assetId para enriquecer resultados de busca
  const suggestionByAsset = useMemo(
    () => new Map(aporteSuggestions.map((s) => [s.assetId, s])),
    [aporteSuggestions],
  );

  const isSearching = state.searchQuery.length > 0;
  const currentCleanTicker = cleanTicker(state.ticker);

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
            placeholder="Ex: PETR4, MXRF11, O, Tesouro Selic, Apple..."
            className="pl-9 font-mono uppercase"
          />
        </div>
      </div>

      {/* Lista unificada */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {!isSearching && hasTargets && aporteSuggestions.length > 0 && (
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
          )}
          {isSearching
            ? "Resultados sugeridos"
            : hasTargets && aporteSuggestions.length > 0
              ? "Recomendados para aporte"
              : "Seus ativos em carteira"}
        </p>

        {/* Sem busca: aviso se não há metas + sugestões enriquecidas ou ativos da carteira */}
        {!isSearching ? (
          !hasTargets ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface/80 p-3 text-xs text-muted-foreground">
                <Sparkles className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span>
                  Recomendações automáticas de aporte só aparecem quando há metas configuradas. Defina suas metas na aba <strong>Metas de Alocação</strong> para receber sugestões de rebalanceamento.
                </span>
              </div>

              {existingAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum ativo cadastrado na carteira. Digite o ticker acima para cadastrar ou buscar.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
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
                        className={`flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-all hover:bg-surface-hover/80 active:scale-[0.99] ${
                          isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-foreground">{asset.ticker}</span>
                            <Badge variant="default" className="text-[10px] py-0 px-1.5">
                              Na carteira
                            </Badge>
                            {isSelected && (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5 gap-1 bg-primary text-primary-foreground">
                                <Check className="size-3" aria-hidden="true" />
                                Selecionado
                              </Badge>
                            )}
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
                    );
                  })}
                </div>
              )}
            </div>
          ) : aporteSuggestions.length === 0 ? (
            existingAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhum ativo cadastrado na carteira. Digite o ticker acima para cadastrar ou buscar.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
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
                      className={`flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-all hover:bg-surface-hover/80 active:scale-[0.99] ${
                        isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">{asset.ticker}</span>
                          <Badge variant="default" className="text-[10px] py-0 px-1.5">
                            Na carteira
                          </Badge>
                          {isSelected && (
                            <Badge variant="default" className="text-[10px] py-0 px-1.5 gap-1 bg-primary text-primary-foreground">
                              <Check className="size-3" aria-hidden="true" />
                              Selecionado
                            </Badge>
                          )}
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
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1.5">
              {aporteSuggestions.map((item) => {
                const asset = existingAssets.find((a) => a.id === item.assetId);
                const row = assetRows.find((r) => r.assetId === item.assetId);
                const priceBRL = row?.priceBRL ?? Number(asset?.average_price ?? 0);
                const isTesouro = isTesouroAsset(item.ticker, item.assetClass);
                const isFixedIncome = isFixedIncomeClass(item.assetClass) || isTesouro;
                const pricingMode = getAssetPricingMode(asset ?? { ticker: item.ticker, asset_class: item.assetClass, notes: null });
                const isTotalValue = pricingMode === "total_value" || isFixedIncome;

                const name = asset?.notes ?? item.ticker;
                const isSelected = currentCleanTicker === cleanTicker(item.ticker);

                // Cálculo de cabimento no saldo em caixa
                let cashInfo: { text: string; fits: boolean; costBRL?: number } | null = null;
                if (cashAvailableBRL > 0) {
                  if (isTotalValue) {
                    const amountFit = Math.min(cashAvailableBRL, item.gapBRL);
                    cashInfo = {
                      text: `Cabe no caixa: `,
                      costBRL: amountFit,
                      fits: true,
                    };
                  } else if (priceBRL > 0) {
                    const maxUsefulQty = Math.floor(item.gapBRL / priceBRL);
                    const cashQty = Math.floor(cashAvailableBRL / priceBRL);
                    const sharesFit = Math.min(maxUsefulQty, cashQty);
                    if (sharesFit > 0) {
                      cashInfo = {
                        text: `Cabe no caixa: ${sharesFit} cota${sharesFit > 1 ? "s" : ""} (~`,
                        costBRL: sharesFit * priceBRL,
                        fits: true,
                      };
                    } else {
                      cashInfo = {
                        text: "Saldo em caixa insuficiente para 1 cota",
                        fits: false,
                      };
                    }
                  }
                }

                return (
                  <button
                    key={item.assetId}
                    type="button"
                    onClick={() => onSelectSuggestion(item)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] ${
                      isSelected
                        ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-xs"
                        : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{item.ticker}</span>
                        <Badge variant="default" className="text-[10px] py-0 px-1.5">Na carteira</Badge>
                        {isSelected && (
                          <Badge variant="default" className="text-[10px] py-0 px-1.5 gap-1 bg-primary text-primary-foreground">
                            <Check className="size-3" aria-hidden="true" />
                            Selecionado
                          </Badge>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{name}</span>
                      <div className="flex flex-col gap-0.5 pt-0.5 text-[11px] text-muted-foreground">
                        {cashInfo ? (
                          <span>
                            <span className={cashInfo.fits ? "font-semibold text-positive-strong" : "text-muted-foreground"}>
                              {cashInfo.text}
                              {cashInfo.costBRL !== undefined && (
                                <>
                                  <MoneyText
                                    cents={numberToCents(cashInfo.costBRL)}
                                    tone="positive"
                                    className="font-semibold text-positive-strong inline"
                                  />
                                  {!isTotalValue ? ")" : ""}
                                </>
                              )}
                            </span>
                            {` · Meta: ${item.targetPercentage}%`}
                          </span>
                        ) : (
                          <span>
                            {`Meta: ${item.targetPercentage}%`}
                          </span>
                        )}
                      </div>
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
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 p-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum ativo encontrado para "{state.searchQuery}".</p>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => {
                const cleaned = cleanTicker(state.searchQuery);
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
              Cadastrar {cleanTicker(state.searchQuery)} como novo ativo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
            {searchResults.map((res) => {
              const suggestion = res.existingAssetId ? suggestionByAsset.get(res.existingAssetId) : undefined;
              const isSelected = currentCleanTicker === cleanTicker(res.ticker);
              return (
                <button
                  key={res.ticker}
                  type="button"
                  onClick={() => onSelectResult(res)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-all hover:bg-surface-hover/80 active:scale-[0.99] ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">{res.ticker}</span>
                      <Badge variant={res.isExisting ? "default" : "muted"} className="text-[10px] py-0 px-1.5">
                        {res.isExisting ? "Na carteira" : res.assetClass}
                      </Badge>
                      {isSelected && (
                        <Badge variant="default" className="text-[10px] py-0 px-1.5 gap-1 bg-primary text-primary-foreground">
                          <Check className="size-3" aria-hidden="true" />
                          Selecionado
                        </Badge>
                      )}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{res.name}</span>
                    {suggestion ? (
                      <span className="text-[11px] text-muted-foreground pt-0.5">
                        {`Meta: ${suggestion.targetPercentage}%`}
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
                      <Badge variant={isSelected ? "default" : "muted"} className="text-xs gap-1">
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
        )}
      </div>
    </div>
  );
}
