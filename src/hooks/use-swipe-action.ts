import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { triggerHaptic } from "@/services/haptics";

/** Largura da área de ações revelada (px). */
export const SWIPE_ACTION_WIDTH = 96;
/** Deslocamento mínimo (px) para abrir/fechar no final do gesto. */
const OPEN_THRESHOLD = SWIPE_ACTION_WIDTH / 2;
/** Limiar em px para considerar que o usuário iniciou um arrasto horizontal. */
const DRAG_THRESHOLD = 6;

export interface UseSwipeActionOptions {
  /** Disparado ao revelar as ações (ex.: haptic "light"). */
  onOpen?: () => void;
  /** Disparado ao recolher as ações. */
  onClose?: () => void;
}

export interface UseSwipeActionReturn {
  /** Ações reveladas? */
  open: boolean;
  /** Arrasto em andamento (desativa a transição durante o gesto). */
  dragging: boolean;
  /** Deslocamento atual em px (≤ 0; negativo puxa para a esquerda). */
  offset: number;
  /** Recolhe as ações (ex.: ao clicar numa ação). */
  close: () => void;
  /** Handlers de pointer para espalhar no contêiner da linha. */
  pointerHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
}

/**
 * Swipe-to-Action mobile (F8 — Decisão 2): deslizar a linha para a esquerda
 * revela ações rápidas. Vanilla Pointer Events (`pointerdown/move/up`) —
 * zero dependências; gestos verticais são ignorados (scroll nativo preservado).
 * O ponteiro só é capturado quando o arrasto horizontal realmente se inicia,
 * garantindo que cliques normais cheguem aos botões e modais filhos.
 */
export function useSwipeAction({ onOpen, onClose }: UseSwipeActionOptions = {}): UseSwipeActionReturn {
  const [open, setOpenState] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    base: number;
    isDragging: boolean;
  } | null>(null);

  const settle = useCallback(
    (next: boolean) => {
      setDragging(false);
      setOpenState(next);
      setOffset(next ? -SWIPE_ACTION_WIDTH : 0);
      if (next) {
        triggerHaptic("light");
        onOpen?.();
      } else {
        onClose?.();
      }
    },
    [onOpen, onClose],
  );

  const close = useCallback(() => {
    if (open) settle(false);
  }, [open, settle]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        base: open ? -SWIPE_ACTION_WIDTH : 0,
        isDragging: false,
      };
    },
    [open],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    // Gesto predominantemente vertical → deixa o scroll nativo seguir.
    if (!drag.isDragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      dragRef.current = null;
      return;
    }

    // Inicia o arrasto quando ultrapassa o limiar horizontal
    if (!drag.isDragging && Math.abs(dx) > DRAG_THRESHOLD) {
      drag.isDragging = true;
      try {
        if (typeof event.currentTarget.setPointerCapture === "function") {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      } catch {
        // Ignora ambiente onde setPointerCapture não existe
      }
      setDragging(true);
    }

    if (drag.isDragging) {
      // Só deslize para a esquerda abre; para a direita apenas recolhe (clamp em 0).
      setOffset(Math.min(0, drag.base + dx));
    }
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;

      if (!drag) {
        setDragging(false);
        return;
      }

      if (drag.isDragging) {
        try {
          if (typeof event.currentTarget.releasePointerCapture === "function") {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignora
        }
        const dx = event.clientX - drag.startX;
        const currentOffset = Math.min(0, drag.base + dx);
        if (currentOffset < -OPEN_THRESHOLD) {
          settle(true);
        } else {
          settle(false);
        }
      } else {
        setDragging(false);
      }
    },
    [settle],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (drag?.isDragging) {
        try {
          if (typeof event.currentTarget.releasePointerCapture === "function") {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignora
        }
      }
      dragRef.current = null;
      settle(open);
    },
    [open, settle],
  );

  return {
    open,
    dragging,
    offset,
    close,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
