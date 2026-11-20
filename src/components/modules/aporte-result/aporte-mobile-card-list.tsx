import { useState } from "react";
import { Check, Clock, Edit3, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
import { isAssetReviewOverdue } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks";
import { AporteReasonBadge } from "./aporte-reason-badge";
import { AporteRowActions } from "./aporte-row-actions";
import type { AporteRouteRow, EffectiveAporteRouteState } from "./aporte-result-types";

export interface AporteMobileCardListProps {
  routes: AporteRouteRow[];
  effectiveRouteMap: ReadonlyMap<string, EffectiveAporteRouteState>;
  quantityOverrides: ReadonlyMap<string, number>;
  quantityDrafts: ReadonlyMap<string, string>;
  priceOverrides?: ReadonlyMap<string, number>;
  priceDrafts?: ReadonlyMap<string, string>;
  completedTickers: ReadonlySet<string>;
  onToggleAssetSelection: (assetId: string, checked: boolean) => void;
  onQuantityChange: (assetId: string, rawStr: string) => void;
  onPriceChange?: (assetId: string, rawStr: string) => void;
  onResetAsset?: (assetId: string) => void;
  onToggleTicker: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  onInspectAsset?: (ticker: string) => void;
}

/**
 * Lista de Cards Mobile para Ordens de Aporte (§Fase 4):
 * - Modo leitura compacto por padrão com affordance de edição expansível;
 * - Font-size de 16px no mobile (`text-base sm:text-sm`) para evitar auto-zoom no iOS Safari;
 * - Toques confortáveis e zero transbordamento horizontal.
 */
export function AporteMobileCardList({
  routes,
  effectiveRouteMap,
  quantityOverrides,
  quantityDrafts,
  priceOverrides,
  priceDrafts,
  completedTickers,
  onToggleAssetSelection,
  onQuantityChange,
  onPriceChange,
  onResetAsset,
  onToggleTicker,
  onOpenWizard,
  onInspectAsset,
}: AporteMobileCardListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpand = (assetId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  if (routes.length === 0) {
    return (
      <div className="lg:hidden rounded-xl border border-border/80 bg-surface p-6 text-center text-xs text-muted-foreground shadow-xs">
        Sem sugestão de aporte.
      </div>
    );
  }

  return (
    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {routes.map((row, index) => {
        const isDone = completedTickers.has(row.ticker);
        const eff = effectiveRouteMap.get(row.assetId);
        const currentQty = quantityOverrides.get(row.assetId) ?? row.quantity;
        const draftValue = quantityDrafts.get(row.assetId) ?? String(currentQty);
        const currentPrice = priceOverrides?.get(row.assetId) ?? row.priceBRL;
        const hasCustom = eff?.isQuantityCustom || eff?.isPriceCustom;
        const isExpanded = expandedIds.has(row.assetId) || hasCustom;

        const metaLine = [
          row.sector,
          row.effectiveTargetPct !== undefined && row.effectiveTargetPct > 0
            ? `Meta ${formatPercent(row.effectiveTargetPct)}%`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={`${row.ticker}:${index}`}
            className={cn(
              "flex flex-col gap-2.5 rounded-xl border bg-surface p-3 sm:p-3.5 shadow-xs transition-opacity min-w-0",
              row.hasQualityConflict ? "border-warning/40 bg-warning/5" : "border-border/80",
              isDone && "opacity-75",
            )}
          >
            {/* Cabeçalho do Card: Identidade, Badges e Ações */}
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Checkbox
                  checked={eff?.isSelected ?? false}
                  disabled={row.quantity <= 0}
                  onCheckedChange={(checked) => onToggleAssetSelection(row.assetId, checked)}
                  aria-label={`Selecionar ${row.ticker} para aporte`}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-foreground truncate">
                      {row.ticker}
                    </span>
                    {row.isConstrainedByCeiling ? (
                      <Badge variant="muted" size="xs" className="text-[10px] font-mono" title={row.ceilingReason}>
                        {row.ceilingReason === "asset_ceiling"
                          ? "Teto Ativo"
                          : row.ceilingReason === "sector_ceiling"
                          ? "Teto Setor"
                          : row.ceilingReason === "macro_sector_ceiling"
                          ? "Teto Macro"
                          : row.ceilingReason === "issuer_ceiling"
                          ? "Teto Emissor"
                          : "Teto"}
                      </Badge>
                    ) : null}
                    {row.assetClass ? (
                      <Badge variant="muted" size="xs" className="shrink-0 font-medium max-w-full truncate text-[10px]">
                        {row.assetClass}
                      </Badge>
                    ) : null}
                    {row.rawScore !== undefined ? (
                      onInspectAsset ? (
                        <button
                          type="button"
                          onClick={() => onInspectAsset(row.ticker)}
                          className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md cursor-pointer"
                          title={`Ver tese e reavaliar nota de ${row.ticker}`}
                        >
                          <Badge
                            variant="muted"
                            size="xs"
                            className="cursor-pointer hover:border-primary/50 transition-colors font-mono text-[10px]"
                          >
                            {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="muted" size="xs" className="shrink-0 font-mono text-[10px]">
                          {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                        </Badge>
                      )
                    ) : null}
                    {row.rawScore !== null && isAssetReviewOverdue(row.lastReviewedAt, row.reviewFrequencyMonths) ? (
                      onInspectAsset ? (
                        <button
                          type="button"
                          onClick={() => onInspectAsset(row.ticker)}
                          className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning/10 hover:bg-warning/20 border border-warning/25 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          title="Tese de investimento pendente de revisão periódica. Clique para revisar critérios."
                        >
                          <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                          <span>Revisão pendente</span>
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning/10 border border-warning/25 px-1.5 py-0.5 rounded"
                          title="Tese de investimento pendente de revisão periódica."
                        >
                          <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                          <span>Revisão pendente</span>
                        </span>
                      )
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AporteReasonBadge
                      ticker={row.ticker}
                      reasonKind={row.reasonKind}
                      reasonLabel={row.reasonLabel}
                      reasonDescription={row.reasonDescription}
                      hasQualityConflict={row.hasQualityConflict}
                      qualityConflictDetail={row.qualityConflictDetail}
                      rawScore={row.rawScore}
                      onInspect={onInspectAsset ? () => onInspectAsset(row.ticker) : undefined}
                    />
                    {metaLine ? (
                      <span className="text-[11px] text-muted-foreground truncate" title={row.formulaLabel}>
                        {metaLine}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <AporteRowActions
                ticker={row.ticker}
                isDone={isDone}
                quantity={eff?.effectiveQuantity ?? row.quantity}
                allocatedBRL={eff?.effectiveAllocatedBRL ?? row.allocatedBRL}
                onToggleDone={onToggleTicker}
                onOpenWizard={onOpenWizard}
                onInspect={onInspectAsset ? () => onInspectAsset(row.ticker) : undefined}
                compact
              />
            </div>

            {/* Bloco de Valores & Cotas: Modo Leitura vs. Modo Edição */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                    Aporte:
                  </span>
                  <MoneyText
                    cents={numberToCents(eff?.effectiveAllocatedBRL ?? row.allocatedBRL)}
                    tone="portfolio"
                    className="text-sm font-bold tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasCustom && onResetAsset ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetAsset(row.assetId)}
                      title={`Restaurar cotação e quantidade sugeridas para ${row.ticker}`}
                      aria-label={`Restaurar valores sugeridos para ${row.ticker}`}
                      className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      <span>Resetar</span>
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(row.assetId)}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <Check className="size-3" aria-hidden="true" />
                        <span>Pronto</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="size-3" aria-hidden="true" />
                        <span>Ajustar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Modo Leitura: Exibição Compacta em 1 Linha */}
              {!isExpanded ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-surface-raised px-2.5 py-1.5 rounded-lg font-mono tabular-nums">
                  <span className="truncate">
                    {formatAssetQuantity(currentQty, row.assetClass ?? undefined)} cotas
                  </span>
                  <span className="text-[11px] shrink-0">
                    × R$ {currentPrice.toFixed(2)}
                  </span>
                </div>
              ) : (
                /* Modo Edição Expandido: Inputs com proteção 16px anti auto-zoom */
                <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`mobile-qty-${row.assetId}`} className="text-[11px] font-semibold text-foreground">
                      Cotas:
                    </label>
                    <NumericInput
                      id={`mobile-qty-${row.assetId}`}
                      size="sm"
                      value={draftValue}
                      onValueChange={(raw) => onQuantityChange(row.assetId, raw)}
                      aria-label={`Quantidade de cotas para ${row.ticker}`}
                      className="w-full px-2 text-right font-mono tabular-nums text-base sm:text-sm h-8"
                    />
                    {eff?.isQuantityCustom ? (
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        sug: {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor={`mobile-price-${row.assetId}`} className="text-[11px] font-semibold text-foreground">
                      Preço (R$):
                    </label>
                    {onPriceChange ? (
                      <NumericInput
                        id={`mobile-price-${row.assetId}`}
                        size="sm"
                        value={priceDrafts?.get(row.assetId) ?? String(currentPrice)}
                        onValueChange={(raw) => onPriceChange(row.assetId, raw)}
                        aria-label={`Preço unitário para ${row.ticker}`}
                        className="w-full px-2 text-right font-mono tabular-nums text-base sm:text-sm h-8"
                      />
                    ) : (
                      <div className="h-8 flex items-center justify-end px-2 rounded-md bg-surface-raised border border-border/60">
                        <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-xs font-mono" />
                      </div>
                    )}
                    {eff?.isPriceCustom ? (
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        sug: R$ {row.priceBRL.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
