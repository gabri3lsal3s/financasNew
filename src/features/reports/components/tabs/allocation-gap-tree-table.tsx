import { Fragment, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, PieChart } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationAnalysisResult } from "@/domain/reports";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { AllocationGapSectorRows } from "./allocation-gap-sector-rows";

export interface AllocationGapTreeTableProps {
  allocationAnalysis: AllocationAnalysisResult;
  expandedTreeClasses: Set<string>;
  setExpandedTreeClasses: Dispatch<SetStateAction<Set<string>>>;
  expandedTreeSectors: Set<string>;
  setExpandedTreeSectors: Dispatch<SetStateAction<Set<string>>>;
}

function toggleKeyInSet(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
  triggerSensory("selection");
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

function handleRowKeyDown(onToggle: () => void) {
  return (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };
}

/**
 * Tabela hierárquica em árvore (Classe -> Setor -> Ativos) de Defasagem de Metas.
 */
export function AllocationGapTreeTable({
  allocationAnalysis,
  expandedTreeClasses,
  setExpandedTreeClasses,
  expandedTreeSectors,
  setExpandedTreeSectors,
}: AllocationGapTreeTableProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            Defasagem de Metas (Classe / Setor / Ativos)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {allocationAnalysis.topDeficitClass ? (
            <Badge variant="default" size="sm" className="max-w-full truncate inline-block">
              Prioridade Classe: {allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}
            </Badge>
          ) : null}
          {allocationAnalysis.topDeficitSector ? (
            <Badge variant="portfolio" size="sm" className="max-w-full truncate inline-block">
              Prioridade Setor: {allocationAnalysis.topDeficitSector.sectorName}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
        <span className="text-muted-foreground text-[11px]">
          Clique nas linhas para expandir/recolher os setores e ativos vinculados.
        </span>
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            sensoryIntent="selection"
            onClick={() => {
              setExpandedTreeClasses(new Set(allocationAnalysis.treeNodes.map((n) => n.assetClass)));
              setExpandedTreeSectors(
                new Set(
                  allocationAnalysis.treeNodes.flatMap((n) =>
                    n.sectors.map((s) => `${n.assetClass}::${s.sectorName}`),
                  ),
                ),
              );
            }}
            className="text-xs"
          >
            Expandir tudo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            sensoryIntent="selection"
            onClick={() => {
              setExpandedTreeClasses(new Set());
              setExpandedTreeSectors(new Set());
            }}
            className="text-xs"
          >
            Recolher tudo
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80">
        <table className="w-full min-w-[620px] text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
              <th className="py-2.5 px-3">Hierarquia / Nome</th>
              <th className="py-2.5 px-3 text-right">Atual (R$)</th>
              <th className="py-2.5 px-3 text-right">Atual (%)</th>
              <th className="py-2.5 px-3 text-right">Meta (%)</th>
              <th className="py-2.5 px-3 text-right">Gap (R$)</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {allocationAnalysis.treeNodes.map((cNode) => {
              const isClassExpanded = expandedTreeClasses.has(cNode.assetClass);
              const toggleClass = () => toggleKeyInSet(setExpandedTreeClasses, cNode.assetClass);

              return (
                <Fragment key={cNode.assetClass}>
                  <tr
                    tabIndex={0}
                    aria-expanded={isClassExpanded}
                    onClick={toggleClass}
                    onKeyDown={handleRowKeyDown(toggleClass)}
                    className="bg-muted/25 hover:bg-muted/40 cursor-pointer font-semibold select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <td className="py-2.5 px-3 text-foreground">
                      <div className="flex items-center gap-1.5">
                        {isClassExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        )}
                        <span className="capitalize">{cNode.assetClass}</span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          ({cNode.sectors.length} setores)
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <MoneyText cents={numberToCents(cNode.currentBRL)} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatPercent(cNode.currentPct)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {cNode.targetPct > 0 ? `${formatPercent(cNode.targetPct)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {cNode.gapBRL > 0 ? (
                        <MoneyText cents={numberToCents(cNode.gapBRL)} tone="portfolio" className="font-bold" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <Badge
                        variant={cNode.status === "deficit" ? "default" : cNode.status === "surplus" ? "muted" : "positive"}
                        size="xs"
                      >
                        {cNode.status === "deficit" ? "Aportar" : cNode.status === "surplus" ? "Acima da Meta" : "Equilibrado"}
                      </Badge>
                    </td>
                  </tr>

                  {isClassExpanded ? (
                    <AllocationGapSectorRows
                      assetClass={cNode.assetClass}
                      sectors={cNode.sectors}
                      expandedTreeSectors={expandedTreeSectors}
                      onToggleSector={(key) => toggleKeyInSet(setExpandedTreeSectors, key)}
                      onRowKeyDown={handleRowKeyDown}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
