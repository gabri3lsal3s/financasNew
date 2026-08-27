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
  /** Intervalo em milissegundos para rotação automática (padrão: 8000ms = 8s). */
  autoplayIntervalMs?: number;
}

const SWIPE_THRESHOLD_PX = 40;
const TRANSITION_DURATION_MS = 850;

export function DashboardAlertsCarousel({
  items,
  className,
  autoplayIntervalMs = 8000,
}: DashboardAlertsCarouselProps) {
  // Filtra itens vazios/nulos e ordena por prioridade crescente (1 = mais urgente)
  const validItems = useMemo(() => {
    return items
      .filter((item): item is DashboardAlertItem => Boolean(item && item.content))
      .sort((a, b) => a.priority - b.priority);
  }, [items]);

  const total = validItems.length;

  // Lista estendida com clones nas pontas para loop infinito contínuo
  const extendedItems = useMemo(() => {
    if (total <= 1) return validItems;
    const firstClone = { ...validItems[0]!, id: `${validItems[0]!.id}-clone-end` };
    const lastClone = { ...validItems[total - 1]!, id: `${validItems[total - 1]!.id}-clone-start` };
    return [lastClone, ...validItems, firstClone];
  }, [validItems, total]);

  const [physicalIndex, setPhysicalIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const [prevTotal, setPrevTotal] = useState(total);
  if (prevTotal !== total) {
    setPrevTotal(total);
    setPhysicalIndex(1);
    setIsTransitioning(false);
  }

  // Índice lógico do card ativo para exibição de dots e contadores (0 a total - 1)
  const logicalIndex = total > 0 ? (physicalIndex - 1 + total) % total : 0;

  // Reativa transição suave no próximo frame após o snap invisível
  useEffect(() => {
    if (!isTransitioning) {
      const raf = requestAnimationFrame(() => {
        setIsTransitioning(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isTransitioning]);

  // Função centralizada para snap de borda
  const snapToBounds = useCallback(() => {
    setPhysicalIndex((prev) => {
      if (prev >= total + 1) {
        setIsTransitioning(false);
        return 1;
      }
      if (prev <= 0) {
        setIsTransitioning(false);
        return total;
      }
      return prev;
    });
  }, [total]);

  // Timer de segurança: caso o browser mobile engula ou cancele o evento onTransitionEnd,
  // força o snap após o tempo da animação (evitando tela preta/vazia)
  useEffect(() => {
    if (physicalIndex >= total + 1 || physicalIndex <= 0) {
      const timer = setTimeout(() => {
        snapToBounds();
      }, TRANSITION_DURATION_MS + 50);
      return () => clearTimeout(timer);
    }
  }, [physicalIndex, total, snapToBounds]);

  const nextSlide = useCallback(() => {
    setPhysicalIndex((prev) => {
      // Bloqueia avanço além do clone final se ainda não fez o snap
      if (prev >= total + 1) return total + 1;
      setIsTransitioning(true);
      return prev + 1;
    });
  }, [total]);

  const prevSlide = useCallback(() => {
    setPhysicalIndex((prev) => {
      // Bloqueia recuo abaixo do clone inicial se ainda não fez o snap
      if (prev <= 0) return 0;
      setIsTransitioning(true);
      return prev - 1;
    });
  }, []);

  const goToSlide = useCallback((targetLogicalIndex: number) => {
    setIsTransitioning(true);
    setPhysicalIndex(targetLogicalIndex + 1);
  }, []);

  const handleTransitionEnd = () => {
    snapToBounds();
  };

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

  // Índice blindado que nunca excede o range de extendedItems (Zero tela preta)
  const maxExtendedIndex = Math.max(extendedItems.length - 1, 0);
  const safePhysicalIndex = Math.min(Math.max(physicalIndex, 0), maxExtendedIndex);

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
        <div className="flex items-center gap-1.5" aria-label={`Aviso ${logicalIndex + 1} de ${total}`}>
          {validItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goToSlide(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                idx === logicalIndex
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Ir para alerta ${idx + 1}`}
              aria-current={idx === logicalIndex ? "true" : undefined}
            />
          ))}
          <span className="text-[11px] font-medium text-muted-foreground ml-1.5 tabular-nums">
            {logicalIndex + 1} de {total}
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

      {/* Trilha Deslizante Horizontal em Loop Infinito com Gutter e Índice Blindado */}
      <div className="w-full min-w-0 overflow-hidden py-0.5">
        <div
          onTransitionEnd={handleTransitionEnd}
          className={cn(
            "flex w-full will-change-transform items-stretch",
            isTransitioning ? "transition-transform duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]" : "transition-none",
          )}
          style={{ transform: `translateX(-${safePhysicalIndex * 100}%)` }}
        >
          {extendedItems.map((item, idx) => (
            <div
              key={item.id}
              className="w-full min-w-full shrink-0 flex flex-col px-1 sm:px-1.5"
              aria-hidden={idx !== safePhysicalIndex}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
