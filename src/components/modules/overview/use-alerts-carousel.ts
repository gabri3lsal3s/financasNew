import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { useCarouselPauseContext } from "../carousel-pause-context";

const SWIPE_THRESHOLD_PX = 40;
export const ALERTS_CAROUSEL_TRANSITION_MS = 280;

/**
 * Gerencia seleção por ID estável, swipe horizontal sem interceptar scroll vertical,
 * respeito a motion reduzido e autoplay coordenado com `CarouselPauseContext` (sem clones).
 */
export function useAlertsCarousel(
  itemIds: readonly string[],
  autoplayIntervalMs: number,
) {
  const total = itemIds.length;
  const { motionLevel } = useVisualCustomization();
  const osReducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const reducedMotion = motionLevel === "reduced" || osReducedMotion;

  const { isPaused: contextPaused, manualPaused, toggleManualPause, acquireLock } =
    useCarouselPauseContext();

  const [activeId, setActiveId] = useState<string | null>(() => itemIds[0] ?? null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [focusLocked, setFocusLocked] = useState(false);
  const [touchLocked, setTouchLocked] = useState(false);

  const releaseHoverRef = useRef<(() => void) | null>(null);
  const releaseFocusRef = useRef<(() => void) | null>(null);
  const releaseTouchRef = useRef<(() => void) | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Sincroniza locks locais no CarouselPauseContext sem que um feche o do outro
  useEffect(() => {
    if (total > 0 && hoverLocked && !releaseHoverRef.current) {
      releaseHoverRef.current = acquireLock("hover");
    } else if ((!hoverLocked || total === 0) && releaseHoverRef.current) {
      releaseHoverRef.current();
      releaseHoverRef.current = null;
    }
  }, [total, hoverLocked, acquireLock]);

  useEffect(() => {
    if (total > 0 && focusLocked && !releaseFocusRef.current) {
      releaseFocusRef.current = acquireLock("focus");
    } else if ((!focusLocked || total === 0) && releaseFocusRef.current) {
      releaseFocusRef.current();
      releaseFocusRef.current = null;
    }
  }, [total, focusLocked, acquireLock]);

  useEffect(() => {
    if (total > 0 && touchLocked && !releaseTouchRef.current) {
      releaseTouchRef.current = acquireLock("touch");
    } else if ((!touchLocked || total === 0) && releaseTouchRef.current) {
      releaseTouchRef.current();
      releaseTouchRef.current = null;
    }
  }, [total, touchLocked, acquireLock]);

  useEffect(() => {
    return () => {
      releaseHoverRef.current?.();
      releaseFocusRef.current?.();
      releaseTouchRef.current?.();
    };
  }, []);

  // Resolve índice ativo por ID estável; se removido, escolhe vizinho seguro
  const matchedIndex = activeId ? itemIds.indexOf(activeId) : -1;
  const activeIndex =
    total === 0
      ? 0
      : matchedIndex !== -1
        ? matchedIndex
        : Math.min(Math.max(0, fallbackIndex), total - 1);
  const resolvedActiveId = total > 0 ? (itemIds[activeIndex] ?? null) : null;

  const advanceNext = useCallback(() => {
    if (total <= 1) return;
    const nextIdx = (activeIndex + 1) % total;
    setFallbackIndex(nextIdx);
    setActiveId(itemIds[nextIdx] ?? null);
  }, [total, activeIndex, itemIds]);

  const advancePrev = useCallback(() => {
    if (total <= 1) return;
    const prevIdx = (activeIndex - 1 + total) % total;
    setFallbackIndex(prevIdx);
    setActiveId(itemIds[prevIdx] ?? null);
  }, [total, activeIndex, itemIds]);

  const nextSlide = useCallback(() => {
    triggerSensory("selection");
    advanceNext();
  }, [advanceNext]);

  const prevSlide = useCallback(() => {
    triggerSensory("selection");
    advancePrev();
  }, [advancePrev]);

  const goToSlide = useCallback(
    (targetIndex: number) => {
      if (total <= 0) return;
      const safeIdx = Math.min(Math.max(0, targetIndex), total - 1);
      triggerSensory("selection");
      setFallbackIndex(safeIdx);
      setActiveId(itemIds[safeIdx] ?? null);
    },
    [total, itemIds],
  );

  const isPaused = contextPaused || hoverLocked || focusLocked || touchLocked;

  // Autoplay respeita pausa manual, locks de overlay e prefers-reduced-motion
  useEffect(() => {
    if (total <= 1 || isPaused || reducedMotion) return;
    const timer = setInterval(advanceNext, autoplayIntervalMs);
    return () => clearInterval(timer);
  }, [total, isPaused, reducedMotion, autoplayIntervalMs, advanceNext]);

  const handleTouchStart = (e: TouchEvent) => {
    setTouchLocked(true);
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY ?? 0 };
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setTouchLocked(false);
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const diffX = start.x - touch.clientX;
    const diffY = start.y - (touch.clientY ?? 0);
    // Apenas swipe predominantemente horizontal (>= 40px), sem interceptar scroll vertical
    if (Math.abs(diffX) >= SWIPE_THRESHOLD_PX && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
  };

  const handleTouchCancel = () => {
    setTouchLocked(false);
    touchStartRef.current = null;
  };

  return {
    activeIndex,
    logicalIndex: activeIndex,
    activeId: resolvedActiveId,
    isTransitioning: !reducedMotion,
    isPaused,
    manualPaused,
    toggleManualPause,
    setHoverPaused: setHoverLocked,
    setFocusPaused: setFocusLocked,
    nextSlide,
    prevSlide,
    goToSlide,
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
  };
}
