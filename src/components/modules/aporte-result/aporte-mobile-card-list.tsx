import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
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
  completedTickers: ReadonlySet<string>;
  onToggleAssetSelection: (assetId: string, checked: boolean) => void;
  onQuantityChange: (assetId: string, rawStr: string) => void;
  onToggleTicker: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  onInspectAsset?: (ticker: string) => void;
}

export function AporteMobileCardList({
  routes,
  effectiveRouteMap,
  quantityOverrides,
  quantityDrafts,
  completedTickers,
  onToggleAssetSelection,
  onQuantityChange,
  onToggleTicker,
  onOpenWizard,
  onInspectAsset,
}: AporteMobileCardListProps) {
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
              "flex flex-col gap-2.5 rounded-xl border bg-surface p-3.5 shadow-xs transition-opacity",
              row.hasQualityConflict
                ? "border-warning/40 bg-warning/5"
                : "border-border/80",
              isDone && "opacity-75",
            )}
          >
            {/* Cabeçalho do Card: Identidade, Tags e Ações */}
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
                    {row.assetClass ? (
                      <Badge variant="muted" size="xs" className="shrink-0 font-medium max-w-full truncate">
                        {row.assetClass}
                      </Badge>
                    ) : null}
                    {row.rawScore !== undefined ? (
                      onInspectAsset ? (
                        <button
                          type="button"
                          onClick={() => onInspectAsset(row.ticker)}
                          className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                          title={`Ver tese e reavaliar nota de ${row.ticker}`}
                        >
                          <Badge
                            variant={row.rawScore === null ? "warning" : "muted"}
                            size="xs"
                            className="cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant={row.rawScore === null ? "warning" : "muted"} size="xs" className="shrink-0">
                          {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                        </Badge>
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

            {/* Bloco de Execução de Compra: Aporte Sugerido, Cotas e Preço Unitário */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-border/50">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  Aporte Sugerido:
                </span>
                <MoneyText
                  cents={numberToCents(eff?.effectiveAllocatedBRL ?? row.allocatedBRL)}
                  tone="portfolio"
                  className="text-base font-bold tabular-nums"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2.5">
                <div className="flex items-center gap-1.5">
                  <label htmlFor={`mobile-qty-${row.assetId}`} className="text-xs font-semibold text-foreground shrink-0">
                    Cotas:
                  </label>
                  <NumericInput
                    id={`mobile-qty-${row.assetId}`}
                    size="sm"
                    value={draftValue}
                    onValueChange={(raw) => onQuantityChange(row.assetId, raw)}
                    aria-label={`Quantidade de cotas para ${row.ticker}`}
                    className="w-20 px-2 text-right text-base sm:text-sm"
                  />
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
                  <span>@</span>
                  <MoneyText
                    cents={numberToCents(row.priceBRL)}
                    variant="caption"
                    tone="default"
                    className="text-[11px] text-muted-foreground font-normal"
                  />
                </div>
              </div>
            </div>

            {eff?.isQuantityCustom ? (
              <span className="text-[10px] text-muted-foreground font-mono text-right">
                (sugestão original: {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)})
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
