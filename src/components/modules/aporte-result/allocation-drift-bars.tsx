import { useState, useMemo, useCallback } from "react";
import { DONUT_CLASS_COLORS } from "@/domain/reports";
import { formatPercent } from "@/services/masks";
import { cn } from "@/lib/utils";

export interface DriftBarItem {
  id: string;
  name: string;
  className?: string;
  currentValueBRL: number;
  allocatedBRL: number;
  targetPct: number;
  effectiveTargetPct?: number;
  ceilingPct?: number;
}

export interface HorizontalAllocationDriftBarsProps {
  classItems: DriftBarItem[];
  sectorItems?: DriftBarItem[];
  macroItems?: DriftBarItem[];
  totalCurrentBRL: number;
  totalAllocatedBRL: number;
  className?: string;
  hideHeader?: boolean;
  scrollable?: boolean;
  activeViewMode?: DriftViewMode;
  onViewModeChange?: (mode: DriftViewMode) => void;
}

type DriftViewMode = "classes" | "macro" | "sectors";

function resolveItemClass(item: DriftBarItem): string | undefined {
  if (item.className && item.className.trim().length > 0) return item.className;
  if (item.id.includes("::")) return item.id.split("::")[0];
  return undefined;
}

function getBarColor(className?: string, name?: string): string {
  const target = className || name || "";
  const norm = target.trim().toLowerCase();
  if (norm.includes("fii") || norm.includes("imobili")) return DONUT_CLASS_COLORS.fiis ?? "#dda726";
  if (norm.includes("etf")) return DONUT_CLASS_COLORS.etfs ?? "#0284c7";
  if (
    norm.includes("fixa") ||
    norm.includes("pos") ||
    norm.includes("pre") ||
    norm.includes("ipca") ||
    norm.includes("cdb") ||
    norm.includes("tesouro")
  ) {
    return DONUT_CLASS_COLORS["renda fixa"] ?? "#2dd4bf";
  }
  if (norm.includes("inter") || norm.includes("global") || norm.includes("bdr")) {
    return DONUT_CLASS_COLORS.internacional ?? "#38bdf8";
  }
  if (norm.includes("cripto") || norm.includes("crypto") || norm.includes("btc")) {
    return DONUT_CLASS_COLORS.cripto ?? "#a855f7";
  }
  if (norm.includes("caixa") || norm.includes("cash")) return DONUT_CLASS_COLORS.caixa ?? "#10b981";
  if (
    norm.includes("ação") ||
    norm.includes("acoes") ||
    norm.includes("acao") ||
    norm.includes("stocks")
  ) {
    return DONUT_CLASS_COLORS.acoes ?? "#1b6b62";
  }
  return "#64748b";
}

/**
 * Gráfico horizontal de alocação Antes vs. Pós-Aporte (§6.1 & §Fase 4.5 Opção A):
 * - Cores temáticas consistentes por classe de ativo;
 * - Zero agrupamento artificial em "Outros" (todos os setores acessíveis por rolagem suave);
 * - Filtro de contexto por classe pai para setores com cálculo de base calibrada;
 * - Zoom inteligente proporcional ao maior percentual da visão ativa.
 */
