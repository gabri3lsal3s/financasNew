import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna o valor inicial imediatamente", () => {
    const { result } = renderHook(() => useDebounce("PETR4", 500));
    expect(result.current).toBe("PETR4");
  });

  it("não atualiza o valor antes do tempo decorrido", () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 500), {
      initialProps: { val: "PETR4" },
    });

    rerender({ val: "VALE3" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("PETR4");
  });

  it("atualiza o valor após o delay especificado", () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 500), {
      initialProps: { val: "PETR4" },
    });

    rerender({ val: "VALE3" });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("VALE3");
  });

  it("reseta o temporizador quando o valor muda antes do delay (debounce real)", () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 500), {
      initialProps: { val: "P" },
    });

    rerender({ val: "PE" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("P");

    rerender({ val: "PET" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("P");

    rerender({ val: "PETR4" });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("P");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("PETR4");
  });
});
