import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { SWIPE_ACTION_WIDTH, useSwipeAction } from "./use-swipe-action";

/** Evento de pointer falso (os handlers esperam um React PointerEvent). */
function fakePointer(
  el: HTMLElement,
  x: number,
  y: number,
  extra: Partial<ReactPointerEvent<HTMLElement>> = {},
): ReactPointerEvent<HTMLElement> {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "touch",
    button: 0,
    currentTarget: el,
    setPointerCapture: () => {},
    ...extra,
  } as ReactPointerEvent<HTMLElement>;
}

describe("useSwipeAction (F8 — Decisão 2)", () => {
  it("abre as ações ao deslizar para a esquerda além do limiar", () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onOpen }));
    const el = document.createElement("div");

    // Cada evento em um act próprio: os handlers são recriados a cada render
    // (fecham sobre o offset mais recente), como acontece no DOM real.
    act(() => {
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 200, 100));
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(fakePointer(el, 80, 105));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(fakePointer(el, 80, 105));
    });

    expect(result.current.open).toBe(true);
    expect(result.current.offset).toBe(-SWIPE_ACTION_WIDTH);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("recolhe ao deslizar para a direita quando aberto", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onClose }));
    const el = document.createElement("div");

    act(() => {
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 200, 100));
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(fakePointer(el, 80, 105));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(fakePointer(el, 80, 105));
    });
    expect(result.current.open).toBe(true);

    // Base -96 + dx 60 → -36 → acima do limiar → recolhe.
    act(() => {
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 100));
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(fakePointer(el, 160, 105));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(fakePointer(el, 160, 105));
    });

    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
    expect(onClose).toHaveBeenCalled();
  });

  it("ignora gesto predominantemente vertical (scroll nativo)", () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onOpen }));
    const el = document.createElement("div");

    act(() => {
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 100));
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(fakePointer(el, 105, 140));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(fakePointer(el, 105, 140));
    });

    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("close() recolhe as ações programaticamente", () => {
    const { result } = renderHook(() => useSwipeAction());
    const el = document.createElement("div");

    act(() => {
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 200, 100));
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(fakePointer(el, 80, 105));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(fakePointer(el, 80, 105));
    });
    expect(result.current.open).toBe(true);

    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
  });
});
