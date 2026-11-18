import { useMemo, useState } from "react";
import {
  buildCategoryDonutArcs,
  CATEGORY_DONUT_CENTER,
  CATEGORY_DONUT_CIRCUMFERENCE,
  CATEGORY_DONUT_RADIUS,
  CATEGORY_DONUT_SIZE,
  CATEGORY_DONUT_STROKE_WIDTH,
  resolveDonutSliceColor,
  type CategoryVisualRingSlice,
} from "@/domain/charts";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";
import { triggerSensory } from "@/services/sensory";
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
 * InteractiveTargetDonut — gráfico de rosca canônico para visualização da carteira
 * ideal e ajuste rápido de metas, padronizado com a arquitetura `CategoryDonut`.
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

  const visualRingSlices = useMemo<CategoryVisualRingSlice[]>(() => {
    const active: CategoryVisualRingSlice[] = items
      .map((item, idx) => ({
        key: item.key,
        label: item.label,
        valueCents: Math.round(item.targetPercent * 100),
        colorStyle: resolveDonutSliceColor(item.color, idx),
        memberKeys: [item.key],
      }))
      .filter((slice) => slice.valueCents > 0);

    if (!isOverflow && freePercent > 0) {
      active.push({
        key: FREE_SLICE_ID,
        label: "Livre",
        valueCents: Math.round(freePercent * 100),
        colorStyle: "hsl(var(--muted))",
        memberKeys: [FREE_SLICE_ID],
      });
    }
    return active;
  }, [items, isOverflow, freePercent]);

  const effectiveTotal = useMemo(() => {
    const total = visualRingSlices.reduce((sum, s) => sum + s.valueCents, 0);
    return Math.max(1, total);
  }, [visualRingSlices]);

  const arcs = useMemo(() => {
    return buildCategoryDonutArcs({
      visualRingSlices,
      total: effectiveTotal,
      activeSelectedKey: selectedKey,
      hoveredSliceKey: hoveredKey,
    });
  }, [visualRingSlices, effectiveTotal, selectedKey, hoveredKey]);

  const handleToggleKey = (key: string) => {
    if (disabled || key === FREE_SLICE_ID) return;
    triggerSensory("selection");
    onSelectKey?.(selectedKey === key ? null : key);
  };

  const handleAdjustTarget = (delta: number) => {
    if (disabled || !selectedItem || !onChangeTarget) return;
    const next = Math.max(0, Math.min(100, Math.round((selectedItem.targetPercent + delta) * 10) / 10));
    onChangeTarget(selectedItem.key, next);
  };

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
            <span className="num font-mono text-base sm:text-lg md:text-xl font-extrabold text-foreground tracking-tight leading-tight mt-0.5 whitespace-nowrap">
              {formatPercent(selectedItem.targetPercent)}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">{unitLabel}</span>
            </span>
            {selectedItem.currentPercent !== undefined ? (
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold mt-0.5 whitespace-nowrap tabular-nums">
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
                "num font-mono text-base sm:text-lg md:text-xl font-extrabold tracking-tight leading-tight mt-0.5 whitespace-nowrap",
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
        "flex flex-col items-center justify-center gap-5 w-full min-w-0 py-2",
        className,
      )}
      data-swipe-nav-ignore
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full min-w-0">
        <div className="relative shrink-0 flex items-center justify-center py-2 self-center">
          <svg
            viewBox={`0 0 ${CATEGORY_DONUT_SIZE} ${CATEGORY_DONUT_SIZE}`}
            className="size-40 sm:size-44 md:size-48 -rotate-90 transition-transform duration-300"
            aria-label={`Gráfico de metas: ${title}`}
            role="img"
          >
            {arcs
              .filter((arc) => arc.dash > 0)
              .map((arc) => {
                const isFree = arc.key === FREE_SLICE_ID;
                const isHighlighted = arc.isHovered || arc.isSelected;
                const hasAnyActive = hoveredKey !== null || selectedKey !== null;
                const opacity = hasAnyActive ? (isHighlighted ? 1 : 0.35) : 1;
                const strokeWidth = isHighlighted
                  ? CATEGORY_DONUT_STROKE_WIDTH + 2.5
                  : CATEGORY_DONUT_STROKE_WIDTH;

                const targetPct = items.find((i) => i.key === arc.key)?.targetPercent ?? 0;

                return (
                  <circle
                    key={arc.key}
                    cx={CATEGORY_DONUT_CENTER}
                    cy={CATEGORY_DONUT_CENTER}
                    r={CATEGORY_DONUT_RADIUS}
                    fill="none"
                    role={!disabled && !isFree ? "button" : undefined}
                    tabIndex={!disabled && !isFree ? 0 : undefined}
                    aria-label={!isFree ? `${arc.label}: ${formatPercent(targetPct)}%` : "Livre"}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${arc.dash} ${CATEGORY_DONUT_CIRCUMFERENCE - arc.dash}`}
                    strokeDashoffset={-arc.offset}
                    strokeLinecap={arc.strokeLinecap}
                    style={{
                      stroke: arc.colorStyle,
                      opacity,
                      cursor: disabled || isFree ? "default" : "pointer",
                    }}
                    className="transition-all duration-200 focus-visible:outline-none"
                    onMouseEnter={() => {
                      if (!disabled && !isFree) setHoveredKey(arc.key);
                    }}
                    onMouseLeave={() => {
                      if (!disabled) setHoveredKey(null);
                    }}
                    onClick={() => {
                      if (!disabled && !isFree) handleToggleKey(arc.key);
                    }}
                    onKeyDown={(e) => {
                      if (!disabled && !isFree && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleToggleKey(arc.key);
                      }
                    }}
                  />
                );
              })}
          </svg>

          <div
            role={selectedKey ? "button" : undefined}
            tabIndex={selectedKey ? 0 : undefined}
            onClick={() => {
              if (selectedKey) onSelectKey?.(null);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && selectedKey) {
                e.preventDefault();
                onSelectKey?.(null);
              }
            }}
            className={cn(
              "absolute inset-[10%] flex flex-col items-center justify-center text-center p-2 rounded-full transition-all select-none overflow-hidden",
              selectedKey ? "cursor-pointer group hover:bg-surface-hover/30" : "pointer-events-none",
            )}
            aria-live="polite"
          >
            {centerContent}
          </div>
        </div>

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
