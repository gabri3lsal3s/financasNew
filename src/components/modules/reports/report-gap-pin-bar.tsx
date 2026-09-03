import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { cn } from "@/lib/utils";

export interface ReportGapPinItem {
  key: string;
  label: string;
  actualPct: number;
  targetPct: number;
  gapPct: number;
  color?: string;
}

export interface ReportGapPinBarProps {
  items: readonly ReportGapPinItem[];
  className?: string;
}

/**
 * Barra Comparativa de Alocação com Marcador de Meta (Gap Pin Bar).
 *
 * Exibe o percentual realizado como barra preenchida e a meta planejada
 * como um pino/marcador vertical, evidenciando o gap (desvio) imediatamente.
 */
export function ReportGapPinBar({ items, className }: ReportGapPinBarProps) {
  return (
    <div className={cn("flex flex-col gap-2.5 break-inside-avoid", className)}>
      {items.map((item) => {
        const isUnderAllocated = item.gapPct < -0.5;
        const isOverAllocated = item.gapPct > 0.5;

        return (
          <div key={item.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{item.label}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  Atual: <strong className="font-bold text-foreground num font-mono">{formatPercent(item.actualPct)}%</strong>
                </span>
                <span className="text-muted-foreground">
                  Meta: <strong className="font-bold text-foreground num font-mono">{formatPercent(item.targetPct)}%</strong>
                </span>
                <span
                  className={cn(
                    "font-bold font-mono num text-[11px] px-1.5 py-0.2 rounded-sm",
                    isUnderAllocated && "text-warning-strong bg-warning/10",
                    isOverAllocated && "text-muted-foreground bg-muted/30",
                    !isUnderAllocated && !isOverAllocated && "text-positive-strong bg-positive/10",
                  )}
                >
                  {formatSignedPct(item.gapPct)}
                </span>
              </div>
            </div>

            {/* Barra com Marcador de Meta */}
            <div className="relative w-full h-2 rounded-full bg-muted/40 overflow-visible border border-border/60">
              {/* Barra Preenchida (Atual) */}
              <div
                style={{
                  width: `${Math.min(Math.max(item.actualPct, 0), 100)}%`,
                  backgroundColor: item.color ?? "#1b6b62",
                }}
                className="h-full rounded-full transition-all duration-300"
              />

              {/* Marcador Vertical (Meta) */}
              <div
                style={{ left: `${Math.min(Math.max(item.targetPct, 0), 100)}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-3.5 bg-foreground border border-surface rounded-xs shadow-xs pointer-events-none"
                title={`Meta planejada: ${formatPercent(item.targetPct)}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
