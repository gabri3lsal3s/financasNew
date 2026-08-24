import { useState, useMemo } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderTree,
  Info,
  Layers,
  ListOrdered,
  PiggyBank,
  PieChart,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ClassAporteSummary, SectorAporteSummary, SkippedAssetDiagnostic } from "@/domain/portfolio";
import { triggerHaptic } from "@/services/haptics";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface AporteRouteRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  allocatedBRL: number;
  quantity: number;
  priceBRL: number;
}

export interface AporteResultProps {
  mode: "asset" | "class" | "both";
  aporte: number;
  totalAllocated: number;
  leftover: number;
  routes: AporteRouteRow[];
  classSummaries?: ClassAporteSummary[];
  sectorSummaries?: SectorAporteSummary[];
  skippedAssets?: SkippedAssetDiagnostic[];
  /** Ação rápida para gravar todas as transações sugeridas no extrato */
  onExecuteAporte?: () => void;
  executing?: boolean;
}

const MODE_LABEL: Record<AporteResultProps["mode"], string> = {
  asset: "por meta individual",
  class: "por estabilização de classe",
  both: "hierárquico (ativo, setor e classe)",
};

const SKIPPED_REASON_LABEL: Record<SkippedAssetDiagnostic["reason"], { label: string; variant: "warning" | "muted" }> = {
  no_price: { label: "Sem cotação", variant: "warning" },
  above_target: { label: "Na meta", variant: "muted" },
  no_target: { label: "Sem meta", variant: "muted" },
  price_exceeds_budget: { label: "Preço > Saldo", variant: "muted" },
};

