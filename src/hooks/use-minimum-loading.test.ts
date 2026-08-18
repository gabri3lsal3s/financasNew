import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMinimumLoading } from "./use-minimum-loading";

describe("useMinimumLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna isShowing=false e isClosing=false quando inicializado com isLoading=false", () => {
    const { result } = renderHook(() => useMinimumLoading(false));
    expect(result.current.isShowing).toBe(false);
    expect(result.current.isClosing).toBe(false);
  });

  it("retorna isShowing=true e isClosing=false imediatamente quando isLoading=true", () => {
    const { result } = renderHook(() => useMinimumLoading(true));
    expect(result.current.isShowing).toBe(true);
    expect(result.current.isClosing).toBe(false);
  });

  it("sustenta o loading pelo tempo mínimo mesmo se isLoading desligar antes", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useMinimumLoading(loading, 600),
      { initialProps: { loading: true } },
    );

    expect(result.current.isShowing).toBe(true);

    // 50ms depois, o loading desliga no backend
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ loading: false });

    // Ainda deve permanecer showing (anti-flicker) e marcar isClosing=true
    expect(result.current.isShowing).toBe(true);
    expect(result.current.isClosing).toBe(true);

    // Avança mais 400ms (total 450ms < 600ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.isShowing).toBe(true);

    // Avança o restante do tempo (total 650ms >= 600ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isShowing).toBe(false);
    expect(result.current.isClosing).toBe(false);
  });
});
