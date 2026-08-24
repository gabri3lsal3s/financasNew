import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { usePrint } from "./use-print";

describe("usePrint (F22)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inicia com printing como false", () => {
    const { result } = renderHook(() => usePrint());
    expect(result.current.printing).toBe(false);
  });

  it("muda printing para true e dispara window.print no rAF", () => {
    const printSpy = vi.fn();
    const originalPrint = window.print;
    window.print = printSpy;

    const { result } = renderHook(() => usePrint());

    act(() => {
      result.current.triggerPrint();
    });

    expect(result.current.printing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(result.current.printing).toBe(false);

    window.print = originalPrint;
  });
});
