import { useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertsCarousel } from "./overview/use-alerts-carousel";

export interface DashboardAlertItem {
  id: string;
  priority: number;
  content: ReactNode;
}

export interface DashboardAlertsCarouselProps {
  items: (DashboardAlertItem | null | undefined | false)[];
  className?: string;
  autoplayIntervalMs?: number;
  maxItems?: number;
}

/**
 * Carrossel infinito e priorizado de alertas contextuais da Home.
 */
export function DashboardAlertsCarousel({
  items,
  className,
  autoplayIntervalMs = 8000,
  maxItems,
}: DashboardAlertsCarouselProps) {
  const validItems = useMemo(() => {
    const sorted = items
      .filter((item): item is DashboardAlertItem => Boolean(item && item.content))
      .sort((a, b) => a.priority - b.priority);
    return maxItems && maxItems > 0 ? sorted.slice(0, maxItems) : sorted;
  }, [items, maxItems]);

  const total = validItems.length;
  const itemsKey = useMemo(() => validItems.map((i) => i.id).join(","), [validItems]);
  const extendedItems = useMemo(() => {
    if (total <= 1) return validItems;
    const firstClone = { ...validItems[0]!, id: `${validItems[0]!.id}-clone-end` };
    const lastClone = { ...validItems[total - 1]!, id: `${validItems[total - 1]!.id}-clone-start` };
    return [lastClone, ...validItems, firstClone];
  }, [validItems, total]);

  const carousel = useAlertsCarousel(total, autoplayIntervalMs, itemsKey);

  if (total === 0) return null;

  const firstItem = validItems[0];
  if (total === 1 && firstItem) {
    return (
      <section
        aria-label="Alertas e avisos contextuais"
        aria-roledescription="carousel"
        className={cn("flex flex-col gap-2 w-full min-w-0 relative group", className)}
      >
        <div className="w-full min-w-0 py-0.5">
          <div className="w-full px-1 sm:px-1.5">{firstItem.content}</div>
        </div>
      </section>
    );
  }

  const maxExtendedIndex = Math.max(extendedItems.length - 1, 0);
  const safePhysicalIndex = Math.min(Math.max(carousel.physicalIndex, 0), maxExtendedIndex);

  return (
    <section
      aria-label="Alertas e avisos contextuais"
      aria-roledescription="carousel"
      className={cn("flex flex-col gap-2 w-full min-w-0 relative group", className)}
      onMouseEnter={() => carousel.setIsPaused(true)}
      onMouseLeave={() => carousel.setIsPaused(false)}
      onFocus={() => carousel.setIsPaused(true)}
      onBlur={() => carousel.setIsPaused(false)}
      onTouchStart={carousel.handleTouchStart}
      onTouchEnd={carousel.handleTouchEnd}
    >
      <div className="flex items-center justify-between px-1 text-xs">
        <div
          className="flex items-center gap-1.5"
          aria-label={`Aviso ${carousel.logicalIndex + 1} de ${total}`}
        >
          {validItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => carousel.goToSlide(idx)}
              className={cn(
                "relative h-1.5 rounded-full transition-all duration-[280ms] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-y-4 max-sm:after:-inset-x-2",
                idx === carousel.logicalIndex
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Ir para alerta ${idx + 1}`}
              aria-current={idx === carousel.logicalIndex ? "true" : undefined}
            />
          ))}
          <span className="text-[11px] font-medium text-muted-foreground ml-1.5 tabular-nums">
            {carousel.logicalIndex + 1} de {total}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={carousel.prevSlide}
            aria-label="Alerta anterior"
            className="relative flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={carousel.nextSlide}
            aria-label="Próximo alerta"
            className="relative flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-hidden py-0.5">
        <div
          onTransitionEnd={carousel.snapToBounds}
          className={cn(
            "flex w-full will-change-transform items-stretch",
            carousel.isTransitioning
              ? "transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:duration-0"
              : "transition-none",
          )}
          style={{ transform: `translateX(-${safePhysicalIndex * 100}%)` }}
        >
          {extendedItems.map((item, idx) => (
            <div
              key={item.id}
              className="w-full min-w-full shrink-0 flex items-stretch px-1 sm:px-1.5"
              aria-hidden={idx !== safePhysicalIndex}
              inert={idx !== safePhysicalIndex ? true : undefined}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
