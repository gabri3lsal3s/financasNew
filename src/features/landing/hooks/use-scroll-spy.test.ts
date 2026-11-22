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

  it("rastreia as seções padrão da nova arquitetura da landing page (ecossistema, dores, profundidade, simulador)", () => {
    const ids = ["ecossistema", "dores", "profundidade", "simulador"];
    const elements = ids.map((id) => {
      const el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    vi.spyOn(elements[0]!, "getBoundingClientRect").mockReturnValue({
      top: 400,
      bottom: 800,
      left: 0,
      right: 1000,
      width: 1000,
      height: 400,
      x: 0,
      y: 400,
      toJSON: () => {},
    });

    vi.spyOn(elements[2]!, "getBoundingClientRect").mockReturnValue({
      top: 60,
      bottom: 600,
      left: 0,
      right: 1000,
      width: 1000,
      height: 540,
      x: 0,
      y: 60,
      toJSON: () => {},
    });

    const { result } = renderHook(() => useScrollSpy({ offset: 140 }));

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.activeSection).toBe("profundidade");

    elements.forEach((el) => document.body.removeChild(el));
  });

  it("mapeia seções complementares (#plataformas -> precos e #ferramentas -> simulador) para destacar o botão Planos e Simulador sem zonas mortas", () => {
    const plataformasEl = document.createElement("div");
    plataformasEl.id = "plataformas";
    document.body.appendChild(plataformasEl);

    vi.spyOn(plataformasEl, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 620,
      left: 0,
      right: 1000,
      width: 1000,
      height: 580,
      x: 0,
      y: 40,
      toJSON: () => {},
    });

    const { result } = renderHook(() => useScrollSpy({ offset: 140 }));

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.activeSection).toBe("precos");

    document.body.removeChild(plataformasEl);
  });
});
