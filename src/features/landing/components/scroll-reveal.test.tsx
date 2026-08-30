import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ScrollReveal } from "./scroll-reveal";

describe("ScrollReveal", () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      constructor(callback: (entries: unknown[], observer: unknown) => void) {
        // Dispara imediatamente como visível por padrão nos testes
        callback([{ isIntersecting: true }], this);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza os filhos e aplica transição quando visível", () => {
    render(
      <ScrollReveal data-testid="reveal-box">
        <span>Conteúdo de Teste</span>
      </ScrollReveal>,
    );

    const element = screen.getByTestId("reveal-box");
    expect(element).toBeInTheDocument();
    expect(screen.getByText("Conteúdo de Teste")).toBeInTheDocument();
    expect(element).toHaveClass("opacity-100");
    expect(element).toHaveClass("translate-y-0");
  });

  it("aplica transitionDelay no style quando delay for fornecido", () => {
    render(
      <ScrollReveal delay={150} data-testid="reveal-box">
        <span>Atrasado</span>
      </ScrollReveal>,
    );

    const element = screen.getByTestId("reveal-box");
    expect(element.style.transitionDelay).toBe("150ms");
  });
});
