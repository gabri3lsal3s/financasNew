import { CategoryIcon } from "@/components/modules/category-icon";
import { MoneyText } from "@/components/ui/money-text";
import { getCategorySliceColor } from "@/domain/charts";
import { cn } from "@/lib/utils";
import type { DonutSlice } from "../category-donut";

export interface CategoryDonutLegendProps {
  slices: DonutSlice[];
  total: number;
  activeSelectedKey: string | null;
  hoveredSliceKey: string | null;
  listClassName?: string;
  onHoverSlice: (key: string | null) => void;
  onSelectSlice: (key: string, slice: DonutSlice) => void;
}

/**
 * Lista interativa de legendas e barras proporcionais do CategoryDonut.
 */
export function CategoryDonutLegend({
  slices,
  total,
  activeSelectedKey,
  hoveredSliceKey,
  listClassName,
  onHoverSlice,
  onSelectSlice,
}: CategoryDonutLegendProps) {
  return (
    <ul
      className={cn(
        "w-full min-w-0 overflow-hidden",
        slices.length > 4 && !listClassName
          ? "grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2"
          : "flex flex-col space-y-1.5 sm:space-y-2",
        listClassName,
      )}
    >
      {slices.map((slice, index) => {
        const sliceKey = slice.key ?? `${slice.label}-${index}`;
        const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
        const colorStyle = getCategorySliceColor(slice.color, index);
        const isSelected = activeSelectedKey === sliceKey;
        const isHovered = hoveredSliceKey === sliceKey;
        const isHighlighted = isSelected || isHovered;

        return (
          <li key={sliceKey} className="w-full min-w-0">
            <button
              type="button"
              aria-label={`Selecionar ${slice.label}`}
              aria-pressed={isSelected}
              onClick={() => onSelectSlice(sliceKey, slice)}
              onMouseEnter={() => onHoverSlice(sliceKey)}
              onMouseLeave={() => onHoverSlice(null)}
              className={cn(
                "group flex flex-col gap-1 sm:gap-1.5 rounded-xl px-2.5 py-2 sm:py-1.5 min-h-11 sm:min-h-0 transition-all min-w-0 w-full border text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isSelected
                  ? "bg-surface-hover border-border shadow-xs ring-1 ring-border/80"
                  : isHovered
                    ? "bg-surface-hover/80 border-border/80 shadow-xs"
                    : "border-transparent hover:bg-surface-hover/60 hover:border-border/80",
              )}
            >
              <div className="flex items-center gap-2 text-xs min-w-0 w-full">
                {slice.icon ? (
                  <CategoryIcon icon={slice.icon} color={colorStyle} className="size-4 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: colorStyle }}
                    className={cn(
                      "size-3 shrink-0 rounded-full ring-2 ring-surface shadow-xs transition-transform",
                      isHighlighted && "scale-110",
                    )}
                  />
                )}
                <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                  <span
                    className={cn(
                      "line-clamp-2 break-words font-semibold transition-colors",
                      isHighlighted ? "text-foreground font-bold" : "text-foreground/90",
                    )}
                    title={slice.label}
                  >
                    {slice.label}
                  </span>
                  {slice.subtitle ? (
                    <span className="text-[10px] text-muted-foreground truncate">{slice.subtitle}</span>
                  ) : null}
                </div>
                <span className="num font-bold text-foreground text-xs shrink-0 tabular-nums">
                  {Math.round(percent)}%
                </span>
                <MoneyText
                  cents={slice.valueCents}
                  tone="default"
                  className="privacy-mask text-right text-xs font-semibold shrink-0 tabular-nums whitespace-nowrap"
                />
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(2, percent))}%`,
                    backgroundColor: colorStyle,
                    opacity: isHighlighted ? 1 : 0.85,
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
