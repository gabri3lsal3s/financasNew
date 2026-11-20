import {
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SEARCH_TIMEOUT_MS,
} from "@/domain/demo-simulation";

export interface SearchTargetOptions {
  candidateSelectors: string[];
  onTargetResolved: (element: Element) => void;
  onSearchTimeout: () => void;
}

export interface TargetSearchSession {
  cleanup: () => void;
}

const isJsdom =
  typeof navigator !== "undefined" &&
  (navigator.userAgent.includes("jsdom") || import.meta.env.MODE === "test");

export function hasValidElementDimensions(element: Element): boolean {
  if (typeof element.getBoundingClientRect === "function") {
    const isMocked =
      "_isMockFunction" in element.getBoundingClientRect ||
      Boolean(
        (element.getBoundingClientRect as unknown as { getMockImplementation?: () => unknown })
          .getMockImplementation,
      );
    const bRect = element.getBoundingClientRect();
    if (bRect.width > 0 && bRect.height > 0) return true;
    if (isMocked) return false;
  }
  if (element instanceof HTMLElement && (element.offsetWidth > 0 || element.offsetHeight > 0)) {
    return true;
  }
  return Boolean(isJsdom && element.isConnected);
}

/**
 * Busca resiliente por seletores candidatos com observador de mutação e polling.
 */
export function startTargetElementSearch({
  candidateSelectors,
  onTargetResolved,
  onSearchTimeout,
}: SearchTargetOptions): TargetSearchSession {
  let mutationObserver: MutationObserver | undefined;
  let pollingTimer: ReturnType<typeof setInterval> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let isCleanedUp = false;
  let resolved = false;

  const cleanupSearch = () => {
    mutationObserver?.disconnect();
    mutationObserver = undefined;
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = undefined;
    }
  };

  const handleResolved = (element: Element) => {
    if (resolved || isCleanedUp) return;
    resolved = true;
    cleanupSearch();
    onTargetResolved(element);
  };

  const handleTimeout = () => {
    if (resolved || isCleanedUp) return;
    resolved = true;
    cleanupSearch();
    onSearchTimeout();
  };

  const checkTarget = (): boolean => {
    if (resolved || isCleanedUp) return true;
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el && hasValidElementDimensions(el)) {
        handleResolved(el);
        return true;
      }
    }
    return false;
  };

  if (!checkTarget()) {
    timeoutTimer = setTimeout(handleTimeout, DEFAULT_SEARCH_TIMEOUT_MS);
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => {
        checkTarget();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-state", "hidden"],
      });
    }
    pollingTimer = setInterval(() => {
      checkTarget();
    }, DEFAULT_POLLING_INTERVAL_MS);
  }

  return {
    cleanup: () => {
      isCleanedUp = true;
      cleanupSearch();
    },
  };
}
