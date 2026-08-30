import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useContainerScroll } from "./use-container-scroll";

describe("useContainerScroll", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    container = document.createElement("div");
    container.id = "test-container";
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it("inicia com valores false quando scrollTop = 0", () => {
    container.scrollTop = 0;
    const { result } = renderHook(() =>
      useContainerScroll({ containerId: "test-container" }),
    );

    expect(result.current.isScrolled).toBe(false);
    expect(result.current.showBackToTop).toBe(false);
  });

  it("atualiza isScrolled para true ao ultrapassar o limiar de 15px", () => {
    const { result } = renderHook(() =>
      useContainerScroll({
        containerId: "test-container",
        scrolledThreshold: 15,
        backToTopThreshold: 400,
      }),
    );

    act(() => {
      container.scrollTop = 25;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isScrolled).toBe(true);
    expect(result.current.showBackToTop).toBe(false);
  });

  it("atualiza showBackToTop para true ao ultrapassar 400px", () => {
    const { result } = renderHook(() =>
      useContainerScroll({
        containerId: "test-container",
        scrolledThreshold: 15,
        backToTopThreshold: 400,
      }),
    );

    act(() => {
      container.scrollTop = 500;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isScrolled).toBe(true);
    expect(result.current.showBackToTop).toBe(true);

    // Retorna ao topo
    act(() => {
      container.scrollTop = 0;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isScrolled).toBe(false);
    expect(result.current.showBackToTop).toBe(false);
  });

  it("não quebra se o contêiner não for encontrado no DOM", () => {
    const { result } = renderHook(() =>
      useContainerScroll({ containerId: "inexistente" }),
    );

    expect(result.current.isScrolled).toBe(false);
    expect(result.current.showBackToTop).toBe(false);
  });
});
