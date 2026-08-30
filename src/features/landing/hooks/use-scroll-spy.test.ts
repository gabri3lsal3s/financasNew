import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useScrollSpy } from "./use-scroll-spy";

describe("useScrollSpy", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calcula valores iniciais corretos quando no topo", () => {
    window.scrollY = 0;
    const { result } = renderHook(() => useScrollSpy());

    expect(result.current.scrollProgress).toBe(0);
    expect(result.current.isScrolled).toBe(false);
    expect(result.current.showBackToTop).toBe(false);
  });

  it("atualiza isScrolled e showBackToTop ao rolar", () => {
    const { result } = renderHook(() =>
      useScrollSpy({ scrolledThreshold: 20, backToTopThreshold: 600 }),
    );

    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isScrolled).toBe(true);
    expect(result.current.showBackToTop).toBe(false);

    act(() => {
      window.scrollY = 700;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.showBackToTop).toBe(true);
  });

  it("identifica a seção ativa com base no getBoundingClientRect", () => {
    const section1 = document.createElement("div");
    section1.id = "recursos";
    document.body.appendChild(section1);

    const section2 = document.createElement("div");
    section2.id = "investimentos";
    document.body.appendChild(section2);

    vi.spyOn(section1, "getBoundingClientRect").mockReturnValue({
      top: 50,
      bottom: 500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 450,
      x: 0,
      y: 50,
      toJSON: () => {},
    });

    vi.spyOn(section2, "getBoundingClientRect").mockReturnValue({
      top: 550,
      bottom: 1000,
      left: 0,
      right: 1000,
      width: 1000,
      height: 450,
      x: 0,
      y: 550,
      toJSON: () => {},
    });

    const { result } = renderHook(() =>
      useScrollSpy({ sectionIds: ["recursos", "investimentos"], offset: 140 }),
    );

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.activeSection).toBe("recursos");

    // Limpeza
    document.body.removeChild(section1);
    document.body.removeChild(section2);
  });

  it("incrementa resetKey quando o usuário desce além de 250px e retorna ao topo", () => {
    const { result } = renderHook(() => useScrollSpy());

    expect(result.current.resetKey).toBe(0);

    // Rola para baixo
    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.resetKey).toBe(0);

    // Retorna ao topo
    act(() => {
      window.scrollY = 10;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.resetKey).toBe(1);
  });
});