export function HorizontalAllocationDriftBars({
  classItems,
  sectorItems = [],
  macroItems = [],
  totalCurrentBRL,
  totalAllocatedBRL,
  className,
  hideHeader = false,
  scrollable = false,
  activeViewMode,
  onViewModeChange,
}: HorizontalAllocationDriftBarsProps) {
  const [internalViewMode, setInternalViewMode] = useState<DriftViewMode>("classes");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");

  const viewMode = activeViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const totalProjectedBRL = totalCurrentBRL + totalAllocatedBRL;
  const hasAporte = totalAllocatedBRL > 0;

  // Mapa de metas das classes para proporção global dos setores
  const classTargetMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of classItems) {
      if (c.name) map.set(c.name.toLowerCase().trim(), c.targetPct);
      if (c.id) map.set(c.id.toLowerCase().trim(), c.targetPct);
    }
    return map;
  }, [classItems]);

  // Classes únicas presentes nos setores da carteira
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    sectorItems.forEach((i) => {
      const cls = resolveItemClass(i);
      if (cls) set.add(cls);
    });
    return Array.from(set);
  }, [sectorItems]);

  // Lista base ativa de itens
  const rawActiveItems = useMemo(() => {
    switch (viewMode) {
      case "macro":
        return macroItems.length > 0 ? macroItems : classItems;
      case "sectors":
        return sectorItems.length > 0 ? sectorItems : classItems;
      case "classes":
      default:
        return classItems;
    }
  }, [viewMode, classItems, macroItems, sectorItems]);

  // Base total financeira da visão ativa (global ou isolada pela classe selecionada)
  const isClassScopedSectorView = viewMode === "sectors" && selectedClassFilter !== "all";

  const activeBaseCurrentBRL = useMemo(() => {
    if (isClassScopedSectorView) {
      return sectorItems
        .filter((i) => resolveItemClass(i) === selectedClassFilter)
        .reduce((sum, i) => sum + i.currentValueBRL, 0);
    }
    return totalCurrentBRL;
  }, [isClassScopedSectorView, sectorItems, selectedClassFilter, totalCurrentBRL]);

  const activeBaseProjectedBRL = useMemo(() => {
    if (isClassScopedSectorView) {
      return sectorItems
        .filter((i) => resolveItemClass(i) === selectedClassFilter)
        .reduce((sum, i) => sum + i.currentValueBRL + i.allocatedBRL, 0);
    }
    return totalProjectedBRL;
  }, [isClassScopedSectorView, sectorItems, selectedClassFilter, totalProjectedBRL]);

  // Itens ordenados sem truncamento e sem agrupamento "Outros"
  const items = useMemo(() => {
    const baseList = isClassScopedSectorView
      ? sectorItems.filter((i) => resolveItemClass(i) === selectedClassFilter)
      : rawActiveItems;

    return [...baseList].sort((a, b) => {
      const valA = a.currentValueBRL + a.allocatedBRL;
      const valB = b.currentValueBRL + b.allocatedBRL;
      return valB - valA;
    });
  }, [rawActiveItems, isClassScopedSectorView, sectorItems, selectedClassFilter]);

  // Helper para obter a meta efetiva do item dependendo do escopo
  const getItemTargetPct = useCallback(
    (item: DriftBarItem): number => {
      if (viewMode !== "sectors") {
        return item.targetPct;
      }
      if (isClassScopedSectorView) {
        return item.targetPct;
      }
      if (item.effectiveTargetPct && item.effectiveTargetPct > 0) {
        return item.effectiveTargetPct;
      }
      const cls = resolveItemClass(item);
      if (cls) {
        const classTarget = classTargetMap.get(cls.toLowerCase().trim());
        if (classTarget !== undefined && classTarget > 0) {
          return (classTarget * item.targetPct) / 100;
        }
      }
      return item.targetPct;
    },
    [viewMode, isClassScopedSectorView, classTargetMap],
  );

  // Zoom Inteligente (MaxEscala)
  const maxValInView = useMemo(() => {
    if (items.length === 0 || activeBaseProjectedBRL <= 0) return 100;
    let max = 0;
    for (const item of items) {
      const curPct =
        activeBaseCurrentBRL > 0 ? (item.currentValueBRL / activeBaseCurrentBRL) * 100 : 0;
      const projPct =
        activeBaseProjectedBRL > 0
          ? ((item.currentValueBRL + item.allocatedBRL) / activeBaseProjectedBRL) * 100
          : curPct;
      const tgtPct = getItemTargetPct(item);
      const ceilPct = item.ceilingPct ?? 0;
      max = Math.max(max, curPct, projPct, tgtPct, ceilPct);
    }
    return max;
  }, [items, activeBaseCurrentBRL, activeBaseProjectedBRL, getItemTargetPct]);

  // Escala dinâmica calibrada para evitar espaço vazio à direita
  const scaleMax = useMemo(() => {
    if (maxValInView <= 0) return 100;
    if (maxValInView >= 85) return 100;
    return Math.min(100, Math.max(12, maxValInView * 1.12));
  }, [maxValInView]);

  if (items.length === 0 || activeBaseProjectedBRL <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs min-w-0",
        hideHeader && "border-none bg-transparent p-0 shadow-none",
        className,
      )}
    >
      {/* Cabeçalho do Card com Seletor Compacto (quando não omitido) */}
      {!hideHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
              {hasAporte ? "Alocação: Antes vs. Pós-Aporte" : "Alocação Atual vs. Meta"}
            </span>
            {scaleMax < 90 ? (
              <span
                className="text-[10px] text-muted-foreground font-mono hidden sm:inline"
                title="Escala ampliada com foco nos ativos configurados"
              >
                (zoom {Math.round(scaleMax)}%)
              </span>
            ) : null}
          </div>

          {/* Seletor de Modo Principal */}
          <div className="inline-flex items-center rounded-lg bg-surface-raised p-0.5 text-xs self-start sm:self-center">
            <button
              type="button"
              onClick={() => setViewMode("classes")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                viewMode === "classes"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Classes
            </button>
            {macroItems.length > 0 ? (
              <button
                type="button"
                onClick={() => setViewMode("macro")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  viewMode === "macro"
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Macro-Setores
              </button>
            ) : null}
            {sectorItems.length > 0 ? (
              <button
                type="button"
                onClick={() => setViewMode("sectors")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  viewMode === "sectors"
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Setores
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Mini-Filtro por Classe Pai (Exclusivo na visão de Setores com múltiplas classes) */}
      {viewMode === "sectors" && availableClasses.length > 1 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedClassFilter("all")}
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 border",
              selectedClassFilter === "all"
                ? "bg-surface-raised text-foreground border-border shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground border-transparent hover:border-border/50",
            )}
          >
            Todos ({sectorItems.length})
          </button>
          {availableClasses.map((cls) => {
            const color = getBarColor(cls);
            const isSelected = selectedClassFilter === cls;
            const count = sectorItems.filter((i) => i.className === cls).length;

            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClassFilter(cls)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 border",
                  isSelected
                    ? "bg-surface-raised text-foreground border-border shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-border/50",
                )}
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span>{cls}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Legenda visual sutil */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pt-0.5 border-b border-border/40 pb-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/70 shrink-0" aria-hidden="true" />
          <span>Posição Atual</span>
        </span>
        {hasAporte ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-portfolio shrink-0" aria-hidden="true" />
            <span>Expansão do Aporte</span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-2.5 border-l-2 border-foreground shrink-0" aria-hidden="true" />
          <span>Meta (%)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-2.5 border-l-2 border-dashed border-critical-strong shrink-0" aria-hidden="true" />
          <span>Teto Máximo</span>
        </span>
      </div>

      {/* Lista de Barras Horizontais com Cores por Classe e Scroll Suave */}
      <div
        className={cn(
          "flex flex-col gap-3 pt-1",
          scrollable && "max-h-[250px] overflow-y-auto pr-1.5 scroll-smooth no-scrollbar",
        )}
      >
        {items.map((item) => {
          const currentPct =
            activeBaseCurrentBRL > 0
              ? (item.currentValueBRL / activeBaseCurrentBRL) * 100
              : 0;
          const projectedVal = item.currentValueBRL + item.allocatedBRL;
          const projectedPct =
            activeBaseProjectedBRL > 0
              ? (projectedVal / activeBaseProjectedBRL) * 100
              : currentPct;

          const targetPct = getItemTargetPct(item);
          const ceilingPct = item.ceilingPct;
          const hasItemAporte = item.allocatedBRL > 0;

          // Classe pai resolvida e cor temática
          const resolvedClass = resolveItemClass(item);
          const barColor = getBarColor(resolvedClass, item.name);

          // Projeção proporcional ao zoom scaleMax
          const currentScaledPct = Math.min(100, (currentPct / scaleMax) * 100);
          const projectedScaledPct = Math.min(100, (projectedPct / scaleMax) * 100);

          const currentWidthPct = Math.min(100, Math.max(currentPct > 0 ? 0.8 : 0, currentScaledPct));
          const projectedWidthPct = Math.min(100, Math.max(projectedPct > 0 ? 0.8 : 0, projectedScaledPct));
          const aporteWidthPct = Math.max(0, projectedWidthPct - currentWidthPct);

          const isTargetMet = Math.abs(projectedPct - targetPct) <= 1.0;
          const clampedTargetMarker = Math.min(98, Math.max(2, (targetPct / scaleMax) * 100));
          const clampedCeilingMarker =
            ceilingPct !== undefined ? Math.min(98, Math.max(2, (ceilingPct / scaleMax) * 100)) : null;

          return (
            <div key={item.id} className="flex flex-col gap-1 min-w-0">
              {/* Cabeçalho Textual da Barra */}
              <div className="flex items-baseline justify-between gap-2 text-xs min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: barColor }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                  {viewMode === "sectors" && !isClassScopedSectorView && resolvedClass ? (
                    <span className="text-[10px] text-muted-foreground bg-surface-raised px-1.5 py-0.2 rounded font-sans shrink-0 border border-border/40">
                      {resolvedClass}
                    </span>
                  ) : null}
                  {targetPct > 0 ? (
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      (Meta: {formatPercent(targetPct)}%)
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-right font-mono tabular-nums">
                  <span className="text-muted-foreground text-[11px]">
                    {formatPercent(currentPct)}%
                  </span>
                  {hasAporte && hasItemAporte ? (
                    <>
                      <span className="text-muted-foreground text-[10px] font-sans">{"->"}</span>
                      <span className="font-semibold text-portfolio-strong">
                        {formatPercent(projectedPct)}%
                      </span>
                      <span className="inline-flex items-center rounded-xs bg-portfolio/10 px-1 py-0.2 text-[10px] font-semibold text-portfolio-strong ml-0.5">
                        +R${" "}
                        {item.allocatedBRL.toLocaleString("pt-BR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </>
                  ) : isTargetMet && targetPct > 0 ? (
                    <span className="text-[10px] text-positive-strong font-medium font-sans">OK</span>
                  ) : null}
                </div>
              </div>

              {/* Trilho Horizontal com Cores Vibrantes da Classe */}
              <div className="relative h-2.5 w-full rounded-full bg-surface-raised border border-border/40 overflow-hidden">
                {/* Posição Atual (sólida com cor da classe) */}
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-300 rounded-l-full"
                  style={{
                    width: `${currentWidthPct}%`,
                    backgroundColor: barColor,
                  }}
                />

                {/* Expansão do Aporte */}
                {hasAporte && hasItemAporte ? (
                  <div
                    className="absolute inset-y-0 bg-portfolio transition-all duration-300"
                    style={{
                      left: `${currentWidthPct}%`,
                      width: `${aporteWidthPct}%`,
                    }}
                  />
                ) : null}

                {/* Marcador Vertical de Meta */}
                {targetPct > 0 ? (
                  <div
                    className="absolute inset-y-0 w-1 bg-foreground z-10 pointer-events-none rounded-full shadow-xs -translate-x-1/2"
                    style={{ left: `${clampedTargetMarker}%` }}
                    title={`Meta: ${formatPercent(targetPct)}%`}
                  />
                ) : null}

                {/* Marcador de Teto Prudencial */}
                {clampedCeilingMarker !== null ? (
                  <div
                    className="absolute inset-y-0 w-0.5 border-l-2 border-dashed border-critical-strong z-10 pointer-events-none -translate-x-1/2"
                    style={{ left: `${clampedCeilingMarker}%` }}
                    title={`Teto prudencial: ${formatPercent(ceilingPct ?? 0)}%`}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
