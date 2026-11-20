import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Filter,
  Layers,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge, Button, EmptyState, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent, formatSignedPct } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { PortfolioPositionRow } from "@/state";

export interface AllocationBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "class" | "sector";
  groupName: string | null;
  parentClassName?: string | null;
  rows: PortfolioPositionRow[];
  totalPortfolioBRL: number;
  targetPercent?: number | null;
  onSelectAsset?: (assetId: string) => void;
  onNavigateToTargets?: () => void;
}

interface SectorCompositionItem {
  name: string;
  totalValueBRL: number;
  totalCostBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPct: number;
  dividendsBRL: number;
  pctOfClass: number;
  pctOfPortfolio: number;
  assetsCount: number;
}

/**
 * AllocationBreakdownDialog — Raio-X Analítico de Classes e Setores da Carteira (§F36 e §F41).
 * Suporta navegação interativa entre classes e seus setores componentes com exposições completas.
 */
export function AllocationBreakdownDialog({
  open,
  onOpenChange,
  type,
  groupName,
  parentClassName,
  rows,
  totalPortfolioBRL,
  targetPercent = null,
  onSelectAsset,
  onNavigateToTargets,
}: AllocationBreakdownDialogProps) {
  // Setor focado internamente ao navegar de uma classe para um setor componente
  const [focusedSector, setFocusedSector] = useState<string | null>(null);

  // Filtro de setor selecionado quando na visão de classe
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | null>(null);

  const activeType = focusedSector ? "sector" : type;
  const activeGroupName = focusedSector ?? groupName ?? "";
  const activeParentClass = focusedSector ? (groupName ?? parentClassName) : parentClassName;

  // Filtragem incondicional dos ativos do grupo ativo
  const matchedRows = useMemo(() => {
    if (!activeGroupName) return [];
    return rows.filter((r) => {
      if (activeType === "class") {
        return (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === activeGroupName;
      }
      const sec = r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass);
      return sec === activeGroupName && (!activeParentClass || !r.assetClass || r.assetClass === activeParentClass);
    });
  }, [rows, activeType, activeGroupName, activeParentClass]);

  // Métricas financeiras consolidadas do grupo
  const groupTotalBRL = useMemo(
    () => matchedRows.reduce((acc, r) => acc + r.valueBRL, 0),
    [matchedRows],
  );

  const groupCostBRL = useMemo(
    () => matchedRows.reduce((acc, r) => acc + r.totalCostBRL, 0),
    [matchedRows],
  );

  const groupDividendsBRL = useMemo(
    () => matchedRows.reduce((acc, r) => acc + (r.dividends ?? 0), 0),
    [matchedRows],
  );

  const groupUnrealizedPnlBRL = groupTotalBRL - groupCostBRL;
  const groupUnrealizedPct = groupCostBRL > 0 ? (groupUnrealizedPnlBRL / groupCostBRL) * 100 : 0;
  const currentPctOfPortfolio = totalPortfolioBRL > 0 ? (groupTotalBRL / totalPortfolioBRL) * 100 : 0;

  // Se estiver na visão interna de um setor que foi navegado a partir da classe, calculamos a classe mãe
  const parentClassTotalBRL = useMemo(() => {
    if (!activeParentClass) return 0;
    return rows
      .filter((r) => (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === activeParentClass)
      .reduce((acc, r) => acc + r.valueBRL, 0);
  }, [rows, activeParentClass]);

  // Meta de alocação (se fornecida e se estiver no grupo raiz)
  const isRootView = activeType === type && activeGroupName === groupName;
  const effectiveTarget = isRootView ? targetPercent : null;
  const hasTarget = effectiveTarget !== null && effectiveTarget !== undefined && effectiveTarget > 0;
  const gap = hasTarget ? effectiveTarget - currentPctOfPortfolio : 0;

  // Composição Setorial (exclusivo para Classes)
  const sectorComposition = useMemo<SectorCompositionItem[]>(() => {
    if (activeType !== "class" || matchedRows.length === 0) return [];

    const map = new Map<string, PortfolioPositionRow[]>();
    for (const row of matchedRows) {
      const sec = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
      const list = map.get(sec) ?? [];
      list.push(row);
      map.set(sec, list);
    }

    const items: SectorCompositionItem[] = [];
    for (const [secName, secRows] of map.entries()) {
      const secValue = secRows.reduce((acc, r) => acc + r.valueBRL, 0);
      const secCost = secRows.reduce((acc, r) => acc + r.totalCostBRL, 0);
      const secPnl = secValue - secCost;
      const secPnlPct = secCost > 0 ? (secPnl / secCost) * 100 : 0;
      const secDividends = secRows.reduce((acc, r) => acc + (r.dividends ?? 0), 0);

      items.push({
        name: secName,
        totalValueBRL: secValue,
        totalCostBRL: secCost,
        unrealizedPnlBRL: secPnl,
        unrealizedPct: secPnlPct,
        dividendsBRL: secDividends,
        pctOfClass: groupTotalBRL > 0 ? (secValue / groupTotalBRL) * 100 : 0,
        pctOfPortfolio: totalPortfolioBRL > 0 ? (secValue / totalPortfolioBRL) * 100 : 0,
        assetsCount: secRows.length,
      });
    }

    return items.sort((a, b) => b.totalValueBRL - a.totalValueBRL);
  }, [activeType, matchedRows, groupTotalBRL, totalPortfolioBRL]);

  // Ativos ordenados para exibição (com filtro opcional por setor)
  const sortedRows = useMemo(() => {
    const list = [...matchedRows].sort((a, b) => b.valueBRL - a.valueBRL);
    if (activeType === "class" && selectedSectorFilter) {
      return list.filter((r) => {
        const sec = r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass);
        return sec === selectedSectorFilter;
      });
    }
    return list;
  }, [matchedRows, activeType, selectedSectorFilter]);

  const handleModalOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFocusedSector(null);
      setSelectedSectorFilter(null);
    }
    onOpenChange(nextOpen);
  };

  const handleAssetClick = (assetId: string) => {
    triggerSensory("selection");
    handleModalOpenChange(false);
    onSelectAsset?.(assetId);
  };

  const handleFocusSector = (sectorName: string) => {
    triggerSensory("selection");
    setFocusedSector(sectorName);
    setSelectedSectorFilter(null);
  };

  const handleBackToClass = () => {
    triggerSensory("selection");
    setFocusedSector(null);
    setSelectedSectorFilter(null);
  };

  if (!groupName) return null;

  const hasParentBackNavigation = activeType === "sector" && Boolean(activeParentClass);

  return (
    <Modal
      open={open}
      onOpenChange={handleModalOpenChange}
      title={activeGroupName}
      size="xl"
      description={
        activeType === "class"
          ? `Raio-X da classe de ativos · ${sectorComposition.length} setor(es) · ${matchedRows.length} ativo(s) em custódia`
          : `Raio-X do setor${activeParentClass ? ` (${activeParentClass})` : ""} · ${matchedRows.length} ativo(s) em custódia`
      }
      headerActions={
        <div className="flex items-center gap-2">
          {hasParentBackNavigation ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleBackToClass}
              className="gap-1 text-xs"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              <span>Voltar para {activeParentClass}</span>
            </Button>
          ) : null}
          <Badge variant="muted" size="sm" className="gap-1 font-medium">
            {activeType === "class" ? (
              <Layers className="size-3 text-muted-foreground" aria-hidden="true" />
            ) : (
              <PieChart className="size-3 text-muted-foreground" aria-hidden="true" />
            )}
            <span>{activeType === "class" ? "Classe" : "Setor"}</span>
          </Badge>
        </div>
      }
      footer={
        <ModalFooter borderless className={onNavigateToTargets ? "sm:justify-between" : undefined}>
          <Button type="button" variant="outline" size="sm" onClick={() => handleModalOpenChange(false)}>
            Fechar
          </Button>
          {onNavigateToTargets ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                handleModalOpenChange(false);
                onNavigateToTargets();
              }}
              className="gap-1.5"
            >
              <Target className="size-3.5" aria-hidden="true" />
              <span>Ajustar metas de alocação</span>
            </Button>
          ) : null}
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {/* 4 KPIs Consolidados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Posição Atual
            </span>
            <MoneyText
              cents={numberToCents(groupTotalBRL)}
              tone="default"
              className="text-base sm:text-lg font-bold"
            />
            <span className="text-[11px] text-muted-foreground font-mono">
              {formatPercent(currentPctOfPortfolio)}% da carteira
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Meta de Alocação
            </span>
            <span className="num font-mono text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
              {hasTarget ? `${formatPercent(effectiveTarget)}%` : "Sem meta"}
            </span>
            <span
              className={cn(
                "text-[11px] font-mono font-medium",
                hasTarget && gap > 0 ? "text-positive-strong" : "text-muted-foreground",
              )}
            >
              {hasTarget
                ? gap > 0
                  ? `+${formatPercent(gap)}% (Recebe aporte)`
                  : `${formatPercent(gap)}% (Acima)`
                : "Definir nas Metas"}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Rentabilidade
            </span>
            <div
              className={cn(
                "num font-mono text-base sm:text-lg font-bold flex items-center gap-1",
                groupUnrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {groupUnrealizedPnlBRL >= 0 ? (
                <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{formatSignedPct(groupUnrealizedPct)}</span>
            </div>
            <MoneyText cents={numberToCents(groupUnrealizedPnlBRL)} sign="explicit" variant="caption" />
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Proventos Totais
            </span>
            <MoneyText
              cents={numberToCents(groupDividendsBRL)}
              tone="positive"
              className="text-base sm:text-lg font-bold"
            />
            <span className="text-[11px] text-muted-foreground">
              Custo: <MoneyText cents={numberToCents(groupCostBRL)} tone="default" variant="caption" />
            </span>
          </div>
        </div>

        {/* Seção Exclusiva de Classes: Setores que compõem a classe e suas exposições */}
        {activeType === "class" && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Setores que compõem a classe ({sectorComposition.length})
                </h4>
                {selectedSectorFilter ? (
                  <Badge variant="default" size="xs" className="gap-1">
                    <Filter className="size-3" aria-hidden="true" />
                    <span>Filtrando: {selectedSectorFilter}</span>
                  </Badge>
                ) : null}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Toque no setor para filtrar os ativos abaixo
              </span>
            </div>

            {sectorComposition.length === 0 ? (
              <EmptyState
                title="Sem setores definidos"
                description="Nenhum setor identificado nesta classe."
                headingLevel="h3"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {sectorComposition.map((sec) => {
                  const isFilterActive = selectedSectorFilter === sec.name;
                  return (
                    <div
                      key={sec.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        triggerSensory("selection");
                        setSelectedSectorFilter((prev) => (prev === sec.name ? null : sec.name));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          triggerSensory("selection");
                          setSelectedSectorFilter((prev) => (prev === sec.name ? null : sec.name));
                        }
                      }}
                      className={cn(
                        "flex flex-col gap-2.5 rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all duration-150 select-none text-left",
                        isFilterActive
                          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/80 bg-surface hover:border-primary/40 hover:bg-surface-hover/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PieChart className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          <span className="truncate text-xs font-bold text-foreground" title={sec.name}>
                            {sec.name}
                          </span>
                        </div>
                        <Badge variant="muted" size="xs" className="shrink-0 font-mono">
                          {sec.assetsCount} {sec.assetsCount === 1 ? "ativo" : "ativos"}
                        </Badge>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <MoneyText
                          cents={numberToCents(sec.totalValueBRL)}
                          tone="default"
                          className="text-sm font-bold"
                        />
                        <div
                          className={cn(
                            "num font-mono text-xs font-semibold flex items-center gap-0.5",
                            sec.unrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong",
                          )}
                        >
                          {sec.unrealizedPnlBRL >= 0 ? (
                            <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
                          )}
                          <span>{formatSignedPct(sec.unrealizedPct)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, sec.pctOfClass))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>
                            <strong className="text-foreground font-semibold">
                              {formatPercent(sec.pctOfClass)}%
                            </strong>{" "}
                            da classe
                          </span>
                          <span>{formatPercent(sec.pctOfPortfolio)}% total</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px]">
                        <span className="text-muted-foreground font-medium">
                          {isFilterActive ? "Filtro ativo" : "Filtrar ativos"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFocusSector(sec.name);
                          }}
                          className="size-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                          title={`Ver raio-x isolado de ${sec.name}`}
                          aria-label={`Ver raio-x isolado de ${sec.name}`}
                        >
                          <ChevronRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Seção de Ativos em Custódia e suas respectivas exposições */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {activeType === "class"
                  ? selectedSectorFilter
                    ? `Ativos de ${selectedSectorFilter} (${sortedRows.length})`
                    : `Ativos da Classe (${sortedRows.length})`
                  : `Ativos do Setor (${sortedRows.length})`}
              </h4>
              {selectedSectorFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedSectorFilter(null)}
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="size-3" aria-hidden="true" />
                  <span>Limpar filtro</span>
                </Button>
              ) : null}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Toque no ativo para abrir a ficha completa
            </span>
          </div>

          {sortedRows.length === 0 ? (
            <EmptyState
              title="Nenhum ativo alocado"
              description={
                selectedSectorFilter
                  ? `Nenhum ativo alocado no setor ${selectedSectorFilter}.`
                  : "Nenhum ativo alocado neste grupo."
              }
              headingLevel="h3"
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
              {sortedRows.map((row) => {
                const rowSector = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);

                // Cálculo das exposições relativas
                const sectorTotal = rows
                  .filter((r) => {
                    const sec = r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass);
                    return sec === rowSector && (!r.assetClass || r.assetClass === row.assetClass);
                  })
                  .reduce((acc, r) => acc + r.valueBRL, 0);

                const relativePctInSector = sectorTotal > 0 ? (row.valueBRL / sectorTotal) * 100 : 0;

                const classTotal =
                  activeType === "class"
                    ? groupTotalBRL
                    : parentClassTotalBRL > 0
                      ? parentClassTotalBRL
                      : rows
                          .filter((r) => r.assetClass === row.assetClass)
                          .reduce((acc, r) => acc + r.valueBRL, 0);

                const relativePctInClass = classTotal > 0 ? (row.valueBRL / classTotal) * 100 : 0;

                return (
                  <button
                    key={row.assetId}
                    type="button"
                    onClick={() => handleAssetClick(row.assetId)}
                    className="flex w-full text-left flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 hover:bg-surface-hover/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {row.ticker}
                        </span>
                        {rowSector ? (
                          <Badge variant="muted" size="xs">
                            {rowSector}
                          </Badge>
                        ) : null}
                        {row.currency === "USD" ? (
                          <Badge variant="portfolio" size="xs">
                            USD
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)} cota(s) @{" "}
                        <MoneyText
                          cents={numberToCents(row.averageCost)}
                          currency={row.currency}
                          variant="caption"
                          tone="default"
                        />
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                      <div className="flex flex-col items-start sm:items-end">
                        <MoneyText
                          cents={numberToCents(row.valueBRL)}
                          tone="default"
                          className="text-xs sm:text-sm font-semibold"
                        />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {activeType === "class" ? (
                            <>
                              <span title="Exposição relativa no setor">
                                {formatPercent(relativePctInSector)}% setor
                              </span>
                              {" · "}
                              <strong
                                className="text-foreground font-semibold"
                                title="Exposição relativa na classe"
                              >
                                {formatPercent(relativePctInClass)}% classe
                              </strong>
                              {" · "}
                              <span title="Exposição no total da carteira">
                                {formatPercent(row.pct)}% total
                              </span>
                            </>
                          ) : (
                            <>
                              <strong
                                className="text-foreground font-semibold"
                                title="Exposição relativa no setor"
                              >
                                {formatPercent(relativePctInSector)}% setor
                              </strong>
                              {relativePctInClass > 0 ? (
                                <>
                                  {" · "}
                                  <span title="Exposição relativa na classe">
                                    {formatPercent(relativePctInClass)}% classe
                                  </span>
                                </>
                              ) : null}
                              {" · "}
                              <span title="Exposição no total da carteira">
                                {formatPercent(row.pct)}% total
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 min-w-[70px]">
                        <span
                          className={cn(
                            "num font-mono text-xs font-semibold",
                            row.unrealizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong",
                          )}
                        >
                          {row.unrealizedPct !== null ? formatSignedPct(row.unrealizedPct) : "—"}
                        </span>
                        <MoneyText
                          cents={numberToCents(row.unrealizedPnl)}
                          sign="explicit"
                          variant="caption"
                        />
                      </div>
                      <ArrowUpRight
                        className="size-4 text-muted-foreground shrink-0 hidden sm:block"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}