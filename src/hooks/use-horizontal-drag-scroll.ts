import { useCallback, useEffect, useRef } from "react";

/**
 * Hook utilitário para barras horizontais de abas, badges e pílulas:
 * 1. Centraliza suavemente o item ativo ([data-state="active"], [aria-selected="true"], [aria-pressed="true"])
 *    dentro do contêiner rolável sempre que `activeValue` muda (sem deslocar a página verticalmente).
 * 2. Habilita arrasto horizontal com mouse (drag-to-scroll) em telas pequenas / modo responsivo,
 *    preservando o scroll nativo por toque (momentum touch scroll) em smartphones e tablets.
 */
export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>(
  activeValue?: string,
) {
  const containerRef = useRef<T | null>(null);
  const dragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
  });

  // Centraliza o item ativo na trilha horizontal quando há overflow
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;

    const activeEl = container.querySelector<HTMLElement>(
      '[data-state="active"], [aria-selected="true"], [aria-pressed="true"], [aria-current="page"]',
    );
    if (!activeEl) return;

    const targetLeft =
      activeEl.offsetLeft - container.clientWidth / 2 + activeEl.offsetWidth / 2;
    const clampedLeft = Math.max(
      0,
      Math.min(targetLeft, container.scrollWidth - container.clientWidth),
    );

    if (typeof container.scrollTo === "function") {
      container.scrollTo({ left: clampedLeft, behavior: "smooth" });
    } else {
      container.scrollLeft = clampedLeft;
    }
  }, [activeValue]);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    // Em dispositivos touch, o navegador já realiza o pan horizontal nativo com inércia
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;

    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: container.scrollLeft,
      hasMoved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const state = dragStateRef.current;
    if (!state.isDown) return;
    const container = containerRef.current;
    if (!container) return;

    const deltaX = e.clientX - state.startX;
    if (Math.abs(deltaX) > 4) {
      state.hasMoved = true;
    }
    if (state.hasMoved) {
      container.scrollLeft = state.scrollLeft - deltaX;
    }
  }, []);

  const endDrag = useCallback(() => {
    dragStateRef.current.isDown = false;
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (dragStateRef.current.hasMoved) {
      e.stopPropagation();
      e.preventDefault();
      dragStateRef.current.hasMoved = false;
    }
  }, []);

  return {
    containerRef,
    dragScrollProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
  };
}
