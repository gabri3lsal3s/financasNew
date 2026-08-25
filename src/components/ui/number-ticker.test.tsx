import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import { NumberTicker } from "./number-ticker";

const waitFrames = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  updateVisualCustomization({ numberTickerEnabled: true });
});

describe("NumberTicker (F8 — Decisão 1)", () => {
  it("aplica o valor final instantaneamente com prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );

    render(<NumberTicker value={4200} format={(v) => `R$ ${(v / 100).toFixed(2)}`} />);
    expect(screen.getByText("R$ 42.00")).toBeInTheDocument();
  });

  it("anima de um valor a outro (interpolação via rAF)", async () => {
    const { rerender } = render(<NumberTicker value={100} />);
    expect(screen.getByText("100")).toBeInTheDocument();

    rerender(<NumberTicker value={200} />);

    // Durante a animação (300ms): valor intermediário entre 100 e 200.
    await waitFrames(60);
    const mid = Number.parseFloat(screen.getByText(/^\d+(\.\d+)?$/).textContent ?? "0");
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);

    // Fim da animação: valor final exato.
    await waitFrames(400);
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renderiza com a classe .num (mono + tabular)", () => {
    render(<NumberTicker value={100} className="font-semibold" />);
    expect(screen.getByText("100")).toHaveClass("num", "font-semibold");
  });

  it("desliga a animação quando numberTickerEnabled é false (F11)", async () => {
    updateVisualCustomization({ numberTickerEnabled: false });
    const { rerender } = render(<NumberTicker value={100} />);

    rerender(<NumberTicker value={200} />);
    await waitFrames(60);
    // Sem interpolação: o valor final aparece imediatamente.
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("desliga a animação quando motionLevel é reduced (F70)", async () => {
    updateVisualCustomization({ motionLevel: "reduced" });
    const { rerender } = render(<NumberTicker value={100} />);

    rerender(<NumberTicker value={200} />);
    await waitFrames(60);
    expect(screen.getByText("200")).toBeInTheDocument();
  });
});
