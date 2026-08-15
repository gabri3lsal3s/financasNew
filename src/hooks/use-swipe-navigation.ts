import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  boundaryResistance,
  directionOf,
  isHorizontalLock,
  LOCK_DISTANCE_PX,
  resolveSwipeIntent,
  type SwipeDirection,
} from "@/domain/gestures/swipe";
import { triggerHaptic } from "@/services/haptics";

/**
 * Engine unificada de navegação por gesto horizontal (F20).
 *
 * Máquina de estado `idle → tracking → locked → settled` com Pointer Events
 * nativos (zero dependências):
 *   • `tracking` — guarda o ponto de partida e espera o axis-lock (±30°);
 *   • `locked`   — o gesto é DONO do pointer (`setPointerCapture`): drift no
 *     meio do swipe não cancela; offset elástico via `onDragProgress`;
 *   • `settled`  — resolve a intenção (flick/threshold) e volta ao idle.
 *
 * Isolamento estrito (zero falsos positivos):
 *   • `ignoreSelectors` — gestos iniciados em inputs, diálogos, linhas com
 *     Swipe-to-Action (`.swipeable-item`/`[data-swipe-action]`), gráficos com
 *     scrub (`[data-swipe-nav-ignore]`) e contêineres `.no-swipe-nav` são
 *     ignorados — o engine é desacoplado do `useSwipeAction` (sem alterá-lo);
 *   • `pointerType` só `touch`/`pen` + `event.isPrimary` (mouse desabilitado
 *     — desktop usa botões/teclado);
 *   • axis-lock ±30° com descarte imediato em dominância vertical — o scroll
 *     nativo nunca é bloqueado (`touch-action: pan-y` no contêiner);
 *   • borda (início/fim dos dados): resistência elástica (rubber-banding) +
 *     haptic `warning` — o conteúdo cede mas NÃO navega.
 */
export interface UseSwipeNavigationOptions {
  /** Disparado ao confirmar a navegação (1x por gesto). */
  onNavigate: (direction: SwipeDirection) => void;
  /** Pode navegar para o período/aba anterior? (borda inferior do mês). */
  canGoPrevious?: boolean;
  /** Pode navegar para o próximo período/aba? (default true). */
  canGoNext?: boolean;
  /** Progresso do arrasto (offset elástico em px) — feedback visual. */
  onDragProgress?: (offsetPx: number) => void;
  /** Disparado ao tentar navegar além da borda (overscroll elástico). */
  onBoundary?: () => void;
  /** Seletores de nós cujo toque inicia NUNCA vira navegação. */
  ignoreSelectors?: readonly string[];
}

export interface UseSwipeNavigationReturn {
  /** Deslocamento atual do arrasto (px) — para o transform elástico. */
  offsetPx: number;
  /** Arrasto em andamento (desliga a transição durante o gesto). */
  dragging: boolean;
  /** Handlers de pointer para espalhar no contêiner com `touch-action: pan-y`. */
  pointerHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
}

/** Isolamento padrão — áreas interativas que nunca disparam navegação. */
export const DEFAULT_IGNORE_SELECTORS = [
  "input",
  "textarea",
  "select",
  '[role="dialog"]',
  "[data-swipe-nav-ignore]",
  ".no-swipe-nav",
  ".swipeable-item",
  "[data-swipe-action]",
] as const;

const MIN_DISTANCE_FOR_LOCK = 4;

/** O toque começou em um nó a ser ignorado? (sobe até o contêiner). */
function startsOnIgnored(target: EventTarget | null, selectors: readonly string[]): boolean {
  if (!(target instanceof Element)) return false;
  return selectors.some((selector) => target.closest(selector) !== null);
}

export function useSwipeNavigation({
  onNavigate,
  canGoPrevious = true,
  canGoNext = true,
  onDragProgress,
  onBoundary,
  ignoreSelectors = DEFAULT_IGNORE_SELECTORS,
}: UseSwipeNavigationOptions): UseSwipeNavigationReturn {
  const [offsetPx, setOffsetPx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    lastX: number;
    locked: boolean;
    boundarySide: SwipeDirection | null;
  } | null>(null);

  /** Offset com resistência de borda (rubber-banding) na direção bloqueada. */
  const resistBoundary = useCallback(
    (dx: number): number => {
      const direction = directionOf(dx);
      if (direction === "previous" && !canGoPrevious) return boundaryResistance(dx, 0);
      if (direction === "next" && !canGoNext) return boundaryResistance(dx, 0);
      return dx;
    },
    [canGoPrevious, canGoNext],
  );

  const settle = useCallback(() => {
    setOffsetPx(0);
    setDragging(false);
    gestureRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Mouse desabilitado — desktop usa botões/teclado (MonthPicker/Tabs).
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      if (event.isPrimary === false) return;
      if (startsOnIgnored(event.target, ignoreSelectors)) return;

      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        lastX: event.clientX,
        locked: false,
        boundarySide: null,
      };
    },
    [ignoreSelectors],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;

      // Antes do lock: só inicia quando há movimento real e o axis-lock passa.
      if (!gesture.locked) {
        if (Math.abs(dx) < MIN_DISTANCE_FOR_LOCK && Math.abs(dy) < MIN_DISTANCE_FOR_LOCK) return;
        // Dominância vertical → descarta (scroll nativo preservado).
        if (!isHorizontalLock(dx, dy)) {
          gestureRef.current = null;
          return;
        }
        if (Math.abs(dx) < LOCK_DISTANCE_PX) return;

        gesture.locked = true;
        gesture.boundarySide = null;
        setDragging(true);
        triggerHaptic("light");
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ambiente sem suporte a capture — o gesto segue sem ele.
        }
      }

      gesture.lastX = event.clientX;
      const resisted = resistBoundary(dx);
      setOffsetPx(resisted);
      onDragProgress?.(resisted);
    },
    [onDragProgress, resistBoundary],
  );

  const finishGesture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // Ignora
      }

      if (gesture.locked) {
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        const elapsedMs = performance.now() - gesture.startTime;
        const intent = resolveSwipeIntent({
          dx,
          dy,
          elapsedMs,
          viewportWidthPx: typeof window !== "undefined" ? window.innerWidth : 390,
        });

        if (intent === "previous" && canGoPrevious) {
          onNavigate("previous");
        } else if (intent === "next" && canGoNext) {
          onNavigate("next");
        } else if (intent !== null) {
          // Tentou navegar além da borda → overscroll elástico sem navegação.
          triggerHaptic("warning");
          onBoundary?.();
        }
      }

      settle();
    },
    [canGoNext, canGoPrevious, onBoundary, onNavigate, settle],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => finishGesture(event),
    [finishGesture],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      if (gesture && event.pointerId === gesture.pointerId) {
        try {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        } catch {
          // Ignora
        }
      }
      settle();
    },
    [settle],
  );

  return {
    offsetPx,
    dragging,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
