import { act, fireEvent, render, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePullUpToTop } from "./use-pull-up-to-top";

/** Harness real: handlers espalhados num contêiner real (listener nativo anexado no pointerdown). */
function Harness({ scrollToTop }: { scrollToTop?: () => void }) {
  const pull = usePullUpToTop({ scrollToTop });
  return <main data-testid="container" {...pull.pointerHandlers} />;
}

function fakePointer(
  y: number,
  extra: Partial<ReactPointerEvent<HTMLElement>> = {},
): ReactPointerEvent<HTMLElement> {
  return {
    clientY: y,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    currentTarget: { setPointerCapture: vi.fn() } as unknown as HTMLElement,
    preventDefault: vi.fn(),
    ...extra,
  } as unknown as ReactPointerEvent<HTMLElement>;
}

/** Container real (jsdom) com as métricas de scroll controladas. */
function makeContainer(overrides: { scrollTop?: number; clientHeight?: number; scrollHeight?: number } = {}) {
  const el = document.createElement("div");
  el.scrollTop = overrides.scrollTop ?? 900;
  Object.defineProperty(el, "clientHeight", {
    value: overrides.clientHeight ?? 100,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", {
    value: overrides.scrollHeight ?? 1000,
    configurable: true,
  });
  return el;
}

describe("usePullUpToTop (F26 — FSM pull-up to top)", () => {
  it("ignora toque com mouse (desktop) e toque fora do rodapé", () => {
    const { result } = renderHook(() => usePullUpToTop());
    const { onPointerDown } = result.current.pointerHandlers;

    // Mouse: nunca engaja.
    act(() => onPointerDown(fakePointer(100, { pointerType: "mouse" })));
    expect(result.current.state).toBe("idle");

    // Touch fora do fim do scroll: não engaja.
    const container = makeContainer({ scrollTop: 100, clientHeight: 100, scrollHeight: 1000 });
    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    expect(result.current.state).toBe("idle");
  });

  it("engaja no rodapé e acumula resistência elástica ao puxar", () => {
    const { result } = renderHook(() => usePullUpToTop());
    const { onPointerDown, onPointerMove } = result.current.pointerHandlers;
    const container = makeContainer();

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    expect(result.current.state).toBe("at_bottom");

    act(() => onPointerMove(fakePointer(160, { currentTarget: container })));
    expect(result.current.state).toBe("pulling");
    expect(result.current.pullDistance).toBeGreaterThan(0);
    expect(result.current.progress).toBeGreaterThan(0);
    // Resistência: 60px brutos → menos que 60 visualizados.
    expect(result.current.pullDistance).toBeLessThan(60);
  });

  it("atinge o threshold → estado armado (threshold_reached)", () => {
    const { result } = renderHook(() => usePullUpToTop());
    const { onPointerDown, onPointerMove } = result.current.pointerHandlers;
    const container = makeContainer();

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    act(() => onPointerMove(fakePointer(400, { currentTarget: container })));
    expect(result.current.state).toBe("threshold_reached");
    expect(result.current.progress).toBe(1);
  });

  it("dispara scroll suave ao soltar com threshold sustentado", async () => {
    const scrollToTop = vi.fn();
    const { result } = renderHook(() => usePullUpToTop({ scrollToTop }));
    const { onPointerDown, onPointerMove, onPointerUp } = result.current.pointerHandlers;
    const container = makeContainer();

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    act(() => onPointerMove(fakePointer(400, { currentTarget: container })));
    await act(async () => {
      onPointerUp(fakePointer(400, { currentTarget: container }));
      // Aguarda o rAF que retorna ao idle (estado final "triggered" é
      // renderizado no mesmo frame; o idle chega no próximo).
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(scrollToTop).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("idle"); // pós-rAF volta ao idle
  });

  it("não dispara ao soltar com arrasto curto (abaixo do threshold)", () => {
    const scrollToTop = vi.fn();
    const { result } = renderHook(() => usePullUpToTop({ scrollToTop }));
    const { onPointerDown, onPointerMove, onPointerUp } = result.current.pointerHandlers;
    const container = makeContainer();

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    act(() => onPointerMove(fakePointer(140, { currentTarget: container })));
    act(() => onPointerUp(fakePointer(140, { currentTarget: container })));

    expect(scrollToTop).not.toHaveBeenCalled();
  });

  it("cancelamento reversível: recuar o dedo desfaz o threshold sem scroll", () => {
    const scrollToTop = vi.fn();
    const { result } = renderHook(() => usePullUpToTop({ scrollToTop }));
    const { onPointerDown, onPointerMove, onPointerUp } = result.current.pointerHandlers;
    const container = makeContainer();

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    act(() => onPointerMove(fakePointer(400, { currentTarget: container })));
    expect(result.current.state).toBe("threshold_reached");

    // Recua antes de soltar → cancela (progresso zera, sem scroll).
    act(() => onPointerMove(fakePointer(90, { currentTarget: container })));
    expect(result.current.state).toBe("at_bottom");
    expect(result.current.progress).toBe(0);

    act(() => onPointerUp(fakePointer(90, { currentTarget: container })));
    expect(scrollToTop).not.toHaveBeenCalled();
  });

  it("barreira de inércia: sair do rodapé durante o arrasto desarma o gesto", () => {
    const scrollToTop = vi.fn();
    const { result } = renderHook(() => usePullUpToTop({ scrollToTop }));
    const { onPointerDown, onPointerMove, onPointerUp } = result.current.pointerHandlers;
    // Container que NÃO está mais no fim (momentum ainda rolando).
    const container = makeContainer({ scrollTop: 500, clientHeight: 100, scrollHeight: 1000 });

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    act(() => onPointerMove(fakePointer(300, { currentTarget: container })));

    expect(result.current.state).toBe("idle"); // desarmado pela barreira
    act(() => onPointerUp(fakePointer(300, { currentTarget: container })));
    expect(scrollToTop).not.toHaveBeenCalled();
  });

  it("engaja no meio do gesto: rolar até o fim e puxar num mesmo toque (re-âncora)", () => {
    const scrollToTop = vi.fn();
    const { result } = renderHook(() => usePullUpToTop({ scrollToTop }));
    const { onPointerDown, onPointerMove, onPointerUp } = result.current.pointerHandlers;
    // Começa longe do fim — o pointerdown NÃO engaja (âncora registrada).
    const container = makeContainer({ scrollTop: 500, clientHeight: 100, scrollHeight: 1000 });

    act(() => onPointerDown(fakePointer(200, { currentTarget: container })));
    expect(result.current.state).toBe("idle");

    // O scroll atinge o fim DURANTE o toque: re-ancora em 200 e engaja.
    container.scrollTop = 900;
    act(() => onPointerMove(fakePointer(200, { currentTarget: container })));
    expect(result.current.state).toBe("at_bottom");

    // Pull conta da re-âncora: 240 → 40px brutos (pulling), 420 → threshold.
    act(() => onPointerMove(fakePointer(240, { currentTarget: container })));
    expect(result.current.state).toBe("pulling");
    act(() => onPointerMove(fakePointer(420, { currentTarget: container })));
    expect(result.current.state).toBe("threshold_reached");

    act(() => onPointerUp(fakePointer(420, { currentTarget: container })));
    expect(scrollToTop).toHaveBeenCalledTimes(1);
  });

  it("engaja com scrollTop fracionário no fim (subpixel de DPI alto)", () => {
    const { result } = renderHook(() => usePullUpToTop());
    const { onPointerDown } = result.current.pointerHandlers;
    const container = makeContainer({ scrollTop: 899.4, clientHeight: 100, scrollHeight: 1000 });

    act(() => onPointerDown(fakePointer(100, { currentTarget: container })));
    expect(result.current.state).toBe("at_bottom");
  });

  it("touchmove nativo NÃO-passivo previne o overscroll quando engajado puxando", () => {
    const { container } = render(<Harness />);
    const el = container.querySelector<HTMLElement>("[data-testid=container]")!;
    Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
    el.scrollTop = 900; // no fim

    act(() => {
      fireEvent.pointerDown(el, { clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    });
    act(() => {
      fireEvent.pointerMove(el, { clientY: 150, pointerId: 1 });
    });

    // Dedinho em 200 (puxando além do rodapé) → o navegador NÃO pode assumir.
    const ev = new Event("touchmove", { cancelable: true });
    Object.defineProperty(ev, "touches", { value: [{ clientY: 200 }] });
    act(() => el.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true);
  });

  it("touchmove nativo NÃO é prevenido fora do gesto (scroll normal liberado)", () => {
    const { container } = render(<Harness />);
    const el = container.querySelector<HTMLElement>("[data-testid=container]")!;
    Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
    el.scrollTop = 100; // longe do fim — gesto não engajado

    act(() => {
      fireEvent.pointerDown(el, { clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    });

    const ev = new Event("touchmove", { cancelable: true });
    Object.defineProperty(ev, "touches", { value: [{ clientY: 150 }] });
    act(() => el.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(false);
  });

  it("aplica overscroll-behavior-y: contain no contêiner durante o gesto", () => {
    const { container } = render(<Harness />);
    const el = container.querySelector<HTMLElement>("[data-testid=container]")!;
    Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
    el.scrollTop = 900;

    act(() => {
      fireEvent.pointerDown(el, { clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    });
    expect(el.style.overscrollBehaviorY).toBe("contain");

    // Fim do gesto → estilo restaurado e listener removido.
    act(() => {
      fireEvent.pointerUp(el, { clientY: 100, pointerId: 1 });
    });
    expect(el.style.overscrollBehaviorY).toBe("");
  });
});
