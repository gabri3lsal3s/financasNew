import { X } from "lucide-react";
import { resolveDonutSliceColor } from "@/domain/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";

export interface TargetDonutLegendItem {
  key: string;
  label: string;
  targetPercent: number;
  currentPercent?: number;
  countAssets?: number;
  color?: string;
}

export interface TargetDonutLegendProps {
  title: string;
  items: readonly TargetDonutLegendItem[];
  selectedKey: string | null;
  freePercent: number;
  unitLabel: string;
  disabled: boolean;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}

export function TargetDonutLegend({
  title,
  items,
  selectedKey,
  freePercent,
  unitLabel,
  disabled,
  onSelect,
  onHover,
}: TargetDonutLegendProps) {
  const selectedItem = items.find((item) => item.key === selectedKey) ?? null;

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground tracking-tight">{title}</span>
        {selectedItem ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            disabled={disabled}
            onClick={() => onSelect(selectedItem.key)}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3" aria-hidden="true" />
            <span>Limpar seleção</span>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const color = resolveDonutSliceColor(item.color, idx);
          const isSelected = selectedKey === item.key;
          return (
            <Button
              key={item.key}
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onSelect(item.key)}
              onMouseEnter={() => onHover(item.key)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "h-8 px-2.5 py-1 text-xs font-medium gap-1.5 rounded-lg",
                isSelected
                  ? "bg-surface border-foreground/30 text-foreground shadow-xs ring-1 ring-border"
                  : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover",
              )}
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="truncate max-w-[110px] font-medium text-foreground">{item.label}</span>
              <span className="num font-mono text-[11px] font-bold text-foreground">
                {formatPercent(item.targetPercent)}
                {unitLabel}
              </span>
              {item.currentPercent !== undefined ? (
                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                  ({formatPercent(item.currentPercent)}
                  {unitLabel})
                </span>
              ) : null}
            </Button>
          );
        })}

        {freePercent > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 border border-dashed border-border/80">
            <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" aria-hidden="true" />
            <span>
              Livre: {formatPercent(freePercent)}
              {unitLabel}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
