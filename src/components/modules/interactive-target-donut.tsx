import { useMemo, useState } from "react";
import { DonutRing } from "@/components/ui/donut-ring";
import { resolveDonutSliceColor, type DonutInputSlice } from "@/domain/charts";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";
import { TargetDonutAdjuster } from "./portfolio/target-donut-adjuster";
import { TargetDonutLegend } from "./portfolio/target-donut-legend";

export interface TargetDonutItem {
  key: string;
  label: string;
  targetPercent: number;
  currentPercent?: number;
  countAssets?: number;
  color?: string;
}

export interface InteractiveTargetDonutProps {
  items: readonly TargetDonutItem[];
  selectedKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  onChangeTarget?: (key: string, nextTarget: number) => void;
  totalCeiling?: number;
  unitLabel?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

const FREE_SLICE_ID = "__free__";

/**
 * InteractiveTargetDonut — gráfico de rosca interativo para visualização da carteira
 * ideal e ajuste rápido de metas, consumindo o primitivo canônico `<DonutRing />`.
 */
export function InteractiveTargetDonut({
  items,
  selectedKey = null,
  onSelectKey,
  onChangeTarget,
  totalCeiling = 100,
  unitLabel = "%",
  title = "Alocação Ideal",
  className,
  disabled = false,
}: InteractiveTargetDonutProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const totalSum = items.reduce(
    (acc, item) => acc + (Number.isFinite(item.targetPercent) ? item.targetPercent : 0),
    0,
  );
  const roundedSum = Math.round(totalSum * 10) / 10;
  const freePercent = Math.max(0, Math.round((totalCeiling - totalSum) * 10) / 10);
  const isOverflow = roundedSum > totalCeiling;
  const overflowPercent = Math.max(0, Math.round((totalSum - totalCeiling) * 10) / 10);

  const selectedItem = items.find((item) => item.key === selectedKey) ?? null;
  const selectedIndex = selectedItem ? items.findIndex((i) => i.key === selectedItem.key) : -1;
  const selectedColor =
    selectedItem && selectedIndex >= 0
      ? resolveDonutSliceColor(selectedItem.color, selectedIndex)
      : undefined;

  const ringSlices = useMemo<DonutInputSlice[]>(() => {
    const active: DonutInputSlice[] = items
      .map((item, idx) => ({
        id: item.key,
        label: item.label,
        value: item.targetPercent,
        color: resolveDonutSliceColor(item.color, idx),
      }))
      .filter((slice) => Number.isFinite(slice.value) && slice.value > 0);

    if (!isOverflow && freePercent > 0) {
      active.push({
        id: FREE_SLICE_ID,
        label: "Livre",
        value: freePercent,
        color: "hsl(var(--muted))",
      });
    }
    return active;
  }, [items, isOverflow, freePercent]);

  const handleToggleKey = (key: string) => {
    if (disabled || key === FREE_SLICE_ID) return;
    onSelectKey?.(selectedKey === key ? null : key);
  };

  const handleAdjustTarget = (delta: number) => {
    if (disabled || !selectedItem || !onChangeTarget) return;
    const next = Math.max(0, Math.min(100, Math.round((selectedItem.targetPercent + delta) * 10) / 10));
    onChangeTarget(selectedItem.key, next);
  };

  const activeHighlightKey = hoveredKey ?? selectedKey;

  const centerContent = (
    <div
      className="inset-[10%] rounded-full flex flex-col items-center justify-center w-full h-full text-center p-1.5 select-none overflow-hidden"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[88%] min-w-0">
        {selectedItem ? (
          <>
            <span
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate max-w-full"
              style={selectedColor ? { color: selectedColor } : undefined}
              title={selectedItem.label}
            >
              {selectedItem.label}
            </span>
            <span className="num font-mono text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight mt-0.5 whitespace-nowrap">
              {formatPercent(selectedItem.targetPercent)}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">{unitLabel}</span>
            </span>
            {selectedItem.currentPercent !== undefined ? (
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
                Atual:{" "}
                <strong className="text-foreground">
                  {formatPercent(selectedItem.currentPercent)}
                  {unitLabel}
                </strong>
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
                selecionado
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-muted-foreground truncate max-w-full">
              Alocado
            </span>
            <span
              className={cn(
                "num font-mono text-sm sm:text-base md:text-lg font-bold leading-tight mt-0.5 whitespace-nowrap",
                isOverflow ? "text-critical-strong" : "text-foreground",
              )}
            >
              {formatPercent(roundedSum)}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">{unitLabel}</span>
            </span>
            {freePercent > 0 ? (
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
                {formatPercent(freePercent)}
                {unitLabel} livre
              </span>
            ) : isOverflow ? (
              <span className="text-[10px] sm:text-xs text-critical-strong font-semibold mt-0.5 whitespace-nowrap">
                +{formatPercent(overflowPercent)}
                {unitLabel}
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs text-positive-strong font-medium mt-0.5 whitespace-nowrap">
                100% calibrado
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row items-center justify-between gap-5 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs",
        className,
      )}
      data-swipe-nav-ignore
    >
      <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto min-w-0">
        <DonutRing
          slices={ringSlices}
          size={180}
          strokeWidth={18}
          gapDegrees={items.length > 1 ? 3 : 0}
          activeId={activeHighlightKey}
          ariaLabel={`Gráfico de metas: ${title}`}
          className="size-40 sm:size-44 md:size-48 shrink-0"
          centerContent={centerContent}
          onSliceHover={(slice) => {
            setHoveredKey(slice && slice.id !== FREE_SLICE_ID ? slice.id : null);
          }}
          onSliceSelect={
            disabled || !onSelectKey
              ? undefined
              : (slice) => {
                  if (slice?.id === FREE_SLICE_ID) return;
                  onSelectKey(slice ? slice.id : null);
                }
          }
        />

        <TargetDonutLegend
          title={title}
          items={items}
          selectedKey={selectedKey}
          freePercent={freePercent}
          unitLabel={unitLabel}
          disabled={disabled}
          onSelect={handleToggleKey}
          onHover={setHoveredKey}
        />
      </div>

      {selectedItem && onChangeTarget ? (
        <TargetDonutAdjuster
          label={selectedItem.label}
          targetPercent={selectedItem.targetPercent}
          currentPercent={selectedItem.currentPercent}
          color={selectedColor}
          unitLabel={unitLabel}
          disabled={disabled}
          onAdjust={handleAdjustTarget}
        />
      ) : null}
    </div>
  );
}
