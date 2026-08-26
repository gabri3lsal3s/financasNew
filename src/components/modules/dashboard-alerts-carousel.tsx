import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardAlertItem {
  id: string;
  /** Prioridade numérica (menor número = maior urgência, ex: 1 para risco imediato, 5 para onboarding). */
  priority: number;
  content: ReactNode;
}

export interface DashboardAlertsCarouselProps {
  items: (DashboardAlertItem | null | undefined | false)[];
  className?: string;
  /** Intervalo em milissegundos para rotação automática (padrão: 7000ms = 7s). */
  autoplayIntervalMs?: number;
}

const SWIPE_THRESHOLD_PX = 40;

export function DashboardAlertsCarousel({
  items,
  className,
  autoplayIntervalMs = 7000,
}: DashboardAlertsCarouselProps) {
  // Filtra itens vazios/nulos e ordena por prioridade crescente (1 = mais urgente)
  const validItems = useMemo(() => {
    return items
      .filter((item): item is DashboardAlertItem => Boolean(item && item.content))
      .sort((a, b) => a.priority - b.priority);
  }, [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const total = validItems.length;
  const safeIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % (total || 1));
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + (total || 1)) % (total || 1));
  }, [total]);

  // Autoplay inteligente
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoplayIntervalMs);

    return () => clearInterval(timer);
  }, [total, isPaused, autoplayIntervalMs, nextSlide]);

  // Gestos de Swipe no mobile
  const handleTouchStart = (e: TouchEvent) => {
    setIsPaused(true);
    const touch = e.touches[0];
    if (touch) {
      touchStartXRef.current = touch.clientX;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const touchEndX = touch.clientX;
    const diffX = touchStartXRef.current - touchEndX;

    if (Math.abs(diffX) >= SWIPE_THRESHOLD_PX) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartXRef.current = null;
  };

  if (total === 0) {
    return null;
  }

  // Se houver apenas 1 alerta ativo, renderiza diretamente sem controles ou overhead de carrossel
  const firstItem = validItems[0];
  if (total === 1 && firstItem) {
    return <div className={cn("w-full min-w-0", className)}>{firstItem.content}</div>;
  }

  const currentItem = validItems[safeIndex] ?? firstItem;
  if (!currentItem) {
    return null;
  }

  return (
    <section
      aria-label="Alertas e avisos contextuais"
      aria-roledescription="carousel"
      className={cn("flex flex-col gap-2 w-full min-w-0 relative group", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Barra de controle e paginação superior/integrada */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-1.5" aria-label={`Aviso ${safeIndex + 1} de ${total}`}>
          {validItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                idx === safeIndex
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Ir para alerta ${idx + 1}`}
              aria-current={idx === safeIndex ? "true" : undefined}
            />
          ))}
          <span className="text-[11px] font-medium text-muted-foreground ml-1.5 tabular-nums">
            {safeIndex + 1} de {total}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Alerta anterior"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Próximo alerta"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Trilha Deslizante Horizontal (Slide Track) */}
      <div className="w-full min-w-0 overflow-hidden rounded-2xl">
        <div
          className="flex w-full transition-transform duration-500 ease-out will-change-transform items-stretch"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {validItems.map((item, idx) => (
            <div
              key={item.id}
              className="w-full min-w-full shrink-0 h-full flex flex-col"
              aria-hidden={idx !== safeIndex}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
