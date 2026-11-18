import { Fragment, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationTreeSectorNode } from "@/domain/reports";
import { formatPercent } from "@/services/masks";

export interface AllocationGapSectorRowsProps {
  assetClass: string;
  sectors: readonly AllocationTreeSectorNode[];
  expandedTreeSectors: Set<string>;
  onToggleSector: (sectorKey: string) => void;
  onRowKeyDown: (onToggle: () => void) => (event: KeyboardEvent<HTMLTableRowElement>) => void;
}

/** Linhas expansíveis de Setores e Ativos vinculados a uma Classe na árvore de gaps. */
export function AllocationGapSectorRows({
  assetClass,
  sectors,
  expandedTreeSectors,
  onToggleSector,
  onRowKeyDown,
}: AllocationGapSectorRowsProps) {
  return (
    <>
      {sectors.map((sNode) => {
        const sectorKey = `${assetClass}::${sNode.sectorName}`;
        const isSectorExpanded = expandedTreeSectors.has(sectorKey);
        const toggle = () => onToggleSector(sectorKey);

        return (
          <Fragment key={sectorKey}>
            <tr
              tabIndex={0}
              aria-expanded={isSectorExpanded}
              onClick={toggle}
              onKeyDown={onRowKeyDown(toggle)}
              className="bg-surface hover:bg-muted/15 cursor-pointer font-medium select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <td className="py-2 px-3 pl-8 text-foreground">
                <div className="flex items-center gap-1.5">
                  {isSectorExpanded ? (
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-xs">{sNode.sectorName}</span>
                  {sNode.targetPctInClass > 0 ? (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      (Meta na classe: {sNode.targetPctInClass}%)
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="py-2 px-3 text-right font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                <MoneyText cents={numberToCents(sNode.currentBRL)} />
              </td>
              <td className="py-2 px-3 text-right font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                {formatPercent(sNode.currentPct)}%
              </td>
              <td className="py-2 px-3 text-right font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                {sNode.effectiveTargetPct > 0 ? `${formatPercent(sNode.effectiveTargetPct)}%` : "—"}
              </td>
              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                {sNode.gapBRL > 0 ? (
                  <MoneyText cents={numberToCents(sNode.gapBRL)} tone="portfolio" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 px-3 text-center whitespace-nowrap">
                <Badge
                  variant={sNode.status === "deficit" ? "default" : sNode.status === "surplus" ? "muted" : "positive"}
                  size="xs"
                >
                  {sNode.status === "deficit" ? "Aportar" : sNode.status === "surplus" ? "Na Meta" : "Equilibrado"}
                </Badge>
              </td>
            </tr>

            {isSectorExpanded &&
              sNode.assets.map((aNode) => (
                <tr key={aNode.id} className="hover:bg-muted/20 text-muted-foreground">
                  <td className="py-1.5 px-3 pl-14 font-mono font-semibold text-foreground">{aNode.ticker}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    <MoneyText cents={numberToCents(aNode.currentBRL)} />
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    {formatPercent(aNode.currentPct)}%
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    {aNode.targetPct > 0 ? `${formatPercent(aNode.targetPct)}%` : "—"}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    {aNode.gapBRL > 0 ? <MoneyText cents={numberToCents(aNode.gapBRL)} tone="default" /> : <span>—</span>}
                  </td>
                  <td className="py-1.5 px-3 text-center text-[11px] whitespace-nowrap">
                    {aNode.status === "deficit" ? "Déficit" : aNode.status === "surplus" ? "Excedente" : "Ok"}
                  </td>
                </tr>
              ))}
          </Fragment>
        );
      })}
    </>
  );
}
