import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAporteUrlAnimations } from "./use-aporte-url-animations";

function Harness({
  availableCashCents,
  isPositionLoading,
}: {
  availableCashCents: number;
  isPositionLoading: boolean;
}) {
  const location = useLocation();
  const state = useAporteUrlAnimations({ availableCashCents, isPositionLoading });
  return (
    <div>
      <span data-testid="aporte-cents">{state.userAporteCents}</span>
      <span data-testid="use-cash">{String(state.useBrokerageCash)}</span>
      <span data-testid="cash-used">{state.cashUsedCents}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

describe("useAporteUrlAnimations (Onda 2 · Fase 5 prefill combinado)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aplica ?valor= e ?usarCaixa=1 simultaneamente e limpa ambos em um único replace sem perder o caixa", () => {
    render(
      <MemoryRouter
        initialEntries={["/investments?tab=rebalancear&view=simulador&valor=30000&usarCaixa=1"]}
      >
        <Harness availableCashCents={15_000} isPositionLoading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("search").textContent).toBe("?tab=rebalancear&view=simulador");

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByTestId("aporte-cents").textContent).toBe("30000");
    expect(screen.getByTestId("use-cash").textContent).toBe("true");
    expect(screen.getByTestId("cash-used").textContent).toBe("15000");
  });
});
