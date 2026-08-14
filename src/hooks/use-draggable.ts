import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface DraggablePosition {
  /** Distância da borda esquerda (px). */
  x: number;
  /** Distância do topo (px). */
  y: number;
}

export interface UseDraggableOptions {
  /** Largura/altura do elemento arrastável (px) — usada no clamp e snap. */
  size?: number;
  /** Margem das bordas (px). */
  margin?: number;
  /** Folga inferior (px) — ex.: altura da BottomNav + safe-area. */
  bottomInset?: number;
  /** Disparado quando o arrasto começa (movimento > limiar). */
  onDragStart?: () => void;
  /** Disparado ao soltar com movimento (posição final). */
  onDragEnd?: (position: DraggablePosition) => void;
}

export interface UseDraggableReturn {
  position: DraggablePosition;
  /** Arrasto em andamento. */
  dragging: boolean;
  pointerHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
}

const MOVE_THRESHOLD = 4;

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Arrasto de elementos flutuantes (F9 — Decisão B): pointer events nativos
 * com `setPointerCapture` (mouse/touch), clamp no viewport e snap horizontal
 * à borda mais próxima. Zero dependências externas.
 */
export function useDraggable({
  size = 56,
  margin = 8,
  bottomInset = 0,
  onDragStart,
  onDragEnd,
}: UseDraggableOptions = {}): UseDraggableReturn {
  const [position, setPosition] = useState<DraggablePosition>(() => {
    const { width, height } = viewportSize();
    return {
      x: Math.max(margin, width - size - margin),
      y: Math.max(margin, height - size - margin - bottomInset),
    };
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  const clamp = useCallback(
    (next: DraggablePosition): DraggablePosition => {
      const { width, height } = viewportSize();
      return {
        x: Math.min(Math.max(margin, next.x), width - size - margin),
        y: Math.min(Math.max(margin, next.y), height - size - margin - bottomInset),
      };
    },
    [size, margin, bottomInset],
  );

  const snapX = useCallback(
    (x: number): number => {
      const { width } = viewportSize();
      // Borda mais próxima (considera o centro do elemento).
      return x + size / 2 < width / 2 ? margin : width - size - margin;
    },
    [size, margin],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        baseX: position.x,
        baseY: position.y,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < MOVE_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
      onDragStart?.();
    }
    setPosition(clamp({ x: drag.baseX + dx, y: drag.baseY + dy }));
  }, [clamp, onDragStart]);

  const finish = useCallback(
    (moved: boolean) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (!drag) return;
      if (moved) {
        setPosition((current) => {
          const snapped = { x: snapX(current.x), y: current.y };
          onDragEnd?.(snapped);
          return snapped;
        });
      }
    },
    [onDragEnd, snapX],
  );

  const onPointerUp = useCallback(() => {
    const moved = dragRef.current?.moved ?? false;
    finish(moved);
  }, [finish]);

  const onPointerCancel = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  return {
    position,
    dragging,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
