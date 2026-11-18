import { useMemo, useState } from "react";
import {
  buildCategoryDonutArcs,
  buildCategoryVisualRingSlices,
  getCategorySliceColor,
} from "@/domain/charts";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { CategoryDonutLegend } from "./overview/category-donut-legend";
import { CategoryDonutRing } from "./overview/category-donut-ring";

export interface DonutSlice {
  key?: string;
  label: string;
  valueCents: number;
  subtitle?: string | null;
  icon?: string | null;
  color?: string | null;
  colorClassName?: string;
  onClick?: () => void;
}

export interface CategoryDonutProps {
  slices: DonutSlice[];
  totalCents?: number;
  centerValue?: string;
  selectedKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  className?: string;
  listClassName?: string;
  legendColumns?: 1 | 2 | "auto";
  emptyText?: string;
  centerCaption?: string;
  maxVisualSlices?: number;
  layout?: "auto" | "vertical" | "horizontal" | "side-by-side";
  donutSize?: "sm" | "md" | "lg";
  onSliceClick?: (slice: DonutSlice, index: number) => void;
}

const LAYOUT_CLASSES: Record<NonNullable<CategoryDonutProps["layout"]>, string> = {
  vertical: "flex-col items-center gap-4 sm:gap-5",
  horizontal: "flex-row items-center gap-4 sm:gap-5",
  "side-by-side": "flex-col items-center gap-4 lg:flex-row lg:items-center lg:gap-5",
  auto: "flex-col items-center gap-4 sm:gap-5 md:flex-row md:items-center lg:gap-6",
};

const SVG_SIZE_CLASSES: Record<NonNullable<CategoryDonutProps["donutSize"]>, string> = {
  sm: "size-32 sm:size-36 md:size-40",
  lg: "size-44 sm:size-48 md:size-52",
  md: "size-36 sm:size-40 md:size-44 lg:size-44 xl:size-48",
};

/**
 * CategoryDonut — distribuição visual interativa de categorias ou ativos.
 */
export function CategoryDonut({
  slices,
  totalCents,
  centerValue,
  selectedKey: controlledSelectedKey,
  onSelectKey,
  className,
  listClassName,
  emptyText = "Sem despesas",
  centerCaption,
  maxVisualSlices = 7,
  layout = "auto",
  donutSize = "md",
  legendColumns,
  onSliceClick,
}: CategoryDonutProps) {
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null);
  const [hoveredSliceKey, setHoveredSliceKey] = useState<string | null>(null);

  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);
  const activeSelectedKey =
    controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey;

  const validSlices = useMemo(() => slices.filter((s) => s.valueCents > 0), [slices]);
  const visualRingSlices = useMemo(
    () => buildCategoryVisualRingSlices(validSlices, maxVisualSlices),
    [validSlices, maxVisualSlices],
  );

  const activeKey = hoveredSliceKey ?? activeSelectedKey;
  const activeDisplayItem = useMemo(() => {
    if (!activeKey) return null;
    if (activeKey === "__donut_others__") {
      const othersSlice = visualRingSlices.find((v) => v.key === "__donut_others__");
      return othersSlice ? { ...othersSlice, icon: null } : null;
    }
    const foundIndex = slices.findIndex((s, idx) =>
      s.key ? s.key === activeKey : `${s.label}-${idx}` === activeKey,
    );
    if (foundIndex >= 0) {
      const found = slices[foundIndex]!;
      return {
        label: found.label,
        valueCents: found.valueCents,
        icon: found.icon,
        colorStyle: getCategorySliceColor(found.color, foundIndex),
      };
    }
    return visualRingSlices.find((v) => v.key === activeKey) ?? null;
  }, [activeKey, slices, visualRingSlices]);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="flex size-32 sm:size-36 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-surface/60">
          <p className="text-xs font-medium text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  const activeDisplayPercent =
    activeDisplayItem && total > 0 ? (activeDisplayItem.valueCents / total) * 100 : 0;

  const handleItemClick = (key: string, slice?: DonutSlice) => {
    const nextKey = activeSelectedKey === key ? null : key;
    triggerSensory("selection");
    if (controlledSelectedKey === undefined) setInternalSelectedKey(nextKey);
    onSelectKey?.(nextKey);
    const targetSlice =
      slice ?? slices.find((s, idx) => (s.key ? s.key === key : `${s.label}-${idx}` === key));
    targetSlice?.onClick?.();
    if (targetSlice) {
      const idx = slices.findIndex((s) => s === targetSlice);
      onSliceClick?.(targetSlice, idx >= 0 ? idx : 0);
    }
  };

  const handleResetSelection = () => {
    if (!activeSelectedKey) return;
    triggerSensory("selection");
    if (controlledSelectedKey === undefined) setInternalSelectedKey(null);
    onSelectKey?.(null);
  };

  const arcs = buildCategoryDonutArcs({
    visualRingSlices,
    total,
    activeSelectedKey,
    hoveredSliceKey,
  });

  return (
    <div className={cn("flex w-full min-w-0", LAYOUT_CLASSES[layout], className)} data-swipe-nav-ignore>
      <CategoryDonutRing
        arcs={arcs}
        total={total}
        slicesCount={slices.length}
        svgSizeClass={SVG_SIZE_CLASSES[donutSize]}
        centerValue={centerValue}
        centerCaption={centerCaption}
        activeSelectedKey={activeSelectedKey}
        hoveredSliceKey={hoveredSliceKey}
        activeDisplayItem={activeDisplayItem}
        activeDisplayPercent={activeDisplayPercent}
        onHoverSlice={setHoveredSliceKey}
        onSelectArc={(key) => handleItemClick(key)}
        onResetSelection={handleResetSelection}
      />

      <CategoryDonutLegend
        slices={slices}
        total={total}
        activeSelectedKey={activeSelectedKey}
        hoveredSliceKey={hoveredSliceKey}
        listClassName={listClassName}
        legendColumns={legendColumns}
        onHoverSlice={setHoveredSliceKey}
        onSelectSlice={handleItemClick}
      />
    </div>
  );
}
