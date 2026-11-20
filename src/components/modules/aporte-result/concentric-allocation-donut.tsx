import { useState, useMemo } from "react";
import { DONUT_CLASS_COLORS, DONUT_SECTOR_PALETTE } from "@/domain/reports";
import type { DiversificationImpactSummary } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import { cn } from "@/lib/utils";

export interface ConcentricDonutClassItem {
  id: string;
  name: string;
  currentValueBRL: number;
  allocatedBRL: number;
  targetPct: number;
}

export interface ConcentricAllocationDonutProps {
  items: ConcentricDonutClassItem[];
  totalCurrentBRL: number;
  totalAllocatedBRL: number;
  diversificationImpact?: DiversificationImpactSummary | null;
  className?: string;
}

function getDonutClassColor(className: string, index = 0): string {
  const norm = className.trim().toLowerCase();
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
  return DONUT_SECTOR_PALETTE[index % DONUT_SECTOR_PALETTE.length] ?? "#64748b";
}

/**
 * ConcentricAllocationDonut (§Fase 4.5):
 * Donut Concêntrico SVG Puro + Tailwind com dois anéis iniciando rigorosamente às 12h:
 * - Anel Externo (sólido, 11px): Alocação Atual ou Pós-Aporte
 * - Anel Interno (translúcido 0.45, 4.5px, folga 5px): Meta %
 * - Centro Interativo com Nef e detalhes da classe no hover/touch
 * - Legenda interativa sincronizada bidirecionalmente
 */
