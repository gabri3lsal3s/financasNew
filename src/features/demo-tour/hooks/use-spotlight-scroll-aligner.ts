import type { RefObject } from "react";
import {
  calculateDeadCenterScrollTop,
  calculateFreeViewportWindow,
  DEFAULT_CARD_HEIGHT,
} from "@/domain/demo-simulation";
import type { MotionLevel } from "@/hooks/use-visual-customization";

export interface ScrollAndMeasureOptions {
  element: Element;
  candidateSelectors: string[];
  motionLevel: MotionLevel;
  cardRef: RefObject<HTMLElement | null>;
  updateTargetRect: () => void;
  onSettled?: () => void;
}

export interface ScrollSession {
  cancel: () => void;
}

/**
 * Executa a rolagem suave do contêiner e estabiliza a medição de posição do alvo.
 */
export function performScrollAndMeasureTarget({
  element,
  candidateSelectors,
  motionLevel,
  cardRef,
  updateTargetRect,
  onSettled,
}: ScrollAndMeasureOptions): ScrollSession {
  updateTargetRect();

  const container = document.getElementById("main-content");
  const headerHeight = 64;
  const spacing = 16;
  const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;
  const scrollBehavior: ScrollBehavior = motionLevel === "reduced" ? "auto" : "smooth";

  const isBottomElement =
    candidateSelectors.includes('[data-tour="settings-support-card"]') ||
    element.getAttribute("data-tour") === "settings-support-card";

  const isFixedElement =
    (element instanceof HTMLElement &&
      window.getComputedStyle(element).position === "fixed") ||
    Boolean(element.closest("nav.fixed, header.fixed, [data-tour-fixed='true']"));

  if (isBottomElement && container) {
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior: scrollBehavior });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: scrollBehavior, block: "center" });
    }
  } else if (!isFixedElement && container && container.contains(element)) {
    let targetScrollTop = 0;

    if (element instanceof HTMLElement && typeof element.getBoundingClientRect === "function") {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (isMobileScreen && (elementRect.top !== 0 || elementRect.bottom !== 0 || elementRect.height !== 0)) {
        const elCenterY = elementRect.top + elementRect.height / 2;
        const anchorPosition = elCenterY > (window.innerHeight || 800) * 0.45 ? "top" : "bottom";
        const freeWindow = calculateFreeViewportWindow({
          windowHeight: window.innerHeight,
          cardHeight: cardRef.current?.offsetHeight || DEFAULT_CARD_HEIGHT,
          anchorPosition,
          isMobile: true,
        });
        const maxScrollTop = container.scrollHeight - container.clientHeight;
        targetScrollTop = calculateDeadCenterScrollTop({
          containerScrollTop: container.scrollTop,
          elementCenterY: elCenterY,
          viewportFreeCenterY: freeWindow.centerY,
          maxScrollTop: maxScrollTop > 0 ? maxScrollTop : undefined,
        });
      } else if (elementRect.top !== 0 || containerRect.top !== 0) {
        const containerTopOffset = containerRect.top > 0 ? 0 : headerHeight;
        targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - containerTopOffset - spacing;
      } else {
        targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
      }
    } else if (element instanceof HTMLElement) {
      targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
    }

    const safeScrollTop = Math.max(0, targetScrollTop);
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: safeScrollTop, behavior: scrollBehavior });
    } else {
      container.scrollTop = safeScrollTop;
    }
  } else if (!isFixedElement && typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ behavior: scrollBehavior, block: "center" });
  }

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (isBottomElement && container) {
        container.scrollTo({ top: container.scrollHeight, behavior: scrollBehavior });
      }
      updateTargetRect();
    });
    resizeObserver.observe(element);
    if (isBottomElement && container) resizeObserver.observe(container);
  }

  let isSettled = false;
  let isCleanedUp = false;
  let rafId: number | undefined;
  const scrollTarget = container ?? (typeof window !== "undefined" ? window : null);

  const settleAndMeasure = () => {
    if (isSettled || isCleanedUp) return;
    isSettled = true;
    if (rafId) cancelAnimationFrame(rafId);
    clearTimeout(maxTimeout);
    scrollTarget?.removeEventListener("scrollend", onScrollEnd);
    if (isBottomElement && container) container.scrollTop = container.scrollHeight;
    updateTargetRect();
    onSettled?.();

    setTimeout(() => {
      if (!isCleanedUp) updateTargetRect();
    }, 300);
    setTimeout(() => {
      if (!isCleanedUp) updateTargetRect();
    }, 550);
  };

  const onScrollEnd = () => settleAndMeasure();
  const maxTimeout = setTimeout(settleAndMeasure, 750);
  scrollTarget?.addEventListener("scrollend", onScrollEnd, { once: true });

  let lastElementTop = 0;
  let lastElementLeft = 0;
  if (element && typeof element.getBoundingClientRect === "function") {
    const b = element.getBoundingClientRect();
    lastElementTop = b.top;
    lastElementLeft = b.left;
  }
  let stableFrames = 0;
  const startTime = Date.now();

  const checkScrollStabilization = () => {
    if (isSettled || isCleanedUp) return;
    let currentTop = 0;
    let currentLeft = 0;
    if (element && typeof element.getBoundingClientRect === "function") {
      const b = element.getBoundingClientRect();
      currentTop = b.top;
      currentLeft = b.left;
    }

    const isElementStationary =
      Math.abs(currentTop - lastElementTop) < 1 &&
      Math.abs(currentLeft - lastElementLeft) < 1;

    if (isElementStationary) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      lastElementTop = currentTop;
      lastElementLeft = currentLeft;
      updateTargetRect();
    }

    const elapsed = Date.now() - startTime;
    if (stableFrames >= 4 && elapsed >= 180) {
      settleAndMeasure();
    } else {
      rafId = requestAnimationFrame(checkScrollStabilization);
    }
  };

  rafId = requestAnimationFrame(checkScrollStabilization);

  return {
    cancel: () => {
      isCleanedUp = true;
      if (!isSettled) {
        isSettled = true;
        if (rafId) cancelAnimationFrame(rafId);
        clearTimeout(maxTimeout);
        scrollTarget?.removeEventListener("scrollend", onScrollEnd);
      }
      resizeObserver?.disconnect();
    },
  };
}
