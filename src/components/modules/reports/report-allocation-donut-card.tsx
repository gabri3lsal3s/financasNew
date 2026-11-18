import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { AllocationDonutSegment } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";

export interface ReportAllocationDonutCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeIcon?: LucideIcon;
  columnHeader: string;
  centerLabel: string;
  centerValue: ReactNode;
  headerRightExtra?: ReactNode;
  segments: readonly AllocationDonutSegment[];
  preparedSegments: readonly ReportDonutSegment[];
  variant: "screen" | "print";
  onSegmentClick?: (label: string) => void;
}

/** Card analítico unificado de Donut + Tabela de Composição (tela e A4). */
export function ReportAllocationDonutCard({
  icon: HeaderIcon,
  title,
  subtitle,
  badgeText,
  badgeIcon: BadgeIcon,
  columnHeader,
  centerLabel,
  centerValue,
  headerRightExtra,
  segments,
  preparedSegments,
  variant,
  onSegmentClick,
}: ReportAllocationDonutCardProps) {
  const isPrint = variant === "print";
  const cellPad = isPrint ? "py-1.5 px-2.5" : "py-2 px-3";

  return (
    <div
      className={cn(
        "border border-border/80 bg-surface w-full flex flex-col",
        isPrint
          ? "rounded-xl p-3 shadow-xs break-inside-avoid gap-2.5 print:border-border"
          : "rounded-2xl p-4 sm:p-5 shadow-xs gap-4",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
        <div className="flex items-start sm:items-center gap-2 min-w-0">
          <HeaderIcon className="size-4 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className={cn("font-bold text-foreground line-clamp-2 break-words", isPrint ? "text-xs" : "text-sm sm:text-base")}>
              {title}
            </h4>
            <p className={cn("text-muted-foreground m-0", isPrint ? "text-[10px] leading-tight" : "text-[11px] leading-normal")}>
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Badge variant="muted" size="sm" className="gap-1 inline-flex items-center max-w-full truncate">
            {BadgeIcon ? <BadgeIcon className="size-3 text-positive-strong shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{badgeText}</span>
          </Badge>
          {headerRightExtra}
        </div>
      </div>

      <div className={cn("flex items-center gap-4", isPrint ? "flex-row" : "flex-col sm:flex-row sm:gap-6")}>
        <div className={cn("shrink-0 flex justify-center", isPrint ? "py-1" : "py-2")}>
          <ReportDonutChart
            segments={preparedSegments}
            centerLabel={centerLabel}
            centerValue={centerValue}
            size={isPrint ? 120 : 140}
            strokeWidth={isPrint ? 11 : 13}
            showLegend={false}
            onSegmentClick={onSegmentClick ? (seg) => onSegmentClick(seg.label) : undefined}
          />
        </div>

        <div className="flex-1 w-full min-w-0">
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 text-xs">
            <table className="w-full min-w-[300px] sm:min-w-0 border-collapse text-left text-xs">
              <thead>
                <tr className="bg-surface-hover/60 border-b border-border/80 text-[11px] font-semibold text-muted-foreground">
                  <th className={cn("font-semibold text-left", cellPad)}>{columnHeader}</th>
                  <th className={cn("text-right font-medium w-28 whitespace-nowrap", cellPad)}>Saldo (R$)</th>
                  <th className={cn("text-right font-medium w-16 whitespace-nowrap", cellPad)}>Peso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {segments.map((seg) => {
                  const isClickable = Boolean(onSegmentClick);
                  return (
                    <tr
                      key={seg.key}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={
                        isClickable && onSegmentClick
                          ? () => {
                              triggerSensory("selection");
                              onSegmentClick(seg.label);
                            }
                          : undefined
                      }
                      onKeyDown={
                        isClickable && onSegmentClick
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                triggerSensory("selection");
                                onSegmentClick(seg.label);
                              }
                            }
                          : undefined
                      }
                      className={cn(
                        "hover:bg-surface-hover/40 transition-colors",
                        isPrint ? "text-[11px]" : "text-xs",
                        isClickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      <td className={cellPad}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn("rounded-full shrink-0", isPrint ? "size-2" : "size-2.5")}
                            style={{ backgroundColor: seg.color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground line-clamp-2 break-words">{seg.label}</span>
                        </div>
                      </td>
                      <td className={cn("text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap", cellPad)}>
                        <MoneyText cents={numberToCents(seg.value)} tone="default" />
                      </td>
                      <td className={cn("text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap", cellPad)}>
                        {formatPercent(seg.pct)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