function formatQuantity(qty: number): string {
  if (qty % 1 === 0) return qty.toLocaleString("pt-BR");
  return qty.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Visão hierárquica em três níveis: Macro por Classe, Meso por Setor e Micro por Ativo,
 * com log de roteamento, visualização em lista/árvore e diagnóstico completo.
 */
export function AporteResult({
  mode,
  aporte,
  totalAllocated,
  leftover,
  routes,
  classSummaries = [],
  sectorSummaries = [],
  skippedAssets = [],
  onExecuteAporte,
  executing = false,
}: AporteResultProps) {
  const [completedTickers, setCompletedTickers] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(() => new Set());
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [showAllSectors, setShowAllSectors] = useState(false);

  const toggleTicker = (ticker: string) => {
    setCompletedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
        triggerHaptic("light");
      } else {
        next.add(ticker);
        triggerHaptic("success");
      }
      return next;
    });
  };

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const toggleSector = (sectorKey: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorKey)) {
        next.delete(sectorKey);
      } else {
        next.add(sectorKey);
      }
      return next;
    });
  };

  const completedCount = completedTickers.size;

  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      if (b.allocatedBRL !== a.allocatedBRL) return b.allocatedBRL - a.allocatedBRL;
      return a.gapBRL - b.gapBRL;
    });
  }, [routes]);

  // Estrutura agrupada para modo Árvore (Classe -> Setor -> Ativos)
  const treeGroups = useMemo(() => {
    const classMap = new Map<
      string,
      {
        className: string;
        classSummary?: ClassAporteSummary;
        totalAllocatedBRL: number;
        totalGapBRL: number;
        sectors: Map<
          string,
          {
            sectorName: string;
            sectorSummary?: SectorAporteSummary;
            totalAllocatedBRL: number;
            totalGapBRL: number;
            routes: AporteRouteRow[];
          }
        >;
      }
    >();

    for (const r of sortedRoutes) {
      const cls = r.assetClass?.trim() || "Outros";
      const sec = r.sector?.trim() || "Geral";

      let cGroup = classMap.get(cls);
      if (!cGroup) {
        cGroup = {
          className: cls,
          classSummary: classSummaries.find((cs) => cs.className === cls),
          totalAllocatedBRL: 0,
          totalGapBRL: 0,
          sectors: new Map(),
        };
        classMap.set(cls, cGroup);
      }

      cGroup.totalAllocatedBRL += r.allocatedBRL;
      cGroup.totalGapBRL += r.gapBRL;

      let sGroup = cGroup.sectors.get(sec);
      if (!sGroup) {
        sGroup = {
          sectorName: sec,
          sectorSummary: sectorSummaries.find((ss) => ss.className === cls && ss.sectorName === sec),
          totalAllocatedBRL: 0,
          totalGapBRL: 0,
          routes: [],
        };
        cGroup.sectors.set(sec, sGroup);
      }

      sGroup.totalAllocatedBRL += r.allocatedBRL;
      sGroup.totalGapBRL += r.gapBRL;
      sGroup.routes.push(r);
    }

    return Array.from(classMap.values());
  }, [sortedRoutes, classSummaries, sectorSummaries]);

  const columns: {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    cell: (row: AporteRouteRow) => ReactNode;
  }[] = [
    {
      key: "ticker",
      header: "Ativo",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        return (
          <div className={cn("flex min-w-0 flex-col gap-0.5 transition-opacity duration-150", isDone && "opacity-60")}>
            <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
              {row.sector ? (
                <>
                  <span className="text-[10px] text-muted-foreground/60">•</span>
                  <span className="text-[11px] text-muted-foreground font-medium">{row.sector}</span>
                </>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: "target",
      header: "Valor alvo",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.targetValueBRL)} tone="default" />,
    },
    {
      key: "current",
      header: "Atual",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.currentValueBRL)} tone="default" className="text-muted-foreground" />,
    },
    {
      key: "allocated",
      header: "Aporte sugerido",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.allocatedBRL)} tone="portfolio" />,
    },
    {
      key: "quantity",
      header: "Quantidade",
      align: "right",
      cell: (row) => <span className="num text-sm text-muted-foreground">{formatQuantity(row.quantity)}</span>,
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-muted-foreground" />,
    },
    {
      key: "status",
      header: "Execução",
      align: "right",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        return (
          <button
            type="button"
            onClick={() => toggleTicker(row.ticker)}
            aria-label={isDone ? `Marcar ${row.ticker} como pendente` : `Marcar ${row.ticker} como executado`}
            className={cn(
              "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              isDone
                ? "border border-positive/30 bg-positive/10 text-positive-strong animate-spring-pop"
                : "border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-95",
            )}
          >
            {isDone ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                <span>Feito</span>
              </>
            ) : (
              <span>Pendente</span>
            )}
          </button>
        );
      },
    },
  ];

  // 1. Classes: Ordenadas por aporte alocado desc, depois gap desc
  const sortedClasses = useMemo(() => {
    return classSummaries
      .filter((c) => c.actualAllocatedBRL > 0 || c.gapBRL > 0)
      .sort((a, b) => {
        if (b.actualAllocatedBRL !== a.actualAllocatedBRL) {
          return b.actualAllocatedBRL - a.actualAllocatedBRL;
        }
        return b.gapBRL - a.gapBRL;
      });
  }, [classSummaries]);

  const allocatedClassesCount = useMemo(
    () => sortedClasses.filter((c) => c.actualAllocatedBRL > 0).length,
    [sortedClasses],
  );

  const displayedClasses = useMemo(() => {
    if (showAllClasses) return sortedClasses;
    const withAlloc = sortedClasses.filter((c) => c.actualAllocatedBRL > 0);
    return withAlloc.length > 0 ? withAlloc : sortedClasses.slice(0, 3);
  }, [showAllClasses, sortedClasses]);

  const canToggleClasses = sortedClasses.length > displayedClasses.length || showAllClasses;

  // 2. Setores: Ordenados por aporte alocado desc, depois gap desc
  const sortedSectors = useMemo(() => {
    return sectorSummaries
      .filter((s) => s.actualAllocatedBRL > 0 || s.gapBRL > 0)
      .sort((a, b) => {
        if (b.actualAllocatedBRL !== a.actualAllocatedBRL) {
          return b.actualAllocatedBRL - a.actualAllocatedBRL;
        }
        return b.gapBRL - a.gapBRL;
      });
  }, [sectorSummaries]);

  const allocatedSectorsCount = useMemo(
    () => sortedSectors.filter((s) => s.actualAllocatedBRL > 0).length,
    [sortedSectors],
  );

  const displayedSectors = useMemo(() => {
    if (showAllSectors) return sortedSectors;
    const withAlloc = sortedSectors.filter((s) => s.actualAllocatedBRL > 0);
    return withAlloc.length > 0 ? withAlloc : sortedSectors.slice(0, 3);
  }, [showAllSectors, sortedSectors]);

  const canToggleSectors = sortedSectors.length > displayedSectors.length || showAllSectors;

  return (
    <section aria-label="Resultado da simulação de aporte" className="flex flex-col gap-4 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <ResultStat icon={<PiggyBank className="size-4 shrink-0" aria-hidden="true" />} label="Aporte informado" cents={numberToCents(aporte)} />
        <ResultStat
          icon={<ArrowDownToLine className="size-4 shrink-0" aria-hidden="true" />}
          label={completedCount > 0 ? `Alocado (${completedCount}/${routes.length} feitos)` : "Alocado em ativos"}
          cents={numberToCents(totalAllocated)}
          accent
        />
        <ResultStat
          icon={<Wallet className="size-4 shrink-0" aria-hidden="true" />}
          label="Sobra para caixa"
          cents={numberToCents(leftover)}
          tone={leftover > 0 ? "attention" : "neutral"}
        />
      </div>

      {/* 1. Macro por Classe */}
      {sortedClasses.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              <Layers className="size-3.5 text-portfolio" aria-hidden="true" />
              <span>Distribuição Macro por Classe</span>
            </div>
            {canToggleClasses && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                  {allocatedClassesCount > 0
                    ? `${allocatedClassesCount} com aporte de ${sortedClasses.length}`
                    : `${sortedClasses.length} classes`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllClasses((prev) => !prev)}
                  className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1"
                >
                  <span>{showAllClasses ? "Recolher" : `Ver todas (${sortedClasses.length})`}</span>
                  {showAllClasses ? (
                    <ChevronUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {displayedClasses.map((cls) => (
              <div
                key={cls.className}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium text-foreground truncate">{cls.className || "Sem classe"}</span>
                  <span className="text-[11px] text-muted-foreground">Meta: {cls.targetPct}%</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <MoneyText cents={numberToCents(cls.actualAllocatedBRL)} tone={cls.actualAllocatedBRL > 0 ? "portfolio" : "default"} className="font-semibold text-xs" />
                  <span className="text-[10px] text-muted-foreground">Gap: R$ {cls.gapBRL.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2. Meso por Setor */}
      {sortedSectors.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              <PieChart className="size-3.5 text-portfolio" aria-hidden="true" />
              <span>Distribuição Meso por Setor</span>
            </div>
            {canToggleSectors && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                  {allocatedSectorsCount > 0
                    ? `${allocatedSectorsCount} com aporte de ${sortedSectors.length}`
                    : `${sortedSectors.length} setores`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllSectors((prev) => !prev)}
                  className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1"
                >
                  <span>{showAllSectors ? "Recolher" : `Ver todos (${sortedSectors.length})`}</span>
                  {showAllSectors ? (
                    <ChevronUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  )}
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {displayedSectors.map((sec) => (
              <div
                key={`${sec.className}::${sec.sectorName}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium text-foreground truncate">{sec.sectorName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {sec.className} {sec.targetPctInClass > 0 ? `• Meta: ${sec.targetPctInClass}%` : ""}
                  </span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <MoneyText cents={numberToCents(sec.actualAllocatedBRL)} tone={sec.actualAllocatedBRL > 0 ? "portfolio" : "default"} className="font-semibold text-xs" />
                  <span className="text-[10px] text-muted-foreground">Gap: R$ {sec.gapBRL.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Roteamento <span className="font-medium text-foreground">{MODE_LABEL[mode]}</span>: estabilização macro das classes,
        distribuição meso por setores e alocação nos ativos com maior gap.
      </p>

      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum ativo elegível: defina metas abaixo da posição atual (gap positivo) com preço disponível.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider truncate">Detalhamento dos aportes</h3>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer",
                    viewMode === "list" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Visualização em lista por prioridade"
                >
                  <ListOrdered className="size-3" aria-hidden="true" />
                  <span>Prioridade</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("tree")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer",
                    viewMode === "tree" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Visualização hierárquica (Classe -> Setor -> Ativos)"
                >
                  <FolderTree className="size-3" aria-hidden="true" />
                  <span>Árvore</span>
                </button>
              </div>
            </div>
            {onExecuteAporte && routes.some((r) => r.quantity > 0) ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onExecuteAporte}
                disabled={executing}
                className="gap-1.5 shrink-0"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                <span>{executing ? "Lançando…" : "Lançar compras no extrato"}</span>
              </Button>
            ) : null}
          </div>

          {viewMode === "list" ? (
            <DataList
              columns={columns}
              rows={sortedRoutes}
              rowKey={(row, index) => `${row.ticker}:${index}`}
              density="compact"
              emptyMessage="Sem sugestão de aporte."
            />
          ) : (
            /* Visualização em Árvore Hierárquica */
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
                    <th className="py-2.5 px-3">Hierarquia / Ativo</th>
                    <th className="py-2.5 px-3 text-right">Alvo</th>
                    <th className="py-2.5 px-3 text-right">Atual</th>
                    <th className="py-2.5 px-3 text-right">Aporte Sugerido</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Preço</th>
                    <th className="py-2.5 px-3 text-right">Execução</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {treeGroups.map((cGroup) => {
                    const isClassExpanded = !expandedClasses.has(cGroup.className);
                    return (
                      <ReactNodeFragment key={cGroup.className}>
                        {/* Linha da Classe */}
                        <tr
                          onClick={() => toggleClass(cGroup.className)}
                          className="bg-muted/20 hover:bg-muted/30 cursor-pointer font-semibold"
                        >
                          <td className="py-2 px-3 text-foreground" colSpan={3}>
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
                          <td className="py-2 px-3 text-right font-mono text-portfolio">
                            <MoneyText cents={numberToCents(cGroup.totalAllocatedBRL)} tone="portfolio" />
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground" colSpan={3}>
                            <span className="text-[11px]">Gap Total: R$ {cGroup.totalGapBRL.toFixed(0)}</span>
                          </td>
                        </tr>

                        {isClassExpanded &&
                          Array.from(cGroup.sectors.values()).map((sGroup) => {
                            const sectorKey = `${cGroup.className}::${sGroup.sectorName}`;
                            const isSectorExpanded = !expandedSectors.has(sectorKey);

                            return (
                              <ReactNodeFragment key={sectorKey}>
                                {/* Linha do Setor */}
                                <tr
                                  onClick={() => toggleSector(sectorKey)}
                                  className="bg-surface hover:bg-muted/10 cursor-pointer font-medium"
                                >
                                  <td className="py-1.5 px-3 pl-8 text-foreground" colSpan={3}>
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
                                  <td className="py-1.5 px-3 text-right font-mono">
                                    <MoneyText cents={numberToCents(sGroup.totalAllocatedBRL)} tone="default" className="text-xs" />
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-muted-foreground" colSpan={3}>
                                    <span className="text-[10px]">{sGroup.routes.length} ativos</span>
                                  </td>
                                </tr>

                                {/* Linhas dos Ativos */}
                                {isSectorExpanded &&
                                  sGroup.routes.map((r) => {
                                    const isDone = completedTickers.has(r.ticker);
                                    return (
                                      <tr
                                        key={r.assetId}
                                        className={cn("hover:bg-muted/20 transition-opacity", isDone && "opacity-60")}
                                      >
                                        <td className="py-2 px-3 pl-14 font-mono font-semibold text-foreground">
                                          {r.ticker}
                                        </td>
                                        <td className="py-2 px-3 text-right num font-mono">
                                          <MoneyText cents={numberToCents(r.targetValueBRL)} tone="default" />
                                        </td>
                                        <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                                          <MoneyText cents={numberToCents(r.currentValueBRL)} tone="default" />
                                        </td>
                                        <td className="py-2 px-3 text-right num font-mono font-semibold text-portfolio">
                                          <MoneyText cents={numberToCents(r.allocatedBRL)} tone="portfolio" />
                                        </td>
                                        <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                                          {formatQuantity(r.quantity)}
                                        </td>
                                        <td className="py-2 px-3 text-right num font-mono text-muted-foreground">
                                          <MoneyText cents={numberToCents(r.priceBRL)} tone="default" />
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => toggleTicker(r.ticker)}
                                            aria-label={isDone ? `Marcar ${r.ticker} como pendente` : `Marcar ${r.ticker} como executado`}
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium transition-all duration-150 cursor-pointer",
                                              isDone
                                                ? "border border-positive/30 bg-positive/10 text-positive-strong"
                                                : "border border-border bg-surface text-muted-foreground hover:border-primary/40",
                                            )}
                                          >
                                            {isDone ? (
                                              <>
                                                <Check className="size-3" aria-hidden="true" />
                                                <span>Feito</span>
                                              </>
                                            ) : (
                                              <span>Pendente</span>
                                            )}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </ReactNodeFragment>
                            );
                          })}
                      </ReactNodeFragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {skippedAssets.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/40 p-3">
          <button
            type="button"
            onClick={() => setShowSkipped(!showSkipped)}
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Ativos não contemplados neste aporte ({skippedAssets.length})</span>
            </span>
            {showSkipped ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          </button>

          {showSkipped ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {skippedAssets.map((asset) => {
                const config = SKIPPED_REASON_LABEL[asset.reason] ?? { label: asset.reason, variant: "muted" };
                return (
                  <div
                    key={asset.assetId}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface px-2.5 py-1 text-xs"
                    title={asset.detail}
                  >
                    <span className="font-mono font-medium text-foreground">{asset.ticker}</span>
                    <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReactNodeFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function ResultStat({
  icon,
  label,
  cents,
  accent = false,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  cents: number;
  accent?: boolean;
  tone?: "neutral" | "attention";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 overflow-hidden">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <MoneyText
        cents={cents}
        variant="value"
        tone="default"
        className={cn("text-lg sm:text-xl font-semibold truncate", accent && "text-portfolio", tone === "attention" && "text-warning-strong")}
      />
    </div>
  );
}

