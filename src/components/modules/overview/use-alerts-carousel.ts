import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";

const SWIPE_THRESHOLD_PX = 40;
export const ALERTS_CAROUSEL_TRANSITION_MS = 280;

/**
 * Gerencia índice infinito com clones, swipe mobile, respeito a motion reduzido e autoplay.
 */
export function useAlertsCarousel(total: number, autoplayIntervalMs: number, itemsKey?: string) {
  const { motionLevel } = useVisualCustomization();
  const osReducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const reducedMotion = motionLevel === "reduced" || osReducedMotion;

  const [physicalIndex, setPhysicalIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(!reducedMotion);
  const [isPaused, setIsPaused] = useState(false);
  const [prevTotal, setPrevTotal] = useState(total);
  const [prevItemsKey, setPrevItemsKey] = useState(itemsKey);
  const touchStartXRef = useRef<number | null>(null);

  if (itemsKey !== undefined && prevItemsKey !== itemsKey) {
    setPrevItemsKey(itemsKey);
    setPrevTotal(total);
    setPhysicalIndex(1);
    setIsTransitioning(false);
  } else if (prevTotal !== total) {
    setPrevTotal(total);
    setPhysicalIndex(1);
    setIsTransitioning(false);
  }

  const logicalIndex = total > 0 ? (physicalIndex - 1 + total) % total : 0;

  useEffect(() => {
    if (!isTransitioning && !reducedMotion) {
      const raf = requestAnimationFrame(() => setIsTransitioning(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isTransitioning, reducedMotion]);

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

  useEffect(() => {
    if (physicalIndex >= total + 1 || physicalIndex <= 0) {
      const delay = reducedMotion ? 0 : ALERTS_CAROUSEL_TRANSITION_MS + 50;
      const timer = setTimeout(snapToBounds, delay);
      return () => clearTimeout(timer);
    }
  }, [physicalIndex, total, snapToBounds, reducedMotion]);

  const advanceNext = useCallback(() => {
    setPhysicalIndex((prev) => {
      if (prev >= total + 1) return total + 1;
      if (!reducedMotion) setIsTransitioning(true);
      return prev + 1;
    });
  }, [total, reducedMotion]);

  const advancePrev = useCallback(() => {
    setPhysicalIndex((prev) => {
      if (prev <= 0) return 0;
      if (!reducedMotion) setIsTransitioning(true);
      return prev - 1;
    });
  }, [reducedMotion]);

  const nextSlide = useCallback(() => {
    triggerSensory("selection");
    advanceNext();
  }, [advanceNext]);

  const prevSlide = useCallback(() => {
    triggerSensory("selection");
    advancePrev();
  }, [advancePrev]);

  const goToSlide = useCallback(
    (targetLogicalIndex: number) => {
      triggerSensory("selection");
      if (!reducedMotion) setIsTransitioning(true);
      setPhysicalIndex(targetLogicalIndex + 1);
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const timer = setInterval(advanceNext, autoplayIntervalMs);
    return () => clearInterval(timer);
  }, [total, isPaused, autoplayIntervalMs, advanceNext]);

  const handleTouchStart = (e: TouchEvent) => {
    setIsPaused(true);
    const touch = e.touches[0];
    if (touch) touchStartXRef.current = touch.clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const diffX = touchStartXRef.current - touch.clientX;
    if (Math.abs(diffX) >= SWIPE_THRESHOLD_PX) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
    touchStartXRef.current = null;
  };

  return {
    physicalIndex,
    logicalIndex,
    isTransitioning: !reducedMotion && isTransitioning,
    setIsPaused,
    snapToBounds,
    nextSlide,
    prevSlide,
    goToSlide,
    handleTouchStart,
    handleTouchEnd,
  };
}
