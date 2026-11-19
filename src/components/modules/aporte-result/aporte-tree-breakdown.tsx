import { Fragment, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { triggerSensory } from "@/services/sensory";
import { AporteReasonBadge } from "./aporte-reason-badge";
import { AporteRowActions } from "./aporte-row-actions";
import type { AporteTreeClassGroup, EffectiveAporteRouteState } from "./aporte-result-types";

export interface AporteTreeBreakdownProps {
  treeGroups: AporteTreeClassGroup[];
  effectiveRouteMap: ReadonlyMap<string, EffectiveAporteRouteState>;
  completedTickers: ReadonlySet<string>;
  onToggleTicker: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  onInspectAsset?: (ticker: string) => void;
}

function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

export function AporteTreeBreakdown({
  treeGroups,
  effectiveRouteMap,
  completedTickers,
  onToggleTicker,
  onOpenWizard,
  onInspectAsset,
}: AporteTreeBreakdownProps) {
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(() => new Set());
  const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(() => new Set());

  const toggleClass = (className: string) => {
    triggerSensory("selection");
    setCollapsedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  const toggleSector = (sectorKey: string) => {
    triggerSensory("selection");
    setCollapsedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorKey)) next.delete(sectorKey);
      else next.add(sectorKey);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs w-full">
      <table className="w-full min-w-[620px] text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
            <th className="py-2.5 px-3">Hierarquia / Ativo</th>
            <th className="py-2.5 px-3 text-right">Aporte Sugerido</th>
            <th className="py-2.5 px-3 text-right">Qtd</th>
            <th className="py-2.5 px-3 text-right">Preço</th>
            <th className="py-2.5 px-3 text-right">Execução</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {treeGroups.map((cGroup) => {
            const isClassExpanded = !collapsedClasses.has(cGroup.className);
            return (
              <Fragment key={cGroup.className}>
                <tr
                  tabIndex={0}
                  aria-expanded={isClassExpanded}
                  onClick={() => toggleClass(cGroup.className)}
                  onKeyDown={(e) => handleRowKeyDown(e, () => toggleClass(cGroup.className))}
                  className="bg-surface-raised hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset cursor-pointer font-semibold transition-colors"
                >
                  <td className="py-2.5 px-3 text-foreground">
                    <div className="flex items-center gap-1.5">
                      {isClassExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                      <span>{cGroup.className}</span>
                      {cGroup.classSummary?.targetPct ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          (Meta: {cGroup.classSummary.targetPct}%)
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-portfolio">
                    <MoneyText cents={numberToCents(cGroup.totalAllocatedBRL)} tone="portfolio" />
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground" colSpan={3}>
                    <span className="text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
                      <span>Gap Total:</span>
                      <MoneyText
                        cents={numberToCents(cGroup.totalGapBRL)}
                        variant="caption"
                        tone="default"
                        className="text-muted-foreground font-normal"
                      />
                    </span>
                  </td>
                </tr>

                {isClassExpanded &&
                  Array.from(cGroup.sectors.values()).map((sGroup) => {
                    const sectorKey = `${cGroup.className}::${sGroup.sectorName}`;
                    const isSectorExpanded = !collapsedSectors.has(sectorKey);

                    return (
                      <Fragment key={sectorKey}>
                        <tr
                          tabIndex={0}
                          aria-expanded={isSectorExpanded}
                          onClick={() => toggleSector(sectorKey)}
                          onKeyDown={(e) => handleRowKeyDown(e, () => toggleSector(sectorKey))}
                          className="bg-surface hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset cursor-pointer font-medium transition-colors"
                        >
                          <td className="py-2 px-3 pl-8 text-foreground">
                            <div className="flex items-center gap-1.5">
                              {isSectorExpanded ? (
                                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                              )}
                              <span className="text-xs">{sGroup.sectorName}</span>
                              {sGroup.sectorSummary?.targetPctInClass ? (
                                <span className="text-[10px] text-muted-foreground">
                                  ({sGroup.sectorSummary.targetPctInClass}%)
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            <MoneyText cents={numberToCents(sGroup.totalAllocatedBRL)} tone="default" className="text-xs" />
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground" colSpan={3}>
                            <span className="text-[10px]">
                              {sGroup.routes.length} {sGroup.routes.length === 1 ? "ativo" : "ativos"}
                            </span>
                          </td>
                        </tr>

                        {isSectorExpanded &&
                          sGroup.routes.map((r) => {
                            const eff = effectiveRouteMap.get(r.assetId);
                            const effectiveQty = eff ? eff.effectiveQuantity : r.quantity;
                            const effectiveAllocated = eff ? eff.effectiveAllocatedBRL : r.allocatedBRL;
                            const isSelected = eff ? eff.isSelected : r.quantity > 0;
                            const isDone = completedTickers.has(r.ticker);

                            return (
                              <tr
                                key={r.assetId}
                                className={cn(
                                  "hover:bg-surface-hover/40 transition-opacity",
                                  r.hasQualityConflict && "bg-warning/5",
                                  (isDone || !isSelected) && "opacity-60",
                                )}
                              >
                                <td className="py-2 px-3 pl-14">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-semibold text-foreground text-xs">
                                      {r.ticker}
                                    </span>
                                    {r.rawScore !== undefined ? (
                                      onInspectAsset ? (
                                        <button
                                          type="button"
                                          onClick={() => onInspectAsset(r.ticker)}
                                          className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                                          title={`Ver tese e reavaliar nota de ${r.ticker}`}
                                        >
                                          <Badge
                                            variant={r.rawScore === null ? "warning" : "muted"}
                                            size="xs"
                                            className="cursor-pointer hover:border-primary/50 transition-colors"
                                          >
                                            {r.rawScore === null ? "Sem nota" : `Nota ${r.rawScore}/10`}
                                          </Badge>
                                        </button>
                                      ) : (
                                        <Badge variant={r.rawScore === null ? "warning" : "muted"} size="xs">
                                          {r.rawScore === null ? "Sem nota" : `Nota ${r.rawScore}/10`}
                                        </Badge>
                                      )
                                    ) : null}
                                    <AporteReasonBadge
                                      ticker={r.ticker}
                                      reasonKind={r.reasonKind}
                                      reasonLabel={r.reasonLabel}
                                      reasonDescription={r.reasonDescription}
                                      hasQualityConflict={r.hasQualityConflict}
                                      qualityConflictDetail={r.qualityConflictDetail}
                                      rawScore={r.rawScore}
                                      onInspect={onInspectAsset ? () => onInspectAsset(r.ticker) : undefined}
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right num font-mono font-semibold text-portfolio">
                                  <MoneyText cents={numberToCents(effectiveAllocated)} tone="portfolio" />
                                </td>
                                <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                                  {formatAssetQuantity(effectiveQty, r.assetClass ?? undefined)}
                                </td>
                                <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                                  <MoneyText cents={numberToCents(r.priceBRL)} tone="default" />
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <AporteRowActions
                                    ticker={r.ticker}
                                    isDone={isDone}
                                    quantity={effectiveQty}
                                    allocatedBRL={effectiveAllocated}
                                    onToggleDone={onToggleTicker}
                                    onOpenWizard={onOpenWizard}
                                    onInspect={onInspectAsset ? () => onInspectAsset(r.ticker) : undefined}
                                    compact
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
