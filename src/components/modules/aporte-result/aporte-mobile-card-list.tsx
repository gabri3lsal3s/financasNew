import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks";
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
              "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs transition-opacity",
              isDone && "opacity-75",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Checkbox
                  checked={eff?.isSelected ?? false}
                  disabled={row.quantity <= 0}
                  onCheckedChange={(checked) => onToggleAssetSelection(row.assetId, checked)}
                  aria-label={`Selecionar ${row.ticker} para aporte`}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
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
                      <Badge variant={row.rawScore === null ? "warning" : "muted"} size="xs" className="shrink-0">
                        {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                      </Badge>
                    ) : null}
                  </div>
                  {metaLine ? (
                    <span className="text-[11px] text-muted-foreground font-medium truncate" title={row.formulaLabel}>
                      {metaLine}
                    </span>
                  ) : null}
                </div>
              </div>

              <AporteRowActions
                ticker={row.ticker}
                isDone={isDone}
                quantity={eff?.effectiveQuantity ?? row.quantity}
                allocatedBRL={eff?.effectiveAllocatedBRL ?? row.allocatedBRL}
                onToggleDone={onToggleTicker}
                onOpenWizard={onOpenWizard}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-border/50">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Aporte Sugerido
                </span>
                <MoneyText
                  cents={numberToCents(eff?.effectiveAllocatedBRL ?? row.allocatedBRL)}
                  tone="portfolio"
                  className="text-sm font-bold"
                />
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
                    className="w-20 px-2 text-right"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                  <span>@</span>
                  <MoneyText
                    cents={numberToCents(row.priceBRL)}
                    variant="caption"
                    tone="default"
                    className="text-[10px] text-muted-foreground font-normal"
                  />
                  {eff?.isQuantityCustom ? (
                    <span>(sug: {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)})</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-1 items-end text-right min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Atual <ArrowRight className="size-2.5 inline-block" aria-hidden="true" /> Alvo
                </span>
                <MoneyText
                  cents={numberToCents(row.currentValueBRL)}
                  variant="caption"
                  tone="default"
                  className="text-muted-foreground font-medium"
                />
                <span className="text-[10px] font-medium text-foreground inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Alvo:</span>
                  <MoneyText
                    cents={numberToCents(row.targetValueBRL)}
                    variant="caption"
                    tone="default"
                    className="text-[10px] font-medium text-foreground"
                  />
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
