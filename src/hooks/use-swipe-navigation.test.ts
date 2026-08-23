import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_IGNORE_SELECTORS, useSwipeNavigation } from "./use-swipe-navigation";

/** Evento de pointer falso com alvo configurável. */
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
    isPrimary: true,
    button: 0,
    currentTarget: el,
    target: el,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    stopPropagation: vi.fn(),
    ...extra,
  } as ReactPointerEvent<HTMLElement>;
}

describe("useSwipeNavigation (F20 — engine de gestos)", () => {
  // Relógio manual (performance.now) + viewport mobile de 390px — jsdom
  // reporta 1024 (threshold 154px) e performance real tornaria o flick
  // imprevisível; aqui tudo é determinístico.
  const clock = { now: 0 };

  beforeEach(() => {
    clock.now = 0;
    vi.stubGlobal("performance", { now: () => clock.now });
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  });

  it("navega para 'next' com swipe para a esquerda além do threshold", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    clock.now = 200; // 200ms decorridos
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 220, 205)));
    clock.now = 500;
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 220, 205)));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("next");
  });

  it("toque iniciado na borda esquerda NÃO navega (edge swipe do sistema)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    // innerWidth=390, inset default 12 → x=10 está na zona extrema do SO.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 10, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 190, 205)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 190, 205)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("toque iniciado na borda direita NÃO navega (edge swipe do sistema)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    // x=385 >= 390-12 → zona direita do SO.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 385, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 205)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 205)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("edgeInsetPx=0 desativa a zona de borda (gesto no limite navega)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate, edgeInsetPx: 0 }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 5, 200)));
    clock.now = 200;
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 120, 205)));
    clock.now = 500;
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 120, 205)));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    // Arrastou para a direita (x 5 → 120) → volta o mês/aba (previous).
    expect(onNavigate).toHaveBeenCalledWith("previous");
  });

  it("rolagem vertical dominante NÃO arma o swipe (libera scroll nativo)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    // dx=5, dy=30 → dy >= 10 e dy > dx → descarte, sem travar scroll.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 100)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 105, 130)));
    expect(result.current.dragging).toBe(false);
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 105, 130)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("dominância horizontal arma o rastreio e drift vertical posterior impede navegação", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    // Move 1: dx=50, dy=5 → dominância OK (arma o rastreio com drag elástico).
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 150, 205)));
    expect(result.current.dragging).toBe(true);

    // Move 2: o usuário desliza verticalmente antes de soltar (dx=50, dy=120 → cone falha).
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 150, 320)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 150, 320)));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(result.current.offsetPx).toBe(0);
  });

  it("navega para 'previous' com swipe para a direita", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 200)));
    clock.now = 200;
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 180, 205)));
    clock.now = 500;
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 180, 205)));

    expect(onNavigate).toHaveBeenCalledWith("previous");
  });

  it("rolagem vertical NÃO navega (axis-lock + Thumb Drift)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 100)));
    // dx pequeno, dy grande → dominância vertical.
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 110, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 110, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("mouse é ignorado (desktop usa botões/teclado)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200, { pointerType: "mouse" })));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("swipe iniciado em .swipeable-item NÃO navega", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");
    el.className = "swipeable-item";

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("swipe iniciado em input (formulário) NÃO navega", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("input");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("swipe iniciado em [data-swipe-nav-ignore] (gráfico com scrub) NÃO navega", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");
    el.setAttribute("data-swipe-nav-ignore", "");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("borda: swipe além do limite NÃO navega e dispara onBoundary (spring-back)", () => {
    const onNavigate = vi.fn();
    const onBoundary = vi.fn();
    const { result } = renderHook(() =>
      useSwipeNavigation({ onNavigate, canGoPrevious: false, canGoNext: true, onBoundary }),
    );
    const el = document.createElement("div");

    // canGoPrevious=false → arrastar para a direita está na borda inferior.
    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 100, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 205)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 205)));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(onBoundary).toHaveBeenCalledTimes(1);
    // Spring-back: offset volta a 0 após o settle.
    expect(result.current.offsetPx).toBe(0);
  });

  it("canGoNext=false bloqueia swipe para a esquerda na borda superior", () => {
    const onNavigate = vi.fn();
    const onBoundary = vi.fn();
    const { result } = renderHook(() =>
      useSwipeNavigation({ onNavigate, canGoPrevious: true, canGoNext: false, onBoundary }),
    );
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 205)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 205)));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(onBoundary).toHaveBeenCalledTimes(1);
  });

  it("gesto curto e lento NÃO navega (ajuste fino)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    clock.now = 200;
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 290, 200)));
    clock.now = 700; // 10px em 500ms = 0.02 px/ms → lento demais p/ flick
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 290, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("ignora pointer secundário (multi-touch isPrimary=false)", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() =>
      result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200, { isPrimary: false })),
    );
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerUp(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("pointer cancel descarta o gesto sem navegar", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSwipeNavigation({ onNavigate }));
    const el = document.createElement("div");

    act(() => result.current.pointerHandlers.onPointerDown(fakePointer(el, 300, 200)));
    act(() => result.current.pointerHandlers.onPointerMove(fakePointer(el, 200, 200)));
    act(() => result.current.pointerHandlers.onPointerCancel(fakePointer(el, 200, 200)));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(result.current.offsetPx).toBe(0);
  });

  it("ignoreSelectors padrão cobre os seletores de isolamento documentados", () => {
    expect(DEFAULT_IGNORE_SELECTORS).toEqual(
      expect.arrayContaining([
        "input",
        "textarea",
        "select",
        '[role="dialog"]',
        "[data-swipe-nav-ignore]",
        ".no-swipe-nav",
        ".swipeable-item",
        "[data-swipe-action]",
      ]),
    );
  });
});
