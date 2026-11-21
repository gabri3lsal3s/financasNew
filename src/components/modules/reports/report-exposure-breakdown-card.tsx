import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import { ReportDonutChart, type ReportDonutSegment } from "./report-donut-chart";

export type ExposureColorToken = `cat${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`;

const CAT_TOKEN_VALUES: Record<ExposureColorToken, string> = {
  cat1: "hsl(var(--cat-1))", cat2: "hsl(var(--cat-2))", cat3: "hsl(var(--cat-3))",
  cat4: "hsl(var(--cat-4))", cat5: "hsl(var(--cat-5))", cat6: "hsl(var(--cat-6))",
  cat7: "hsl(var(--cat-7))", cat8: "hsl(var(--cat-8))", cat9: "hsl(var(--cat-9))",
  cat10: "hsl(var(--cat-10))",
};

export interface ExposureBreakdownGroupItem {
  key: string; label: string; valueBRL: number; pct: number; count: number;
  colorToken?: ExposureColorToken; color?: string;
}

export interface ExposureBreakdownView {
  id: string; label: string; icon: LucideIcon; printTitle: string;
  columnLabel: string; interactiveColumnLabel?: string; printCenterLabel: string;
  items: readonly ExposureBreakdownGroupItem[];
}

export interface ReportExposureBreakdownCardProps {
  title: string; subtitle: string; icon: LucideIcon; emptyMessage: string;
  totalAssetsCount: number; totalValueBRL: number; interactiveCenterLabel: string;
  itemUnitLabel?: string;
  statusBadge?: { label: string; variant: "warning" | "muted" | "positive"; icon: LucideIcon; iconClassName?: string };
  highlightCallout?: { icon: LucideIcon; iconClassName?: string; tone?: "positive" | "surface"; label: ReactNode; valueLabel: string; valueCents: number };
  views: readonly ExposureBreakdownView[];
  mode?: "interactive" | "print_all";
  className?: string;
}

function resolveItemColor(item: ExposureBreakdownGroupItem): string {
  return item.color ?? CAT_TOKEN_VALUES[item.colorToken ?? "cat10"];
}

function toDonutSegments(items: readonly ExposureBreakdownGroupItem[]): ReportDonutSegment[] {
  return items.map((item) => ({
    key: item.key, label: item.label, value: item.valueBRL, pct: item.pct,
    color: resolveItemColor(item),
    formattedValue: <MoneyText cents={numberToCents(item.valueBRL)} tone="default" />,
  }));
}

function formatNaturalCount(count: number, unitLabel?: string): string {
  const isTitulo = unitLabel?.toLowerCase().includes("título");
  if (isTitulo) {
    return count === 1 ? "1 título" : `${count} títulos`;
  }
  return count === 1 ? "1 ativo" : `${count} ativos`;
}

