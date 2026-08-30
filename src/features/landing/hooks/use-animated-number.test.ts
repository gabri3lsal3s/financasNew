import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAnimatedNumber } from "./use-animated-number";

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna o valor inicial imediatamente", () => {
    const { result } = renderHook(() => useAnimatedNumber(100));
    expect(result.current).toBe(100);
  });

  it("interpola suavemente até o novo valor alvo", () => {
    const { result, rerender } = renderHook(({ val }) => useAnimatedNumber(val, { duration: 300 }), {
      initialProps: { val: 100 },
    });

    expect(result.current).toBe(100);

    rerender({ val: 200 });

    // Avança 150ms (metade do tempo)
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // O valor intermediário deve estar entre 100 e 200
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThanOrEqual(200);

    // Avança o restante do tempo (350ms total)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(200);
  });

  it("respeita duration = 0 entregando o valor de imediato", () => {
    const { result, rerender } = renderHook(({ val }) => useAnimatedNumber(val, { duration: 0 }), {
      initialProps: { val: 50 },
    });

    rerender({ val: 500 });
    expect(result.current).toBe(500);
  });
});
