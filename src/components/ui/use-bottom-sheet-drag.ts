import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";

/** Distância (px) de arrasto que dispara o fechamento do bottom sheet. */
const CLOSE_DRAG_THRESHOLD = 96;
/** Velocidade (px/ms) que caracteriza um "arremesso" para fechar. */
const CLOSE_FLING_VELOCITY = 0.5;
/** Ponto onde a resistência elástica começa (px arrastados). */
const RESIST_START = 100;
const RESIST_FACTOR = 0.35;

/** Elementos interativos nunca iniciam o drag-to-close (botões, campos etc.). */
const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [role='slider'], [data-drag-ignore]";

interface DragState {
  startY: number;
  lastY: number;
  lastTime: number;
  dy: number;
}

function shouldSuppressRubberBand(): boolean {
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const visual = getVisualCustomization();
  return prefersReduced || visual.motionLevel !== "fluid";
}

export interface UseBottomSheetDragOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

/**
 * Física de drag-to-close para o Bottom Sheet mobile do `<Modal />`.
 * Respeita `prefers-reduced-motion` e `getVisualCustomization().motionLevel !== "fluid"`
 * desativando o rubber-band visual sem impedir o fechamento por arrasto acessível.
 */
export function useBottomSheetDrag({ scrollRef, onClose }: UseBottomSheetDragOptions) {
  const dragRef = useRef<DragState | null>(null);
  const [dragY, setDragY] = useState(0);

  const resetDrag = () => {
    dragRef.current = null;
    setDragY(0);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const el = scrollRef.current;
    if (el && el.scrollTop > 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;

    dragRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      dy: 0,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = Math.max(0, event.clientY - drag.startY);
    const now = performance.now();
    drag.lastTime = now;
    drag.lastY = event.clientY;
    drag.dy = dy;

    if (shouldSuppressRubberBand()) {
      return;
    }

    const applied = dy < RESIST_START ? dy : RESIST_START + (dy - RESIST_START) * RESIST_FACTOR;
    setDragY(applied);
    event.preventDefault();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    const velocity = Math.abs(event.clientY - drag.lastY) / dt;
    const shouldClose = drag.dy >= CLOSE_DRAG_THRESHOLD || velocity > CLOSE_FLING_VELOCITY;
    setDragY(0);
    if (shouldClose) {
      triggerSensory("action");
      onClose();
    }
  };

  const onPointerCancel = () => {
    resetDrag();
  };

  return {
    dragY,
    resetDrag,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
