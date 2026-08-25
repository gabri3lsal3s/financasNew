import { Fragment, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, PieChart, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/reports";

export interface InvestmentsTabProps {
  totalPatrimonyBRL: number;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  expandedTreeClasses: Set<string>;
  setExpandedTreeClasses: Dispatch<SetStateAction<Set<string>>>;
  expandedTreeSectors: Set<string>;
  setExpandedTreeSectors: Dispatch<SetStateAction<Set<string>>>;
  onOpenTearSheet: () => void;
}

/**
 * Aba "Investimentos & Carteira" — cards de patrimônio/aderência/concentração
 * e tabela em árvore hierárquica (Classe -> Setor -> Ativos).
 */
export function InvestmentsTab({
  totalPatrimonyBRL,
  allocationAnalysis,
  concentrationRisk,
  expandedTreeClasses,
  setExpandedTreeClasses,
  expandedTreeSectors,
  setExpandedTreeSectors,
  onOpenTearSheet,
}: InvestmentsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Card Dossiê Executivo A4 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-portfolio shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê Executivo de Alocação & Patrimônio (A4/PDF)</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Documento de consultoria patrimonial com diagnóstico de defasagem de metas (Target vs. Actual), risco de concentração e custódia.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenTearSheet}
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Printer className="size-4" aria-hidden="true" />
          Visualizar & Imprimir Dossiê A4
        </Button>
      </div>

      {/* Resumo da Alocação, Metas & Concentração Setorial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Patrimônio Consolidado</span>
          <MoneyText cents={numberToCents(totalPatrimonyBRL)} tone="portfolio" animated className="text-lg sm:text-xl font-bold font-display whitespace-nowrap" />
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Aderência às Metas</span>
          <span className="text-lg sm:text-xl font-bold font-display text-primary-strong">{allocationAnalysis.alignmentScore}%</span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top 5 Concentração</span>
          <span className="text-lg sm:text-xl font-bold font-display text-foreground">{concentrationRisk.top5Pct.toFixed(1)}%</span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top Setor Dominante</span>
          <div className="flex items-center justify-between gap-1 truncate">
            <span className="text-sm sm:text-base font-bold font-display text-foreground truncate">
              {concentrationRisk.topSectorDominance?.sector ?? "Nenhum"}
            </span>
            <span className="text-xs font-bold text-portfolio shrink-0">
              {concentrationRisk.topSectorDominance ? `${concentrationRisk.topSectorDominance.pct.toFixed(1)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabela em Árvore Hierárquica de Gaps (Classe -> Setor -> Ativos) */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Defasagem de Metas Hierárquica (Classe ➔ Setor ➔ Ativos)</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {allocationAnalysis.topDeficitClass ? (
              <span className="text-[11px] font-semibold text-primary-strong bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                Prioridade Classe: {allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}
              </span>
            ) : null}
            {allocationAnalysis.topDeficitSector ? (
              <span className="text-[11px] font-semibold text-portfolio bg-portfolio/10 px-2 py-0.5 rounded-md border border-portfolio/20">
                Prioridade Setor: {allocationAnalysis.topDeficitSector.sectorName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <span className="text-muted-foreground text-[11px]">
            Clique nas linhas para expandir/recolher os setores e ativos vinculados.
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
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
              className="h-7 px-2 text-[11px]"
            >
              Expandir tudo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpandedTreeClasses(new Set());
                setExpandedTreeSectors(new Set());
              }}
              className="h-7 px-2 text-[11px]"
            >
              Recolher tudo
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/80">
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
            <tbody className="divide-y divide-border/60">
              {allocationAnalysis.treeNodes.map((cNode) => {
                const isClassExpanded = expandedTreeClasses.has(cNode.assetClass);
                return (
                  <Fragment key={cNode.assetClass}>
                    <tr
                      onClick={() => {
                        setExpandedTreeClasses((prev) => {
                          const next = new Set(prev);
                          if (next.has(cNode.assetClass)) next.delete(cNode.assetClass);
                          else next.add(cNode.assetClass);
                          return next;
                        });
                      }}
                      className="bg-muted/25 hover:bg-muted/40 cursor-pointer font-semibold select-none"
                    >
                      <td className="py-2.5 px-3 text-foreground">
                        <div className="flex items-center gap-1.5">
                          {isClassExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          )}
                          <span className="capitalize">{cNode.assetClass}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({cNode.sectors.length} setores)
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <MoneyText cents={numberToCents(cNode.currentBRL)} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{cNode.currentPct.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {cNode.targetPct > 0 ? `${cNode.targetPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {cNode.gapBRL > 0 ? (
                          <MoneyText cents={numberToCents(cNode.gapBRL)} tone="portfolio" className="font-bold" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            cNode.status === "deficit"
                              ? "bg-primary/10 text-primary-strong border border-primary/20"
                              : cNode.status === "surplus"
                                ? "bg-surface-hover text-muted-foreground border border-border"
                                : "bg-positive/10 text-positive-strong border border-positive/20"
                          }`}
                        >
                          {cNode.status === "deficit" ? "Aportar" : cNode.status === "surplus" ? "Acima da Meta" : "Equilibrado"}
                        </span>
                      </td>
                    </tr>

                    {isClassExpanded &&
                      cNode.sectors.map((sNode) => {
                        const sectorKey = `${cNode.assetClass}::${sNode.sectorName}`;
                        const isSectorExpanded = expandedTreeSectors.has(sectorKey);

                        return (
                          <Fragment key={sectorKey}>
                            <tr
                              onClick={() => {
                                setExpandedTreeSectors((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(sectorKey)) next.delete(sectorKey);
                                  else next.add(sectorKey);
                                  return next;
                                });
                              }}
                              className="bg-surface hover:bg-muted/15 cursor-pointer font-medium select-none"
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
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      (Meta na classe: {sNode.targetPctInClass}%)
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                <MoneyText cents={numberToCents(sNode.currentBRL)} />
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                {sNode.currentPct.toFixed(1)}%
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                {sNode.effectiveTargetPct > 0 ? `${sNode.effectiveTargetPct.toFixed(1)}%` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {sNode.gapBRL > 0 ? (
                                  <MoneyText cents={numberToCents(sNode.gapBRL)} tone="portfolio" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                                    sNode.status === "deficit"
                                      ? "bg-primary/10 text-primary-strong border border-primary/20"
                                      : sNode.status === "surplus"
                                        ? "bg-surface-hover text-muted-foreground border border-border"
                                        : "bg-positive/10 text-positive-strong border border-positive/20"
                                  }`}
                                >
                                  {sNode.status === "deficit" ? "Aportar" : sNode.status === "surplus" ? "Na Meta" : "Equilibrado"}
                                </span>
                              </td>
                            </tr>

                            {isSectorExpanded &&
                              sNode.assets.map((aNode) => (
                                <tr key={aNode.id} className="hover:bg-muted/20 text-muted-foreground">
                                  <td className="py-1.5 px-3 pl-14 font-mono font-semibold text-foreground">
                                    {aNode.ticker}
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-xs">
                                    <MoneyText cents={numberToCents(aNode.currentBRL)} />
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-xs">
                                    {aNode.currentPct.toFixed(1)}%
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-xs">
                                    {aNode.targetPct > 0 ? `${aNode.targetPct.toFixed(1)}%` : "—"}
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-xs">
                                    {aNode.gapBRL > 0 ? (
                                      <MoneyText cents={numberToCents(aNode.gapBRL)} tone="default" />
                                    ) : (
                                      <span>—</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 text-center text-[10px]">
                                    {aNode.status === "deficit" ? "Déficit" : aNode.status === "surplus" ? "Excedente" : "Ok"}
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
