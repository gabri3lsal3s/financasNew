import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ReportDonutSegment {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
  formattedValue?: ReactNode;
}

export interface ReportDonutChartProps {
  title?: string;
  segments: readonly ReportDonutSegment[];
  centerLabel?: string;
  centerValue?: ReactNode;
  size?: number;
  strokeWidth?: number;
  className?: string;
  legendClassName?: string;
}

/**
 * Gráfico Donut Vetorial Nativo (Pure SVG) para Relatórios e Impressão A4.
 *
 * Renderiza fatias proporcionais com stroke-dasharray sem bibliotecas canvas,
 * garantindo resolução perfeita em 300 DPI no PDF e em qualquer tema.
 */
function computeVisualSegmentShares(segments: readonly ReportDonutSegment[], minShare = 0.045): number[] {
  const n = segments.length;
  if (n <= 1) return segments.map(() => 1);

  const totalPct = segments.reduce((sum, s) => sum + s.pct, 0);
  const effectiveMin = Math.min(minShare, 0.85 / n);
  const rawShares = segments.map((s) => (totalPct > 0 ? s.pct / totalPct : 1 / n));

  let underAllocatedSum = 0;
  let overAllocatedRawSum = 0;
  const isSmall = rawShares.map((share) => share < effectiveMin);

  for (let i = 0; i < n; i++) {
    if (isSmall[i]) {
      underAllocatedSum += effectiveMin;
    } else {
      overAllocatedRawSum += rawShares[i] ?? 0;
    }
  }

  const remainingBudget = Math.max(0, 1 - underAllocatedSum);
  return rawShares.map((share, i) => {
    if (isSmall[i]) return effectiveMin;
    return overAllocatedRawSum > 0 ? (share / overAllocatedRawSum) * remainingBudget : remainingBudget / (n - underAllocatedSum / effectiveMin);
  });
}

export function ReportDonutChart({
  title,
  segments,
  centerLabel,
  centerValue,
  size = 130,
  strokeWidth = 14,
  className,
  legendClassName,
}: ReportDonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validSegments = segments.filter((s) => s.pct > 0 && !isNaN(s.pct));
  const hasMultiple = validSegments.length > 1;
  const gap = strokeWidth + 4;

  const visualShares = computeVisualSegmentShares(validSegments, 0.045);
  const totalGapBudget = hasMultiple ? validSegments.length * gap : 0;
  const availableDashBudget = Math.max(10, circumference - totalGapBudget);

  const preparedSegments = validSegments.map((segment, index) => {
    let dash: number;
    let offset: number;

    if (hasMultiple) {
      const visualShare = visualShares[index] ?? 0;
      dash = Math.max(0.1, visualShare * availableDashBudget);

      const priorVisualShare = visualShares.slice(0, index).reduce((sum, v) => sum + v, 0);
      const priorOffset = priorVisualShare * availableDashBudget + index * gap;
      offset = priorOffset + gap / 2;
    } else {
      dash = circumference;
      offset = 0;
    }

    return {
      ...segment,
      dash,
      strokeDasharray: `${dash} ${circumference - dash}`,
      strokeDashoffset: -offset,
      strokeLinecap: (hasMultiple ? "round" : "butt") as "round" | "butt",
    };
  });


  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border/80 bg-transparent p-3.5 break-inside-avoid print:border-border",
        className,
      )}
    >
      {/* SVG Donut */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
          aria-hidden="true"
        >
          {/* Fatias proporcionais com extremidades arredondadas flutuantes sem trilha cinza */}
          {preparedSegments
            .filter((s) => s.dash > 0)
            .map((segment) => (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                strokeLinecap={segment.strokeLinecap}
              />
            ))}
        </svg>


        {/* Centro com rótulo/valor */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
            {centerLabel && (
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider leading-none">
                {centerLabel}
              </span>
            )}
            {centerValue && (
              <span className="num font-mono text-xs sm:text-sm font-bold text-foreground mt-0.5 leading-tight">
                {centerValue}
              </span>
            )}
          </div>
        )}
      </div>


      {/* Legenda com Cores e Percentuais */}
      <div className="flex-1 w-full flex flex-col gap-2">
        {title && (
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
            {title}
          </h4>
        )}
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs",
            legendClassName,
          )}
        >
          {validSegments.map((segment) => (
            <div key={segment.key} className="flex items-center justify-between gap-2.5 py-0.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className="size-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-foreground font-medium print:text-slate-800 text-[11px] sm:text-xs">
                  {segment.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {segment.formattedValue && (
                  <span className="num font-mono text-[11px] text-muted-foreground/80">
                    {segment.formattedValue}
                  </span>
                )}
                <span className="num font-mono font-bold text-foreground text-[11px] sm:text-xs">
                  {segment.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
