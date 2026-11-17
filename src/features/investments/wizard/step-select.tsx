import { useMemo, useState } from "react";
import { Check, Layers, Plus, Sparkles, Target } from "lucide-react";
import { Badge, Button, FormField, SearchInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { sanitizeReportText } from "@/domain/reports/sanitize-text";
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
import {
  getAporteSuggestions,
  resolveAssetPrecision,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorOpportunityItem,
  type SectorTargetInput,
} from "@/domain/portfolio";
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
  const hasSectorTargets = Boolean(sectorTargets && sectorTargets.length > 0);

  const [viewMode, setViewMode] = useState<"sector_radar" | "direct_asset">(
    hasSectorTargets ? "sector_radar" : "direct_asset",
  );

  // Motor Canônico Unificado (Fase 10)
  const unifiedAporte = useMemo(() => {
    if (!hasTargets) return null;
    const aporteAssets: AporteAssetInput[] = existingAssets.map((asset) => {
      const row = assetRows.find((r) => r.assetId === asset.id);
      const target = targets.find((t) => t.asset_id === asset.id);
      const priceBRL = row?.priceBRL ?? Number(asset.average_price ?? 0);
      return {
        id: asset.id,
        ticker: asset.ticker,
        name: asset.notes ?? asset.ticker,
        assetClass: asset.asset_class,
        sector: asset.sector,
        currency: (asset.currency ?? "BRL") as "BRL" | "USD",
        currentValueBRL: row?.valueBRL ?? 0,
        priceBRL,
        averageCost: Number(asset.average_price ?? 0),
        targetPercentage: target?.target_percentage ?? null,
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
  }, [hasTargets, existingAssets, assetRows, targets, classTargets, sectorTargets, totalPortfolioBRL, cashAvailableBRL]);

  // Top 3 setores prioritários no Wizard (déficit > 0 / defasados)
  const topSectorGroups = useMemo(() => {
    if (!unifiedAporte || !unifiedAporte.sectorGroups) return [];
    return unifiedAporte.sectorGroups
      .filter((g) => (g.budgetAllocatedBRL > 0 || g.gapBRL > 0 || g.deficitRel > 0) && g.assets.length > 0)
      .slice(0, 3);
  }, [unifiedAporte]);

  // Top 3 sugestões diretas por ativo para retrocompatibilidade e modo prescritivo
  const aporteSuggestions = useMemo(
    () =>
      hasTargets
        ? buildAporteSuggestions(existingAssets, assetRows, targets, totalPortfolioBRL, 3, classTargets, sectorTargets)
        : [],
    [hasTargets, existingAssets, assetRows, targets, classTargets, sectorTargets, totalPortfolioBRL],
  );

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

      {/* Lista unificada */}
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

        {/* Sem busca: aviso se não há metas + sugestões enriquecidas ou ativos da carteira */}
        {!isSearching ? (
          !hasTargets ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface/80 p-3 text-xs text-muted-foreground">
                <Sparkles className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
                <span>
                  Sugestões automáticas de rebalanceamento só aparecem quando há metas configuradas. Defina suas metas na aba <strong>Metas de Alocação</strong> para calcular a distribuição do aporte.
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
                          <span className="text-xs font-semibold text-primary">Aportar</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{asset.quantity} cota(s)</span>
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
                        <span className="text-xs font-semibold text-primary">Aportar</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{asset.quantity} cota(s)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {/* Barra seletora de visualização (Radar de Setores vs Por Ativo Direto) */}
              {topSectorGroups.length > 0 && (
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-1.5 bg-surface-hover/50 p-1 rounded-xl border border-border/60">
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("sector_radar");
                        triggerSensory("selection");
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === "sector_radar"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>Radar de Setores</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("direct_asset");
                        triggerSensory("selection");
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === "direct_asset"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Target className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>Por Ativo Direto</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    {viewMode === "sector_radar" ? "Top 3 setores prioritários" : "Top 3 ativos diretos"}
                  </span>
                </div>
              )}

              {/* MODO RADAR DE SETORES (Estritamente Top 3 Setores Prioritários) */}
              {viewMode === "sector_radar" && topSectorGroups.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {topSectorGroups.map((group) => {
                    const groupKey = `${group.className}::${group.sectorName}`;
                    // Exibe até 2 ativos de maior oportunidade para manter o card enxuto e sem expansor
                    const displayAssets = group.assets.slice(0, 2);

                    return (
                      <div
                        key={groupKey}
                        className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface/70 p-3 sm:p-3.5 shadow-xs transition-all hover:border-border"
                      >
                        {/* Cabeçalho do Setor */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/50 pb-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                              {sanitizeReportText(group.sectorName)}
                            </span>
                            <Badge variant="muted" size="xs">
                              {group.className}
                            </Badge>
                            <Badge variant="positive" size="xs">
                              Defasado
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Orçamento estimado:</span>
                            <MoneyText
                              cents={numberToCents(group.budgetAllocatedBRL)}
                              tone="positive"
                              className="font-bold text-positive-strong tabular-nums"
                            />
                          </div>
                        </div>

                        {/* Lista de Ativos Prioritários do Setor */}
                        <div className="flex flex-col gap-1.5">
                          {displayAssets.map((opp) => {
                            const isSelected = currentCleanTicker === cleanTicker(opp.ticker);
                            const isDiscounted = opp.diffVsAveragePct < 0;

                            return (
                              <button
                                key={opp.assetId}
                                type="button"
                                onClick={() => handleSelectOpportunity(opp, group.gapBRL)}
                                className={cn(
                                  "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] cursor-pointer",
                                  isSelected
                                    ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-xs"
                                    : isDiscounted
                                      ? "border-positive/30 bg-positive/5 hover:border-positive/50 hover:bg-positive/10"
                                      : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover",
                                )}
                              >
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-sm font-bold text-foreground">
                                      {opp.ticker}
                                    </span>
                                    {isDiscounted ? (
                                      <Badge variant="positive" size="xs" className="max-w-full truncate inline-flex">
                                        {`-${Math.abs(opp.diffVsAveragePct).toFixed(1)}% vs PM`}
                                      </Badge>
                                    ) : (
                                      <Badge variant="muted" size="xs" className="max-w-full truncate inline-flex">
                                        {`+${opp.diffVsAveragePct.toFixed(1)}% vs PM`}
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <Badge variant="default" size="xs" className="gap-1 bg-primary text-primary-foreground shrink-0">
                                        <Check className="size-3" aria-hidden="true" />
                                        Selecionado
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="truncate text-xs text-muted-foreground">{opp.name}</span>
                                </div>

                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                  <span className="text-xs font-semibold text-primary">
                                    {opp.suggestedQty > 0 ? `Aportar ${opp.suggestedQty} cota(s)` : "Aportar"}
                                  </span>
                                  {opp.suggestedTotalBRL > 0 && (
                                    <MoneyText
                                      cents={numberToCents(opp.suggestedTotalBRL)}
                                      tone="default"
                                      className="text-xs tabular-nums whitespace-nowrap text-muted-foreground font-medium"
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
              ) : (
                /* MODO POR ATIVO DIRETO (Estritamente Top 3 Ativos) */
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
                        const precision = resolveAssetPrecision({
                          assetClass: item.assetClass,
                          ticker: item.ticker,
                          currency: (asset?.currency ?? "BRL") as "BRL" | "USD",
                        });
                        if (precision > 0) {
                          const factor = 10 ** precision;
                          const maxUsefulQty = Math.floor((item.gapBRL / priceBRL) * factor) / factor;
                          const cashQty = Math.floor((cashAvailableBRL / priceBRL) * factor) / factor;
                          const sharesFit = Math.min(maxUsefulQty, cashQty);
                          if (sharesFit > 0) {
                            cashInfo = {
                              text: `Cabe no caixa: ${parseFloat(sharesFit.toFixed(precision))} cota${sharesFit > 1 ? "s" : ""} (~`,
                              costBRL: sharesFit * priceBRL,
                              fits: true,
                            };
                          } else {
                            cashInfo = {
                              text: "Saldo em caixa insuficiente para aporte",
                              fits: false,
                            };
                          }
                        } else {
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
                    }

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
                            <Badge variant="muted" size="xs">Na carteira</Badge>
                            {isSelected && (
                              <Badge variant="default" size="xs" className="gap-1 bg-primary text-primary-foreground shrink-0">
                                <Check className="size-3" aria-hidden="true" />
                                Selecionado
                              </Badge>
                            )}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">{name}</span>
                          <div className="flex flex-col gap-0.5 pt-0.5 text-xs text-muted-foreground">
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
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <span className="text-xs font-semibold text-primary">Aportar</span>
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
                    {suggestion ? (
                      <span className="text-xs text-muted-foreground pt-0.5">
                        {`Meta: ${suggestion.targetPercentage}%`}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    {res.isExisting ? (
                      <>
                        <span className="text-xs font-semibold text-primary">Aportar</span>
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
        )}
      </div>
    </div>
  );
}