function ExposureHorizontalBars({
  items,
  unitLabel,
}: {
  items: readonly ExposureBreakdownGroupItem[];
  unitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {items.map((item) => {
        const itemColor = resolveItemColor(item);
        const countLabel = formatNaturalCount(item.count, unitLabel);
        return (
          <div key={item.key} className="flex flex-col gap-1 w-full text-xs">
            <div className="flex items-baseline justify-between gap-2 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: itemColor }}
                  aria-hidden="true"
                />
                <span className="font-medium text-foreground truncate">
                  {item.label}
                </span>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  · {countLabel}
                </span>
              </div>
              <div className="font-mono text-xs text-right whitespace-nowrap shrink-0">
                <MoneyText
                  cents={numberToCents(item.valueBRL)}
                  tone="default"
                  className="font-bold text-foreground"
                />
                <span className="text-[11px] font-semibold text-muted-foreground ml-1">
                  ({formatPercent(item.pct)}%)
                </span>
              </div>
            </div>

            <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, item.pct))}%`,
                  backgroundColor: itemColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExposureBreakdownTable({
  items, columnLabel, unitLabel, compact = false,
}: {
  items: readonly ExposureBreakdownGroupItem[]; columnLabel: string; unitLabel: string; compact?: boolean;
}) {
  const cellPad = compact ? "py-1.5 px-2.5" : "py-2 px-3";
  return (
    <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 text-xs">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-surface-hover/60 border-b border-border/80 text-[11px] font-semibold text-muted-foreground">
            <th className={cn("font-semibold text-left", cellPad)}>{columnLabel}</th>
            <th className={cn("text-right font-medium w-28", cellPad)}>Saldo (R$)</th>
            <th className={cn("text-right font-medium w-16", cellPad)}>Peso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {items.map((item) => (
            <tr key={item.key} className="hover:bg-surface-hover/40 transition-colors text-xs">
              <td className={cellPad}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveItemColor(item) }} aria-hidden="true" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground line-clamp-2 break-words">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground">{formatNaturalCount(item.count, unitLabel)}</span>
                  </div>
                </div>
              </td>
              <td className={cn("text-right font-mono font-medium text-foreground tabular-nums tracking-tight whitespace-nowrap", cellPad)}>
                <MoneyText cents={numberToCents(item.valueBRL)} tone="default" />
              </td>
              <td className={cn("text-right font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap", cellPad)}>
                {formatPercent(item.pct)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Card paramétrico de Raio-X patrimonial (tokens `--cat-1..10`, alvos >= 44px no mobile e `MoneyText`). */
export function ReportExposureBreakdownCard({
  title, subtitle, icon: HeaderIcon, emptyMessage, totalAssetsCount, totalValueBRL,
  interactiveCenterLabel, itemUnitLabel = "ativos", statusBadge, highlightCallout, views,
  mode = "interactive", className,
}: ReportExposureBreakdownCardProps) {
  const [selectedViewId, setSelectedViewId] = useState<string>(() => views[0]?.id ?? "");
  const activeView = views.find((v) => v.id === selectedViewId) ?? views[0];

  if (totalAssetsCount === 0 || totalValueBRL <= 0 || !activeView) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 border-b border-border/80 pb-2.5">
          <HeaderIcon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 break-words">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground py-4 text-center">{emptyMessage}</p>
      </div>
    );
  }

  const BadgeIcon = statusBadge?.icon;
  const CalloutIcon = highlightCallout?.icon;
  const totalCents = numberToCents(totalValueBRL);

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/80 pb-3">
        <div className="flex items-start sm:items-center gap-2 min-w-0">
          <HeaderIcon className="size-4 text-muted-foreground shrink-0 mt-0.5 sm:mt-0 print:hidden" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 break-words">{title}</h4>
            <p className="text-[11px] text-muted-foreground leading-normal m-0">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge && BadgeIcon ? (
            <Badge variant={statusBadge.variant} size="sm" className="max-w-full truncate">
              <BadgeIcon className={cn("size-3 shrink-0 print:hidden", statusBadge.iconClassName)} aria-hidden="true" />
              <span className="truncate">{statusBadge.label}</span>
            </Badge>
          ) : null}
          {mode !== "print_all" && views.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-raised p-1 border border-border/80 print:hidden">
              {views.map((view) => {
                const ViewIcon = view.icon;
                const isActive = view.id === activeView.id;
                return (
                  <Button
                    key={view.id} type="button" size="sm" variant={isActive ? "outline" : "ghost"}
                    sensoryIntent="selection" aria-pressed={isActive} onClick={() => setSelectedViewId(view.id)}
                    className={cn(
                      "min-h-11 sm:min-h-8 h-auto px-3 py-1.5 text-xs font-semibold rounded-lg gap-1.5",
                      isActive ? "bg-surface text-foreground shadow-xs border-border/80" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ViewIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{view.label}</span>
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {highlightCallout && CalloutIcon ? (
        <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border p-3 text-xs",
          highlightCallout.tone === "positive" ? "bg-positive/10 border-positive/25 text-positive-strong" : "bg-surface-raised border-border/80 text-foreground")}
        >
          <div className="flex items-center gap-2 font-medium">
            <CalloutIcon className={cn("size-4 shrink-0 print:hidden", highlightCallout.iconClassName)} aria-hidden="true" />
            <span>{highlightCallout.label}</span>
          </div>
          <span className="font-mono text-muted-foreground text-[11px] whitespace-nowrap">
            {highlightCallout.valueLabel}: <MoneyText cents={highlightCallout.valueCents} tone="default" className="font-bold text-xs" />
          </span>
        </div>
      ) : null}

      {mode === "print_all" ? (
        <div
          className={cn(
            "grid gap-4 w-full",
            views.length === 1 && "grid-cols-1",
            views.length === 2 && "grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60",
            views.length >= 3 && "grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60",
          )}
        >
          {views.map((view, vIdx) => {
            const ViewIcon = view.icon;
            return (
              <div
                key={view.id}
                className={cn(
                  "flex flex-col gap-2 min-w-0",
                  vIdx > 0 && "pt-3 md:pt-0 md:pl-4",
                )}
              >
                <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-border/70">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ViewIcon className="size-3.5 text-muted-foreground shrink-0 print:hidden" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground truncate">{view.printTitle}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    <MoneyText cents={totalCents} tone="default" className="font-bold text-foreground" />
                  </span>
                </div>
                <ExposureHorizontalBars items={view.items} unitLabel={itemUnitLabel} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn("flex flex-col sm:flex-row items-center gap-4", mode === "interactive" && "sm:gap-6")}>
          <div className="shrink-0 flex justify-center py-2">
            <ReportDonutChart
              segments={toDonutSegments(activeView.items)}
              centerLabel={interactiveCenterLabel}
              centerValue={<MoneyText cents={totalCents} tone="default" className="text-xs font-bold" />}
              size={140}
              strokeWidth={13}
              showLegend={false}
            />
          </div>
          <div className="flex-1 w-full min-w-0">
            <ExposureBreakdownTable
              items={activeView.items}
              columnLabel={activeView.interactiveColumnLabel ?? activeView.columnLabel}
              unitLabel={itemUnitLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
