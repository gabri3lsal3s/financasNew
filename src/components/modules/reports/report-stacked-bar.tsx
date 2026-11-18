import { formatPercent } from "@/services/masks/percent";
import { normalizePercentagesTo100 } from "@/domain/reports";
import { cn } from "@/lib/utils";

export interface ReportStackedSegment {
  key: string;
  label: string;
  pct: number;
  color: string;
}

export interface ReportStackedBarProps {
  title?: string;
  segments: readonly ReportStackedSegment[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

/**
 * Barra de Alocação Empilhada (Stacked Allocation Bar) para Relatórios A4 / PDF.
 */
export function ReportStackedBar({
  title,
  segments,
  height = 10,
  showLegend = true,
  className,
}: ReportStackedBarProps) {
  const filtered = segments.filter((s) => s.pct > 0 && !Number.isNaN(s.pct));
  const normalized = normalizePercentagesTo100(
    filtered.map((s) => ({ ...s, rawPct: s.pct })),
    1,
  );
  const validSegments = normalized.map((n) => ({
    ...n,
    pct: n.formattedPct,
  }));

  return (
    <div className={cn("flex flex-col gap-2 break-inside-avoid", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {title}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">100% Total</span>
        </div>
      )}

      <div
        className="w-full rounded-full overflow-hidden flex bg-muted/40 border border-border/80 print:border-border"
        style={{ height }}
        role="progressbar"
        aria-label={title ?? "Distribuição proporcional"}
      >
        {validSegments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${Math.max(segment.pct, 0.5)}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${formatPercent(segment.pct)}%`}
            className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full border-r border-surface/80 last:border-r-0"
          />
        ))}
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1">
          {validSegments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{segment.label}:</span>
              <strong className="num font-mono font-bold text-foreground tabular-nums">
                {formatPercent(segment.pct)}%
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
