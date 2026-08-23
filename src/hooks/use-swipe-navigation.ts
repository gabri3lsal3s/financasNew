import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AXIS_DOMINANCE_RATIO,
  boundaryResistance,
  directionOf,
  EDGE_INSET_PX,
  isEdgeZoneTouch,
  isHorizontalDominant,
  LOCK_DISTANCE_PX,
  resolveSwipeIntent,
  type SwipeDirection,
} from "@/domain/gestures";
import { triggerHaptic } from "@/services/haptics";

/**
 * Engine unificada de navegação por gesto horizontal (F20).
 *
 * Máquina de estado `idle → tracking → locked → settled` com Pointer Events
 * nativos (zero dependências):
 *   • `tracking` — guarda o ponto de partida e espera o arming (dominância
 *     horizontal `|dx| > 1.5·|dy|` + distância de lock);
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
 *   • **edge inset** (zona de segurança): toques iniciados a menos de
 *     `edgeInsetPx` (default 24) das bordas físicas são ignorados — o edge
 *     swipe de voltar do Android/iOS segue reservado ao sistema;
 *   • axis-lock: armar exige dominância horizontal clara (`|dx| > 1.5·|dy|`)
 *     logo no início + cone ±30° na decisão final — scroll nativo nunca é
 *     bloqueado (`touch-action: pan-y` no contêiner);
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
  /**
   * Zona de exclusão das bordas físicas (px, default 24): toques iniciados a
   * menos desta distância das bordas são ignorados (edge swipe do sistema).
   * `0` desativa a zona.
   */
  edgeInsetPx?: number;
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
  "table",
  ".overflow-x-auto",
  "[data-horizontal-scroll]",
] as const;

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
  edgeInsetPx = EDGE_INSET_PX,
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
    onDragProgress?.(0);
    gestureRef.current = null;
  }, [onDragProgress]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Mouse desabilitado — desktop usa botões/teclado (MonthPicker/Tabs).
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      if (event.isPrimary === false) return;
      if (startsOnIgnored(event.target, ignoreSelectors)) return;

      // Edge inset (zona de segurança): toque iniciado na borda física extrema
      // fica com o gesto nativo de voltar do sistema.
      if (isEdgeZoneTouch(event.clientX, window.innerWidth, edgeInsetPx)) return;

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
    [edgeInsetPx, ignoreSelectors],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Antes do lock: avalia a intenção sem descarte prematuro por micro-oscilações.
      if (!gesture.locked) {
        // Se a rolagem vertical for dominante e já tiver distância perceptível, libera o scroll nativo.
        if (absDy >= LOCK_DISTANCE_PX && absDy > absDx) {
          gestureRef.current = null;
          return;
        }

        // Aguarda atingir a distância mínima para travar o gesto.
        if (absDx < LOCK_DISTANCE_PX) return;

        // Ao atingir LOCK_DISTANCE_PX no eixo X, verifica dominância horizontal.
        if (!isHorizontalDominant(dx, dy, AXIS_DOMINANCE_RATIO)) {
          gestureRef.current = null;
          return;
        }

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

      if (gesture.locked) {
        event.stopPropagation?.();
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

      if (gesture.locked) {
        event.stopPropagation?.();
      }

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
