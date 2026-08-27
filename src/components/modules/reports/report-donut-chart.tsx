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
}

/**
 * Gráfico Donut Vetorial Nativo (Pure SVG) para Relatórios e Impressão A4.
 *
 * Renderiza fatias proporcionais com stroke-dasharray sem bibliotecas canvas,
 * garantindo resolução perfeita em 300 DPI no PDF e em qualquer tema.
 */
export function ReportDonutChart({
  title,
  segments,
  centerLabel,
  centerValue,
  size = 130,
  strokeWidth = 14,
  className,
}: ReportDonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validSegments = segments.filter((s) => s.pct > 0 && !isNaN(s.pct));
  const hasMultiple = validSegments.length > 1;
  const gap = strokeWidth + 4;

  const preparedSegments = validSegments.map((segment, index) => {
    const rawDash = (segment.pct / 100) * circumference;
    const priorPct = validSegments.slice(0, index).reduce((sum, s) => sum + s.pct, 0);

    let dash: number;
    let offset: number;
    let strokeLinecap: "round" | "butt" = "butt";

    if (hasMultiple) {
      if (rawDash >= gap + 2) {
        dash = rawDash - gap;
        offset = (priorPct / 100) * circumference + gap / 2;
        strokeLinecap = "round";
      } else {
        const safeGap = Math.min(4, rawDash * 0.4);
        dash = Math.max(1, rawDash - safeGap);
        offset = (priorPct / 100) * circumference + safeGap / 2;
        strokeLinecap = "butt";
      }
    } else {
      dash = circumference;
      offset = 0;
      strokeLinecap = "butt";
    }

    return {
      ...segment,
      dash,
      strokeDasharray: `${dash} ${circumference - dash}`,
      strokeDashoffset: -offset,
      strokeLinecap,
    };
  });

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border/80 bg-muted/10 p-3.5 break-inside-avoid print:bg-white print:border-border",
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
          {/* Trilha de fundo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-muted/30 print:text-slate-200"
            strokeWidth={strokeWidth}
          />

          {/* Fatias proporcionais com extremidades arredondadas sem sobreposição */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {validSegments.map((segment) => (
            <div key={segment.key} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="size-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-muted-foreground font-medium print:text-slate-700">
                  {segment.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {segment.formattedValue && (
                  <span className="num font-mono text-[11px] text-muted-foreground/80">
                    {segment.formattedValue}
                  </span>
                )}
                <span className="num font-mono font-bold text-foreground">
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
