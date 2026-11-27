import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCarouselPresenceHint } from "@/hooks/use-carousel-presence-hint";
import { cn } from "@/lib/utils";
import { CarouselPauseProvider } from "./carousel-pause-context";
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
  isLoading?: boolean;
  /** Controla animação de entrada na montagem (desativar em revisitas com cache quente). */
  animateOnMount?: boolean;
  /** Chave opcional de hint por usuário para reservar altura apenas se havia cards antes. */
  presenceHintKey?: string;
}

/**
 * Carrossel priorizado de alertas contextuais da Home e de Investimentos.
 * Renderiza 1 nó por card (sem clones no DOM), seleciona por ID estável e coordena
 * locks de pausa entre overlays/modais via `CarouselPauseProvider`.
 */
export function DashboardAlertsCarousel(props: DashboardAlertsCarouselProps) {
  return (
    <CarouselPauseProvider>
      <DashboardAlertsCarouselInner {...props} />
    </CarouselPauseProvider>
  );
}

function DashboardAlertsCarouselInner({
  items,
  className,
  autoplayIntervalMs = 8000,
  maxItems,
  isLoading = false,
  animateOnMount = true,
  presenceHintKey,
}: DashboardAlertsCarouselProps) {
  const validItems = useMemo(() => {
    const sorted = items
      .filter((item): item is DashboardAlertItem => Boolean(item && item.content))
      .sort((a, b) => a.priority - b.priority);
    return maxItems && maxItems > 0 ? sorted.slice(0, maxItems) : sorted;
  }, [items, maxItems]);

  const total = validItems.length;
  const itemIds = useMemo(() => validItems.map((i) => i.id), [validItems]);
  const carousel = useAlertsCarousel(itemIds, autoplayIntervalMs);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const hadFocusInTrackRef = useRef(false);
  const prevActiveIdRef = useRef<string | null>(carousel.activeId);

  // Retorna foco ao próximo slide ativo se o item anterior foi removido enquanto o foco estava nele
  useEffect(() => {
    const prevId = prevActiveIdRef.current;
    prevActiveIdRef.current = carousel.activeId;
    if (
      prevId &&
      carousel.activeId &&
      prevId !== carousel.activeId &&
      typeof document !== "undefined" &&
      trackRef.current
    ) {
      const currentActive = document.activeElement;
      const focusLostToBody =
        currentActive === document.body || currentActive === null;
      const focusStillInTrack =
        currentActive !== null && trackRef.current.contains(currentActive);

      if (
        (hadFocusInTrackRef.current && focusLostToBody) ||
        focusStillInTrack
      ) {
        const slides = trackRef.current.querySelectorAll<HTMLElement>(
          "[data-carousel-slide-id]",
        );
        const activeSlide = Array.from(slides).find(
          (el) => el.getAttribute("data-carousel-slide-id") === carousel.activeId,
        );
        const focusable = activeSlide?.querySelector<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        );
        focusable?.focus();
      }
    }
  }, [carousel.activeId]);

  const { shouldShowSkeleton } = useCarouselPresenceHint(
    presenceHintKey ?? "default_alerts",
    {
      isLoading,
      hasItems: total > 0,
    },
  );

  if (isLoading) {
    if (!presenceHintKey || !shouldShowSkeleton) return null;
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando alertas"
        className="w-full min-h-[104px] sm:min-h-[84px] rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs animate-pulse flex items-center gap-3.5"
      >
        <div className="size-9 shrink-0 rounded-xl bg-muted" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 w-40 max-w-full rounded bg-muted" />
          <div className="h-3 w-72 max-w-full rounded bg-muted/70" />
        </div>
      </div>
    );
  }

  if (total === 0) return null;

  const firstItem = validItems[0];
  if (total === 1 && firstItem) {
    return (
      <section
        aria-label="Alertas e avisos contextuais"
        aria-roledescription="carousel"
        className={cn(
          "flex flex-col gap-2 w-full min-w-0 relative group",
          animateOnMount && "animate-fade-slide-in",
          className,
        )}
        onMouseEnter={() => carousel.setHoverPaused(true)}
        onMouseLeave={() => carousel.setHoverPaused(false)}
        onFocus={() => carousel.setFocusPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            carousel.setFocusPaused(false);
          }
        }}
        onTouchStart={carousel.handleTouchStart}
        onTouchEnd={carousel.handleTouchEnd}
        onTouchCancel={carousel.handleTouchCancel}
      >
        <div
          ref={trackRef}
          className="w-full min-w-0 py-0.5"
          onFocusCapture={() => {
            hadFocusInTrackRef.current = true;
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              hadFocusInTrackRef.current = false;
            }
          }}
        >
          <div
            data-carousel-slide-id={firstItem.id}
            className="w-full px-1 sm:px-1.5"
          >
            {firstItem.content}
          </div>
        </div>
      </section>
    );
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      carousel.nextSlide();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      carousel.prevSlide();
    }
  };

  return (
    <section
      aria-label="Alertas e avisos contextuais"
      aria-roledescription="carousel"
      className={cn(
        "flex flex-col gap-2 w-full min-w-0 relative group",
        animateOnMount && "animate-fade-slide-in",
        className,
      )}
      onMouseEnter={() => carousel.setHoverPaused(true)}
      onMouseLeave={() => carousel.setHoverPaused(false)}
      onFocus={() => carousel.setFocusPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          carousel.setFocusPaused(false);
        }
      }}
      onTouchStart={carousel.handleTouchStart}
      onTouchEnd={carousel.handleTouchEnd}
      onTouchCancel={carousel.handleTouchCancel}
      onKeyDown={handleKeyDown}
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
            onClick={carousel.toggleManualPause}
            aria-label={carousel.manualPaused ? "Retomar rotação automática" : "Pausar rotação automática"}
            aria-pressed={carousel.manualPaused}
            title={carousel.manualPaused ? "Retomar rotação" : "Pausar rotação"}
            className="relative flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
          >
            {carousel.manualPaused ? (
              <Play className="size-3" aria-hidden="true" />
            ) : (
              <Pause className="size-3" aria-hidden="true" />
            )}
          </button>
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

      <div
        ref={trackRef}
        className="w-full min-w-0 overflow-hidden py-0.5"
        onFocusCapture={() => {
          hadFocusInTrackRef.current = true;
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            hadFocusInTrackRef.current = false;
          }
        }}
      >
        <div
          className={cn(
            "flex w-full will-change-transform items-stretch",
            carousel.isTransitioning
              ? "transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:duration-0"
              : "transition-none",
          )}
          style={{ transform: `translateX(-${carousel.activeIndex * 100}%)` }}
        >
          {validItems.map((item, idx) => (
            <div
              key={item.id}
              data-carousel-slide-id={item.id}
              className="w-full min-w-full shrink-0 flex items-stretch px-1 sm:px-1.5"
              aria-hidden={idx !== carousel.activeIndex}
              inert={idx !== carousel.activeIndex ? true : undefined}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