export function ConcentricAllocationDonut({
  items,
  totalCurrentBRL,
  totalAllocatedBRL,
  diversificationImpact,
  className,
}: ConcentricAllocationDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasAporte = totalAllocatedBRL > 0;
  const totalProjectedBRL = totalCurrentBRL + totalAllocatedBRL;

  // Dimensões SVG Canônicas
  const size = 200;
  const center = size / 2; // 100

  // Anel Externo (Atual ou Pós-Aporte)
  const outerRadius = 78;
  const outerStroke = 11;
  const outerCircumference = 2 * Math.PI * outerRadius;

  // Anel Interno (Meta): folga de ~5px da borda interna do anel externo
  // Borda interna externa = 78 - (11/2) = 72.5
  // Borda externa interna = 72.5 - 5 = 67.5
  // Com stroke de 4.5: innerRadius = 67.5 - 2.25 = 65.25
  const innerRadius = 65;
  const innerStroke = 4.5;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Prepara fatias com percentuais calculados e posições acumuladas
  const processedSegments = useMemo(() => {
    let accumulatedOuterPct = 0;
    let accumulatedInnerPct = 0;
    const result = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index]!;
      const color = getDonutClassColor(item.name, index);

      // Percentuais
      const currentPct = totalCurrentBRL > 0 ? (item.currentValueBRL / totalCurrentBRL) * 100 : 0;
      const projectedVal = item.currentValueBRL + item.allocatedBRL;
      const projectedPct = totalProjectedBRL > 0 ? (projectedVal / totalProjectedBRL) * 100 : currentPct;
      const activeOuterPct = hasAporte ? projectedPct : currentPct;

      const targetPct = item.targetPct;

      // Geometria Anel Externo
      const outerArcLength = (activeOuterPct / 100) * outerCircumference;
      const outerOffset = (accumulatedOuterPct / 100) * outerCircumference;
      accumulatedOuterPct += activeOuterPct;

      // Geometria Anel Interno (Meta)
      const innerArcLength = (targetPct / 100) * innerCircumference;
      const innerOffset = (accumulatedInnerPct / 100) * innerCircumference;
      accumulatedInnerPct += targetPct;

      result.push({
        item,
        index,
        color,
        currentPct,
        projectedPct,
        activeOuterPct,
        targetPct,
        outerArcLength,
        outerOffset,
        innerArcLength,
        innerOffset,
      });
    }

    return result;
  }, [items, totalCurrentBRL, totalProjectedBRL, hasAporte, outerCircumference, innerCircumference]);

  const activeHovered = hoveredIndex !== null ? processedSegments[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center gap-4 sm:gap-6 min-w-0 w-full",
        className,
      )}
    >
      {/* Container do Donut SVG + Centro Interativo */}
      <div className="flex flex-col items-center shrink-0">
        <div className="relative size-[180px] sm:size-[196px] shrink-0">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full transform -rotate-90 origin-center"
            aria-hidden="true"
          >
            {/* Trilhas de fundo para os anéis (opacidade bem sutil) */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="none"
              stroke="currentColor"
              className="text-border/30"
              strokeWidth={innerStroke}
            />
            <circle
              cx={center}
              cy={center}
              r={outerRadius}
              fill="none"
              stroke="currentColor"
              className="text-border/20"
              strokeWidth={outerStroke}
            />

            {/* Anel Interno (Metas - Translúcido) */}
            {processedSegments.map((seg) => {
              const isHovered = hoveredIndex === seg.index;
              const hasHover = hoveredIndex !== null;
              const opacity = hasHover ? (isHovered ? 0.8 : 0.15) : 0.45;
              const strokeW = isHovered ? innerStroke + 1.5 : innerStroke;

              return (
                <circle
                  key={`inner-${seg.item.id}`}
                  cx={center}
                  cy={center}
                  r={innerRadius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeW}
                  strokeDasharray={`${Math.max(0, seg.innerArcLength)} ${outerCircumference}`}
                  strokeDashoffset={-seg.innerOffset}
                  style={{
                    opacity,
                    transition:
                      "stroke-dasharray 300ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease, stroke-width 200ms ease",
                  }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(seg.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}

            {/* Anel Externo (Atual ou Pós-Aporte - Sólido) */}
            {processedSegments.map((seg) => {
              const isHovered = hoveredIndex === seg.index;
              const hasHover = hoveredIndex !== null;
              const opacity = hasHover ? (isHovered ? 1 : 0.25) : 1;
              const strokeW = isHovered ? outerStroke + 2 : outerStroke;

              return (
                <circle
                  key={`outer-${seg.item.id}`}
                  cx={center}
                  cy={center}
                  r={outerRadius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeW}
                  strokeDasharray={`${Math.max(0, seg.outerArcLength)} ${outerCircumference}`}
                  strokeDashoffset={-seg.outerOffset}
                  style={{
                    opacity,
                    transition:
                      "stroke-dasharray 300ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease, stroke-width 200ms ease",
                  }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(seg.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Centro Interativo Flutuante (HTML sobre o SVG) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none select-none">
            {activeHovered ? (
              <div className="flex flex-col items-center justify-center animate-fade-in max-w-[124px]">
                <span className="text-[11px] font-semibold text-foreground truncate w-full">
                  {activeHovered.item.name}
                </span>
                <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                  {formatPercent(activeHovered.activeOuterPct)}%
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Meta {formatPercent(activeHovered.targetPct)}%
                </span>
                {hasAporte && activeHovered.item.allocatedBRL > 0 ? (
                  <span className="text-[10px] font-semibold text-portfolio tabular-nums">
                    +R${" "}
                    {activeHovered.item.allocatedBRL.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ativos efetivos
                </span>
                <span className="text-lg font-bold font-mono text-foreground tabular-nums">
                  {hasAporte && diversificationImpact?.projectedNef !== null
                    ? diversificationImpact?.projectedNef?.toFixed(1)
                    : diversificationImpact?.currentNef?.toFixed(1) ?? "—"}
                </span>
                {hasAporte &&
                diversificationImpact?.deltaNefPct !== null &&
                diversificationImpact?.deltaNefPct !== undefined &&
                diversificationImpact.deltaNefPct !== 0 ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      diversificationImpact.deltaNefPct > 0
                        ? "text-positive-strong"
                        : "text-muted-foreground",
                    )}
                  >
                    {diversificationImpact.deltaNefPct > 0 ? "+" : ""}
                    {diversificationImpact.deltaNefPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-mono">Nef</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Micro-legenda discreta abaixo do SVG */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground pt-1.5 select-none">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground shrink-0" aria-hidden="true" />
            <span>{hasAporte ? "Pós-aporte" : "Atual"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground/45 border border-foreground/30 shrink-0" aria-hidden="true" />
            <span>Meta</span>
          </span>
        </div>
      </div>

      {/* Legenda Interativa Sincronizada */}
      <div className="flex-1 w-full min-w-0 flex flex-col gap-1.5">
        {processedSegments.map((seg) => {
          const isHovered = hoveredIndex === seg.index;
          const hasHover = hoveredIndex !== null;

          return (
            <button
              key={seg.item.id}
              type="button"
              onMouseEnter={() => setHoveredIndex(seg.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(seg.index)}
              onBlur={() => setHoveredIndex(null)}
              className={cn(
                "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer text-left w-full",
                isHovered
                  ? "bg-surface-raised ring-1 ring-border shadow-xs"
                  : hasHover
                  ? "opacity-40 hover:opacity-100"
                  : "hover:bg-surface-raised/70",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden="true"
                />
                <span className="font-medium text-foreground truncate">{seg.item.name}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
                {hasAporte ? (
                  <span className="text-foreground">
                    <span className="text-muted-foreground">{formatPercent(seg.currentPct)}%</span>
                    <span className="mx-1 text-muted-foreground/60 font-sans">{"->"}</span>
                    <span className="font-semibold">{formatPercent(seg.projectedPct)}%</span>
                  </span>
                ) : (
                  <span className="font-semibold text-foreground">
                    {formatPercent(seg.currentPct)}%
                  </span>
                )}

                <span className="text-muted-foreground" title="Meta definida">
                  (meta {formatPercent(seg.targetPct)}%)
                </span>

                {hasAporte && seg.item.allocatedBRL > 0 ? (
                  <span className="text-portfolio font-semibold text-[11px]">
                    +R${" "}
                    {seg.item.allocatedBRL.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
