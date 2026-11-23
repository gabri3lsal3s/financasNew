import { CategoryIcon } from "@/components/modules/category-icon";
import { MoneyText } from "@/components/ui/money-text";
import {
  CATEGORY_DONUT_CENTER,
  CATEGORY_DONUT_CIRCUMFERENCE,
  CATEGORY_DONUT_RADIUS,
  CATEGORY_DONUT_SIZE,
  CATEGORY_DONUT_STROKE_WIDTH,
  type CategoryDonutArc,
} from "@/domain/charts";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";

interface ActiveDisplayItem {
  label: string;
  valueCents: number;
  icon?: string | null;
  colorStyle: string;
}

export interface CategoryDonutRingProps {
  arcs: CategoryDonutArc[];
  total: number;
  slicesCount: number;
  svgSizeClass: string;
  centerValue?: string;
  centerCaption?: string;
  activeSelectedKey: string | null;
  hoveredSliceKey: string | null;
  activeDisplayItem: ActiveDisplayItem | null;
  activeDisplayPercent: number;
  onHoverSlice: (key: string | null) => void;
  onSelectArc: (key: string) => void;
  onResetSelection: () => void;
}

function getDynamicValueSize(valueCents: number): string {
  if (valueCents >= 100_000_000) return "text-[11px] sm:text-xs md:text-sm font-extrabold";
  if (valueCents >= 10_000_000) return "text-xs sm:text-sm md:text-base font-extrabold";
  return "text-xs sm:text-base md:text-lg font-extrabold";
}

/**
 * Anel SVG responsivo com pílulas arredondadas e núcleo dinâmico (Total / Categoria selecionada).
 */
export function CategoryDonutRing({
  arcs,
  total,
  slicesCount,
  svgSizeClass,
  centerValue,
  centerCaption,
  activeSelectedKey,
  hoveredSliceKey,
  activeDisplayItem,
  activeDisplayPercent,
  onHoverSlice,
  onSelectArc,
  onResetSelection,
}: CategoryDonutRingProps) {
  const hasAnyActive = hoveredSliceKey !== null || activeSelectedKey !== null;

  return (
    <div className="relative shrink-0 flex items-center justify-center py-2 self-center">
      <svg
        viewBox={`0 0 ${CATEGORY_DONUT_SIZE} ${CATEGORY_DONUT_SIZE}`}
        className={cn(svgSizeClass, "-rotate-90 transition-transform duration-300")}
        aria-hidden="true"
      >
        {arcs
          .filter((arc) => arc.dash > 0)
          .map((arc) => {
            const isHighlighted = arc.isHovered || arc.isSelected;
            const opacity = hasAnyActive ? (isHighlighted ? 1 : 0.35) : 1;
            const strokeWidth = isHighlighted
              ? CATEGORY_DONUT_STROKE_WIDTH + 2.5
              : CATEGORY_DONUT_STROKE_WIDTH;

            return (
              <circle
                key={arc.key}
                cx={CATEGORY_DONUT_CENTER}
                cy={CATEGORY_DONUT_CENTER}
                r={CATEGORY_DONUT_RADIUS}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dash} ${CATEGORY_DONUT_CIRCUMFERENCE - arc.dash}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap={arc.strokeLinecap}
                style={{ stroke: arc.colorStyle, opacity, cursor: "pointer" }}
                className="transition-all duration-200"
                onMouseEnter={() => onHoverSlice(arc.key)}
                onMouseLeave={() => onHoverSlice(null)}
                onClick={() => onSelectArc(arc.key)}
              />
            );
          })}
      </svg>

      <div
        role={activeSelectedKey ? "button" : undefined}
        tabIndex={activeSelectedKey ? 0 : undefined}
        onClick={onResetSelection}
        onKeyDown={
          activeSelectedKey
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onResetSelection();
                }
              }
            : undefined
        }
        className={cn(
          "absolute inset-[10%] flex flex-col items-center justify-center text-center p-2 rounded-full transition-all select-none overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          activeSelectedKey ? "cursor-pointer group hover:bg-surface-hover/30" : "pointer-events-none",
        )}
        aria-label={
          activeDisplayItem
            ? `${activeDisplayItem.label}: ${formatPercent(activeDisplayPercent)}%`
            : "Total geral"
        }
      >
        {activeDisplayItem ? (
          <div className="flex flex-col items-center justify-center w-full max-w-[90%] min-w-0">
            <div className="flex items-center justify-center gap-1 w-full min-w-0">
              {activeDisplayItem.icon && activeDisplayItem.colorStyle ? (
                <CategoryIcon
                  icon={activeDisplayItem.icon}
                  color={activeDisplayItem.colorStyle}
                  className="size-3 shrink-0"
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: activeDisplayItem.colorStyle }}
                  className="size-1.5 rounded-full shrink-0"
                />
              )}
              <span
                className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-tight truncate max-w-full text-center"
                style={{ color: activeDisplayItem.colorStyle }}
                title={activeDisplayItem.label}
              >
                {activeDisplayItem.label}
              </span>
            </div>
            <p
              className={cn(
                "privacy-mask text-foreground tracking-tight tabular-nums mt-0.5 leading-snug whitespace-nowrap",
                getDynamicValueSize(activeDisplayItem.valueCents),
              )}
            >
              <MoneyText cents={activeDisplayItem.valueCents} tone="default" />
            </p>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold tabular-nums mt-0.5 whitespace-nowrap">
              {Math.round(activeDisplayPercent)}%{" "}
              <span className="font-normal text-[10px] text-muted-foreground/80">do total</span>
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full max-w-[85%] min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-muted-foreground truncate max-w-full">
              Total
            </span>
            <p
              className={cn(
                "privacy-mask text-foreground tracking-tight tabular-nums mt-0.5 leading-snug whitespace-nowrap",
                getDynamicValueSize(total),
              )}
            >
              {centerValue ?? <MoneyText cents={total} tone="default" />}
            </p>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-medium mt-0.5 whitespace-nowrap">
              {centerCaption ?? `${slicesCount} ${slicesCount === 1 ? "item" : "itens"}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
