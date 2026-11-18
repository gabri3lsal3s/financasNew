import type { ReactNode } from "react";
import { DonutRing } from "@/components/ui/donut-ring";
import { sanitizeReportText } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";

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
 * Gráfico Donut Vetorial Nativo (via primitivo `<DonutRing />`) para Relatórios e A4.
 */
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
  const validSegments = segments.filter((s) => s.pct > 0 && !Number.isNaN(s.pct));
  const isCompact = size <= 125;

  const centerContent =
    centerLabel || centerValue ? (
      <div
        className="absolute inset-[10%] flex flex-col items-center justify-center text-center p-1 rounded-full pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center justify-center w-full max-w-[88%] min-w-0">
          {centerLabel && (
            <span
              className={cn(
                "uppercase font-semibold text-muted-foreground tracking-wider leading-none truncate max-w-full",
                size <= 112 ? "text-[10px]" : "text-[10px] sm:text-[11px]",
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
                  ? "text-[10px]"
                  : size <= 125
                    ? "text-[11px]"
                    : "text-xs sm:text-sm",
              )}
            >
              {centerValue}
            </span>
          )}
        </div>
      </div>
    ) : undefined;

  const donutElement = (
    <div
      className={cn(
        "relative shrink-0 flex items-center justify-center",
        isCompact ? "size-28 sm:size-32" : "size-32 sm:size-36 md:size-40",
      )}
      style={{ maxWidth: size, maxHeight: size, width: "100%", height: "auto", aspectRatio: "1 / 1" }}
    >
      <DonutRing
        slices={validSegments.map((s) => ({
          id: s.key,
          label: s.label,
          value: s.pct > 0 ? s.pct : s.value,
          color: s.color,
        }))}
        size={size}
        strokeWidth={strokeWidth}
        gapDegrees={validSegments.length > 1 ? 3 : 0}
        centerContent={centerContent}
        ariaLabel={title ?? "Gráfico de distribuição"}
        className="size-full"
        onSliceSelect={
          onSegmentClick
            ? (slice) => {
                if (!slice) return;
                const matched = validSegments.find((s) => s.key === slice.id);
                if (matched) onSegmentClick(matched);
              }
            : undefined
        }
      />
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
        "flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs break-inside-avoid print:border-border",
        className,
      )}
    >
      {donutElement}

      <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
        {title && (
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
            {title}
          </h4>
        )}
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs", legendClassName)}>
          {validSegments.map((segment) => {
            const rowInner = (
              <>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="size-2.5 rounded-full shrink-0 border border-border/80"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <span className="line-clamp-2 break-words text-foreground font-medium text-[11px] sm:text-xs">
                    {sanitizeReportText(segment.label)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  {segment.formattedValue && (
                    <span className="num font-mono text-[11px] text-muted-foreground">
                      {segment.formattedValue}
                    </span>
                  )}
                  <span className="num font-mono font-bold text-foreground text-[11px] sm:text-xs tabular-nums">
                    {formatPercent(segment.pct)}%
                  </span>
                </div>
              </>
            );

            if (onSegmentClick) {
              return (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onSegmentClick(segment);
                  }}
                  className="flex items-center justify-between gap-2.5 py-1.5 sm:py-0.5 min-h-11 sm:min-h-0 min-w-0 w-full text-left cursor-pointer hover:bg-surface-hover/60 rounded px-1.5 -mx-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {rowInner}
                </button>
              );
            }

            return (
              <div key={segment.key} className="flex items-center justify-between gap-2.5 py-0.5 min-w-0">
                {rowInner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
