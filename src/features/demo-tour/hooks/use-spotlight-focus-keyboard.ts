import { useEffect, type RefObject } from "react";
import { triggerSensory } from "@/services/sensory";

interface UseSpotlightFocusKeyboardOptions {
  isDemoActive: boolean;
  stepId: string | undefined;
  cardRef: RefObject<HTMLDivElement | null>;
  previousActiveElementRef: RefObject<HTMLElement | null>;
  restoreFocus: () => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Gerencia foco inicial, restauração ao encerrar e atalhos de teclado do tour guiado.
 */
export function useSpotlightFocusKeyboard({
  isDemoActive,
  stepId,
  cardRef,
  previousActiveElementRef,
  restoreFocus,
  onClose,
  onNext,
  onPrev,
}: UseSpotlightFocusKeyboardOptions) {
  useEffect(() => {
    if (!isDemoActive) {
      previousActiveElementRef.current = null;
      return;
    }
    if (
      typeof document !== "undefined" &&
      !previousActiveElementRef.current &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    ) {
      previousActiveElementRef.current = document.activeElement;
    }
  }, [isDemoActive, previousActiveElementRef]);

  useEffect(() => {
    if (!isDemoActive || !cardRef.current) return;
    const focusables = cardRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables[0]?.focus();
  }, [cardRef, stepId, isDemoActive]);

  useEffect(() => () => restoreFocus(), [restoreFocus]);

  useEffect(() => {
    if (!isDemoActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        triggerSensory("action");
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerSensory("selection");
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerSensory("selection");
        onPrev();
      } else if (e.key === "Tab" && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else if (
          document.activeElement === last ||
          !cardRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cardRef, isDemoActive, onClose, onNext, onPrev]);
}
