import type { ReactNode } from "react";
import { formatPercent } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";
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
  showLegend?: boolean;
  onSegmentClick?: (segment: ReportDonutSegment) => void;
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
  size = 136,
  strokeWidth = 12,
  className,
  legendClassName,
  showLegend = true,
  onSegmentClick,
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

  const isCompact = size <= 125;

  const donutElement = (
    <div
      className={cn(
        "relative shrink-0 flex items-center justify-center",
        isCompact ? "size-28 sm:size-32" : "size-32 sm:size-36 md:size-40",
      )}
      style={{
        maxWidth: size,
        maxHeight: size,
        width: "100%",
        height: "auto",
        aspectRatio: "1 / 1",
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full transform -rotate-90"
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
              onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
              className={cn(
                "transition-opacity",
                onSegmentClick && "cursor-pointer hover:opacity-80",
              )}
            />
          ))}
      </svg>

      {/* Centro com rótulo/valor e Safe Zone concêntrica protegida */}
      {(centerLabel || centerValue) && (
        <div
          className="absolute inset-[10%] flex flex-col items-center justify-center text-center p-1 rounded-full pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center justify-center w-full max-w-[88%] min-w-0">
            {centerLabel && (
              <span
                className={cn(
                  "uppercase font-semibold text-muted-foreground tracking-wider leading-none truncate max-w-full",
                  size <= 112 ? "text-[8px] sm:text-[8.5px]" : "text-[8.5px] sm:text-[9.5px]",
                )}
              >
                {centerLabel}
              </span>
            )}
            {centerValue && (
              <span
                className={cn(
                  "num font-mono font-bold text-foreground mt-0.5 leading-tight tracking-tight whitespace-nowrap",
                  size <= 112
                    ? "text-[9.5px] sm:text-[10px]"
                    : size <= 125
                      ? "text-[10.5px] sm:text-[11px]"
                      : "text-xs sm:text-[13px] md:text-sm",
                )}
              >
                {centerValue}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!showLegend) {
    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)}>
        {donutElement}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border/80 bg-transparent p-3.5 break-inside-avoid print:border-border",
        className,
      )}
    >
      {donutElement}

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
            <div
              key={segment.key}
              onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
              className={cn(
                "flex items-center justify-between gap-2.5 py-0.5 min-w-0 transition-colors",
                onSegmentClick && "cursor-pointer hover:bg-surface-hover/60 rounded px-1.5 -mx-1.5",
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className="size-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-foreground font-medium print:text-slate-800 text-[11px] sm:text-xs print:truncate-none print:whitespace-normal">
                  {sanitizeReportText(segment.label)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {segment.formattedValue && (
                  <span className="num font-mono text-[11px] text-muted-foreground/80">
                    {segment.formattedValue}
                  </span>
                )}
                <span className="num font-mono font-bold text-foreground text-[11px] sm:text-xs">
                  {formatPercent(segment.pct)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
