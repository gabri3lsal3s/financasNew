import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  calculateSpotlightGeometry,
  resolveTourStepCandidateSelectors,
  resolveTourStepTargetSelector,
  type TourStep,
} from "@/domain/demo-simulation";
import type { MotionLevel } from "@/hooks/use-visual-customization";
import { useSpotlightCardPosition } from "./use-spotlight-card-position";
import { performScrollAndMeasureTarget, type ScrollSession } from "./use-spotlight-scroll-aligner";
import { startTargetElementSearch } from "./use-spotlight-target-element";

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

export interface UseSpotlightTargetRectOptions {
  isDemoActive: boolean;
  activeTrack: string | null;
  currentStepIndex: number;
  currentStep: TourStep | undefined;
  currentRoute: string;
  motionLevel: MotionLevel;
  cardRef: RefObject<HTMLElement | null>;
}

export function useSpotlightTargetRect({
  isDemoActive,
  activeTrack,
  currentStepIndex,
  currentStep,
  currentRoute,
  motionLevel,
  cardRef,
}: UseSpotlightTargetRectOptions) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number>(220);
  const [prevStepIndex, setPrevStepIndex] = useState<number>(currentStepIndex);
  const [prevIsDemoActive, setPrevIsDemoActive] = useState<boolean>(isDemoActive);
  const [prevActiveTrack, setPrevActiveTrack] = useState<string | null>(activeTrack);
  const [isPulsing, setIsPulsing] = useState<boolean>(motionLevel === "fluid");
  const [isPositionReady, setIsPositionReady] = useState<boolean>(false);
  const [isTargetLoading, setIsTargetLoading] = useState<boolean>(() => {
    const isDesk = typeof window !== "undefined" ? window.innerWidth >= 768 : false;
    return Boolean(isDemoActive && resolveTourStepTargetSelector(currentStep, isDesk));
  });

  const previousRouteRef = useRef<string>(currentRoute);

  if (prevIsDemoActive !== isDemoActive || prevActiveTrack !== activeTrack) {
    setPrevIsDemoActive(isDemoActive);
    setPrevActiveTrack(activeTrack);
    setPrevStepIndex(currentStepIndex);
    setRect(null);
    setIsPositionReady(false);
    const isDesk = typeof window !== "undefined" ? window.innerWidth >= 768 : false;
    setIsTargetLoading(Boolean(isDemoActive && resolveTourStepTargetSelector(currentStep, isDesk)));
  } else if (prevStepIndex !== currentStepIndex) {
    setPrevStepIndex(currentStepIndex);
    setIsPulsing(motionLevel === "fluid");
    setRect(null);
    setIsPositionReady(false);
    const sel = resolveTourStepTargetSelector(currentStep, !isMobile);
    setIsTargetLoading(Boolean(isDemoActive && sel));
  }

  useEffect(() => {
    if (motionLevel !== "fluid") return;
    const timer = setTimeout(() => setIsPulsing(false), 3000);
    return () => clearTimeout(timer);
  }, [currentStepIndex, motionLevel]);

  useEffect(() => {
    if (!cardRef.current) return;
    if (cardRef.current.offsetHeight > 0) {
      setMeasuredCardHeight(cardRef.current.offsetHeight);
    }
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (height > 0) {
          setMeasuredCardHeight(height);
        } else if (cardRef.current && cardRef.current.offsetHeight > 0) {
          setMeasuredCardHeight(cardRef.current.offsetHeight);
        }
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [cardRef, currentStep?.id]);

  const updateTargetRect = useCallback(() => {
    if (typeof window === "undefined") return;
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    const desktop = !mobile;

    const candidateSelectors = resolveTourStepCandidateSelectors(currentStep, desktop);
    if (candidateSelectors.length === 0) {
      setRect(null);
      setIsPositionReady(true);
      return;
    }

    let element: Element | null = null;
    let activeSelector: string | undefined;

    for (const sel of candidateSelectors) {
      const found = document.querySelector(sel);
      if (found) {
        element = found;
        activeSelector = sel;
        break;
      }
    }

    if (!element) {
      setRect(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const isUsingDesktopTarget = Boolean(
      desktop &&
        currentStep?.targetSelectorDesktop &&
        activeSelector === currentStep.targetSelectorDesktop,
    );

    const isCircular =
      !isUsingDesktopTarget &&
      (currentStep?.spotlightBorderRadius === 9999 ||
        element.classList.contains("rounded-full") ||
        Boolean(currentStep?.targetSelector?.includes("bottom-nav-wizard")) ||
        (element instanceof HTMLElement &&
          (window.getComputedStyle(element).borderRadius === "9999px" ||
            window.getComputedStyle(element).borderRadius === "50%")));

    const customBorderRadius =
      isUsingDesktopTarget && currentStep?.spotlightBorderRadius === 9999
        ? 8
        : currentStep?.spotlightBorderRadius;

    const padding = currentStep?.spotlightPadding ?? (isCircular ? 6 : 10);

    setRect(
      calculateSpotlightGeometry(elementRect, {
        isCircular,
        padding,
        customBorderRadius,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      }),
    );
    setIsPositionReady(true);
  }, [currentStep]);

  useEffect(() => {
    const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 768 : !isMobile;
    const candidateSelectors = resolveTourStepCandidateSelectors(currentStep, isDesktop);
    if (!isDemoActive || candidateSelectors.length === 0) return;

    let scrollSession: ScrollSession | undefined;

    if (previousRouteRef.current !== currentRoute) {
      previousRouteRef.current = currentRoute;
      const container = document.getElementById("main-content");
      if (container && !candidateSelectors.includes('[data-tour="settings-support-card"]')) {
        container.scrollTop = 0;
      }
    }

    const searchSession = startTargetElementSearch({
      candidateSelectors,
      onTargetResolved: (element) => {
        setIsTargetLoading(false);
        scrollSession = performScrollAndMeasureTarget({
          element,
          candidateSelectors,
          motionLevel,
          cardRef,
          updateTargetRect,
        });
      },
      onSearchTimeout: () => {
        setIsTargetLoading(false);
        updateTargetRect();
        setIsPositionReady(true);
      },
    });

    return () => {
      searchSession?.cleanup();
      scrollSession?.cancel();
    };
  }, [cardRef, currentRoute, currentStep, isDemoActive, isMobile, motionLevel, updateTargetRect]);

  useEffect(() => {
    if (!isDemoActive) return;

    const handleResizeOrScroll = () => {
      const currentMobile = window.innerWidth < 768;
      setIsMobile((prev) => (prev !== currentMobile ? currentMobile : prev));
      updateTargetRect();
    };

    const container = document.getElementById("main-content");
    const events = ["resize", "scroll", "animationend", "transitionend"] as const;
    events.forEach((ev) => window.addEventListener(ev, handleResizeOrScroll, { capture: ev !== "resize", passive: true }));
    container?.addEventListener("scroll", handleResizeOrScroll, { passive: true });

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleResizeOrScroll, { capture: ev !== "resize" }));
      container?.removeEventListener("scroll", handleResizeOrScroll);
    };
  }, [isDemoActive, updateTargetRect]);

  const { isAnchorTopMobile, desktopPlacement, desktopCardStyle } = useSpotlightCardPosition({
    rect,
    currentStep,
    measuredCardHeight,
    isPositionReady,
    isTargetLoading,
    motionLevel,
  });

  return {
    rect,
    isMobile,
    isPulsing,
    isTargetLoading,
    isAnchorTopMobile,
    desktopPlacement,
    desktopCardStyle,
  };
}
