import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDraggable } from "./use-draggable";

const WIDTH = 1024;
const HEIGHT = 768;

function fakePointer(el: HTMLElement, x: number, y: number): ReactPointerEvent<HTMLElement> {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "touch",
    button: 0,
    currentTarget: el,
    setPointerCapture: () => {},
  } as unknown as ReactPointerEvent<HTMLElement>;
}

describe("useDraggable (F9 — Decisão B)", () => {
  it("posição inicial no canto inferior direito (sem folga inferior)", () => {
    const { result } = renderHook(() => useDraggable({ size: 56, margin: 8 }));
    expect(result.current.position).toEqual({ x: WIDTH - 56 - 8, y: HEIGHT - 56 - 8 });
  });

  it("arrasta com pointer events e aplica clamp no viewport", () => {
    const { result } = renderHook(() => useDraggable({ size: 56, margin: 8 }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 500, 500)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 300, 200)));

    // dx = -200, dy = -300 → x = 760 → snap à borda mais próxima (direita): 960;
    // y = 704 − 300 = 404 (sem snap vertical, apenas clamp).
    expect(result.current.position.x).toBe(960);
    expect(result.current.position.y).toBe(404);
  });

  it("snap horizontal à borda mais próxima ao soltar", () => {
    const { result } = renderHook(() => useDraggable({ size: 56, margin: 8 }));
    const el = document.createElement("div");

    // Arrasta para perto da borda esquerda (x < centro).
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 900, 700)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 300, 700)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 300, 700)));

    expect(result.current.position.x).toBe(8);
  });

  it("chama onDragStart/onDragEnd apenas com movimento", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const { result } = renderHook(() => useDraggable({ size: 56, margin: 8, onDragStart, onDragEnd }));
    const el = document.createElement("div");

    // Tap sem movimento: nenhum callback.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 500, 500)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 500, 500)));
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();

    // Arrasto real.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 500, 500)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 400, 500)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 400, 500)));
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it("respeita a folga inferior (acima da BottomNav)", () => {
    const { result } = renderHook(() => useDraggable({ size: 56, margin: 8, bottomInset: 72 }));
    expect(result.current.position.y).toBe(HEIGHT - 56 - 8 - 72);
  });
});
