import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MODAL_EXIT_DURATION_MS,
  shouldSkipModalTransitionDelay,
  useModalTransition,
} from "./use-modal-transition";

describe("useModalTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute("data-motion");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-motion");
    vi.restoreAllMocks();
  });

  it("fecha o modal atual imediatamente e abre o próximo apenas após MODAL_EXIT_DURATION_MS", () => {
    const closeCurrent = vi.fn();
    const openNext = vi.fn();

    const { result } = renderHook(() => useModalTransition());

    act(() => {
      result.current.scheduleAfterClose(closeCurrent, openNext);
    });

    expect(closeCurrent).toHaveBeenCalledTimes(1);
    expect(openNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MODAL_EXIT_DURATION_MS - 1);
    });
    expect(openNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(openNext).toHaveBeenCalledTimes(1);
  });

  it("cancela a abertura agendada ao chamar cancelTransition", () => {
    const closeCurrent = vi.fn();
    const openNext = vi.fn();

    const { result } = renderHook(() => useModalTransition());

    act(() => {
      result.current.scheduleAfterClose(closeCurrent, openNext);
      result.current.cancelTransition();
    });

    act(() => {
      vi.advanceTimersByTime(MODAL_EXIT_DURATION_MS * 2);
    });

    expect(closeCurrent).toHaveBeenCalledTimes(1);
    expect(openNext).not.toHaveBeenCalled();
  });

  it("cancela timer pendente automaticamente ao desmontar o componente", () => {
    const closeCurrent = vi.fn();
    const openNext = vi.fn();

    const { result, unmount } = renderHook(() => useModalTransition());

    act(() => {
      result.current.scheduleAfterClose(closeCurrent, openNext);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(MODAL_EXIT_DURATION_MS * 2);
    });

    expect(openNext).not.toHaveBeenCalled();
  });

  it("abre imediatamente sem atraso quando data-motion='reduced' está ativo", () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    expect(shouldSkipModalTransitionDelay()).toBe(true);

    const closeCurrent = vi.fn();
    const openNext = vi.fn();

    const { result } = renderHook(() => useModalTransition());

    act(() => {
      result.current.scheduleAfterClose(closeCurrent, openNext);
    });

    expect(closeCurrent).toHaveBeenCalledTimes(1);
    expect(openNext).toHaveBeenCalledTimes(1);
  });

  it("abre imediatamente sem atraso quando prefers-reduced-motion: reduce está ativo", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(shouldSkipModalTransitionDelay()).toBe(true);

    const closeCurrent = vi.fn();
    const openNext = vi.fn();

    const { result } = renderHook(() => useModalTransition());

    act(() => {
      result.current.scheduleAfterClose(closeCurrent, openNext);
    });

    expect(closeCurrent).toHaveBeenCalledTimes(1);
    expect(openNext).toHaveBeenCalledTimes(1);
  });
});
