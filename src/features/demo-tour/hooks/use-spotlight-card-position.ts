import { useMemo } from "react";
import type { CSSProperties } from "react";
import {
  calculateDesktopCardPosition,
  getDesktopSidebarWidth,
  resolveTourStepTargetSelector,
  type TourStep,
} from "@/domain/demo-simulation";
import type { MotionLevel } from "@/hooks/use-visual-customization";
import type { SpotlightRect } from "./use-spotlight-target-rect";

export interface UseSpotlightCardPositionOptions {
  rect: SpotlightRect | null;
  currentStep: TourStep | undefined;
  measuredCardHeight: number;
  isPositionReady: boolean;
  isTargetLoading: boolean;
  motionLevel: MotionLevel;
}

export function useSpotlightCardPosition({
  rect,
  currentStep,
  measuredCardHeight,
  isPositionReady,
  isTargetLoading,
  motionLevel,
}: UseSpotlightCardPositionOptions) {
  const isAnchorTopMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    let targetY: number | null = null;
    let targetH: number | null = null;

    if (rect) {
      targetY = rect.y;
      targetH = rect.height;
    } else {
      const targetSel = resolveTourStepTargetSelector(currentStep, false);
      const element = targetSel ? document.querySelector(targetSel) : null;
      if (element) {
        const elRect = element.getBoundingClientRect();
        targetY = elRect.top;
        targetH = elRect.height;
      }
    }

    if (targetY !== null && targetH !== null) {
      const vh = window.innerHeight;
      const spaceAbove = targetY;
      const spaceBelow = vh - (targetY + targetH);
      if (targetY < vh * 0.35) {
        return spaceBelow < 120 && spaceAbove >= 180;
      }
      return targetY + targetH / 2 > vh * 0.45;
    }
    return currentStep?.preferredPlacement === "top";
  }, [currentStep, rect]);

  const desktopPlacement = useMemo<"top" | "bottom">(() => {
    if (!rect || typeof window === "undefined") {
      return currentStep?.preferredPlacement === "top" ? "top" : "bottom";
    }
    const spaceBelow = window.innerHeight - (rect.y + rect.height);
    const spaceAbove = rect.y;
    if (currentStep?.preferredPlacement === "top") {
      return spaceAbove >= measuredCardHeight + 20
        ? "top"
        : spaceBelow >= spaceAbove
          ? "bottom"
          : "top";
    }
    return spaceBelow < measuredCardHeight + 20 && spaceAbove > spaceBelow ? "top" : "bottom";
  }, [currentStep, measuredCardHeight, rect]);

  const desktopCardStyle = useMemo<CSSProperties>(() => {
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    const position = calculateDesktopCardPosition({
      rect,
      cardHeight: measuredCardHeight,
      windowWidth: winW,
      windowHeight: winH,
      sidebarWidth: getDesktopSidebarWidth(),
      placement: desktopPlacement,
      preferredWidth: 420,
      gap: 12,
      safetyMargin: 16,
    });

    return {
      top: 0,
      left: 0,
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      width: `${position.width}px`,
      opacity: !rect ? (isPositionReady || isTargetLoading ? 1 : 0) : isPositionReady ? 1 : 0,
      transition:
        motionLevel === "reduced"
          ? "none"
          : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
    };
  }, [desktopPlacement, isPositionReady, isTargetLoading, measuredCardHeight, motionLevel, rect]);

  return {
    isAnchorTopMobile,
    desktopPlacement,
    desktopCardStyle,
  };
}
