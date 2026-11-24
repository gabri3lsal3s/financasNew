import { useCallback, useEffect, useRef } from "react";

/** Duração padrão (ms) da saída do Bottom Sheet / Modal antes de montar o próximo modal. */
export const MODAL_EXIT_DURATION_MS = 210;

/**
 * Indica se as animações estão reduzidas (SO ou preferência do usuário no app),
 * dispensando espera entre fechamento e abertura sequencial de modais.
 */
export function shouldSkipModalTransitionDelay(): boolean {
  if (typeof window === "undefined") return true;
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return true;
  }
  if (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-motion") === "reduced"
  ) {
    return true;
  }
  return false;
}

export interface UseModalTransitionResult {
  scheduleAfterClose: (closeCurrent: () => void, openNext: () => void) => void;
  cancelTransition: () => void;
}

/**
 * Sequencia transições Modal → Modal sem colisão de dois Radix Dialogs simultâneos
 * competindo por foco, scroll-lock e camada z-modal.
 */
export function useModalTransition(
  exitDurationMs: number = MODAL_EXIT_DURATION_MS,
): UseModalTransitionResult {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTransition = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => cancelTransition, [cancelTransition]);

  const scheduleAfterClose = useCallback(
    (closeCurrent: () => void, openNext: () => void) => {
      cancelTransition();
      closeCurrent();

      if (shouldSkipModalTransitionDelay()) {
        openNext();
        return;
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        openNext();
      }, exitDurationMs);
    },
    [cancelTransition, exitDurationMs],
  );

  return { scheduleAfterClose, cancelTransition };
}
