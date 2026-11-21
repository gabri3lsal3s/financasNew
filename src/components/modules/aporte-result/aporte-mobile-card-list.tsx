import { useState } from "react";
import { Check, Clock, Edit3, RotateCcw } from "lucide-react";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
import { buildAporteAssetRouteBreakdown } from "@/domain/calculation-memory";
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

        const routeBreakdown = buildAporteAssetRouteBreakdown({
          ticker: row.ticker,
          assetClass: row.assetClass,
          sector: row.sector,
          currentValueBRL: row.currentValueBRL,
          targetValueBRL: row.targetValueBRL,
          gapBRL: row.gapBRL,
          priceBRL: row.priceBRL,
          quantity: eff?.effectiveQuantity ?? row.quantity,
          allocatedBRL: eff?.effectiveAllocatedBRL ?? row.allocatedBRL,
          effectiveTargetPct: row.effectiveTargetPct,
          reasonLabel: row.reasonLabel,
          ceilingReason: row.ceilingReason,
        });

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
              "group flex flex-col gap-2.5 rounded-xl border bg-surface p-3 sm:p-3.5 shadow-xs transition-opacity min-w-0",
              row.hasQualityConflict ? "border-warning/40 bg-warning/5" : "border-border/80",
              isDone && "opacity-75",
            )}
          >
            {/* 1. LINHA SUPERIOR: Identidade do Ativo & Valor do Aporte */}
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <Checkbox
                  checked={eff?.isSelected ?? false}
                  disabled={row.quantity <= 0}
                  onCheckedChange={(checked) => onToggleAssetSelection(row.assetId, checked)}
                  aria-label={`Selecionar ${row.ticker} para aporte`}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="font-mono text-sm font-bold text-foreground break-words">
                    {row.ticker}
                  </span>
                  <CalculationMemoryModal breakdown={routeBreakdown} />
                  {row.assetClass ? (
                    <Badge variant="muted" size="xs" className="shrink-0 font-medium max-w-full truncate">
                      {row.assetClass}
                    </Badge>
                  ) : null}
                  {row.isConstrainedByCeiling ? (
                    <Badge variant="muted" size="xs" className="font-mono shrink-0" title={row.ceilingReason}>
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
                </div>
              </div>

              {/* Valor do Aporte Sugerido no Topo Direito */}
              <div className="flex flex-col items-end shrink-0 text-right">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Aporte
                </span>
                <MoneyText
                  cents={numberToCents(eff?.effectiveAllocatedBRL ?? row.allocatedBRL)}
                  tone="portfolio"
                  className="text-sm font-bold tabular-nums"
                />
              </div>
            </div>

            {/* 2. LINHA DE CONTEXTO: Diagnóstico, Nota e Setor */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
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

              <div className="flex items-center gap-1.5 shrink-0">
                {row.rawScore !== undefined ? (
                  onInspectAsset ? (
                    <button
                      type="button"
                      onClick={() => onInspectAsset(row.ticker)}
                      className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md cursor-pointer shrink-0"
                      title={`Ver tese e reavaliar nota de ${row.ticker}`}
                    >
                      <Badge
                        variant="muted"
                        size="xs"
                        className="cursor-pointer hover:border-primary/50 transition-colors font-mono"
                      >
                        {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant="muted" size="xs" className="shrink-0 font-mono">
                      {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                    </Badge>
                  )
                ) : null}

                {row.rawScore !== null && isAssetReviewOverdue(row.lastReviewedAt, row.reviewFrequencyMonths) ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning/10 border border-warning/25 px-1.5 py-0.5 rounded shrink-0"
                    title="Tese de investimento pendente de revisão periódica."
                  >
                    <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                    <span>Revisar</span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* 3. LINHA DE EXECUÇÃO: Barra de Cotas & Ações Compactas */}
            <div className="flex flex-col gap-2 pt-1.5 border-t border-border/40">
              {/* Modo Leitura */}
              {!isExpanded ? (
                <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  {/* Bloco de Cotas & Preço */}
                  <div className="flex items-center gap-2 bg-surface-raised/70 border border-border/40 px-2.5 py-1.5 rounded-lg font-mono text-xs tabular-nums flex-1 min-w-[140px] shadow-2xs">
                    <span className="truncate text-foreground font-medium">
                      {formatAssetQuantity(currentQty, row.assetClass ?? undefined)} cotas
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      × R$ {currentPrice.toFixed(2)}
                    </span>
                    {hasCustom ? (
                      <Badge variant="warning" size="xs" className="font-mono ml-auto shrink-0">
                        Editado
                      </Badge>
                    ) : null}
                  </div>

                  {/* Ações Compactas à Direita */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {hasCustom && onResetAsset ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onResetAsset(row.assetId)}
                        title={`Restaurar cotação e quantidade sugeridas para ${row.ticker}`}
                        aria-label={`Restaurar valores sugeridos para ${row.ticker}`}
                        className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="size-3" aria-hidden="true" />
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(row.assetId)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer rounded-md border border-border/40 hover:border-border/80 bg-surface-raised/40 shrink-0"
                      title="Editar quantidade ou preço manualmente"
                    >
                      <Edit3 className="size-3" aria-hidden="true" />
                      <span>Ajustar</span>
                    </Button>

                    <AporteRowActions
                      ticker={row.ticker}
                      isDone={isDone}
                      quantity={eff?.effectiveQuantity ?? row.quantity}
                      allocatedBRL={eff?.effectiveAllocatedBRL ?? row.allocatedBRL}
                      onToggleDone={onToggleTicker}
                      onOpenWizard={onOpenWizard}
                      compact
                    />
                  </div>
                </div>
              ) : (
                /* Modo Edição Expandido */
                <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
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
                        className="w-full px-2 text-right font-mono tabular-nums text-base sm:text-sm h-8 border border-border/50 focus:border-primary bg-surface"
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
                          className="w-full px-2 text-right font-mono tabular-nums text-base sm:text-sm h-8 border border-border/50 focus:border-primary bg-surface"
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

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {hasCustom && onResetAsset ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onResetAsset(row.assetId)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <RotateCcw className="size-3" aria-hidden="true" />
                        <span>Restaurar original</span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => toggleExpand(row.assetId)}
                      className="h-7 px-3 text-xs font-semibold gap-1"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Concluir</span>
                    </Button>
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
