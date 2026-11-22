import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as nativeModule from "@/services/native";
import * as toastModule from "@/services/toast";
import { usePrint } from "./use-print";

describe("usePrint (F22)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("inicia com printing como false", () => {
    const { result } = renderHook(() => usePrint());
    expect(result.current.printing).toBe(false);
  });

  it("muda printing para true e dispara window.print no rAF em ambiente Web", () => {
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

  it("mantém printing true até printCurrentWebView concluir no Android nativo e restaura título", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    let resolveNative!: (value: { success: boolean; error?: string }) => void;
    const printNativeSpy = vi.spyOn(nativeModule, "printCurrentWebView").mockImplementation(
      () =>
        new Promise<{ success: boolean; error?: string }>((resolve) => {
          resolveNative = resolve;
        }),
    );

    const originalTitle = document.title;
    document.title = "Axir Finance";

    const { result } = renderHook(() => usePrint("Relatorio_Padrao.pdf"));

    act(() => {
      result.current.triggerPrint("Relatorio_Custom.pdf");
    });

    expect(result.current.printing).toBe(true);
    expect(document.title).toBe("Relatorio_Custom.pdf");

    // Avança dois frames de animação para acionar o bridge nativo
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(printNativeSpy).toHaveBeenCalledWith("Relatorio_Custom.pdf");
    // Ainda está imprimindo no Print Spooler -> PrintSheet precisa continuar montado!
    expect(result.current.printing).toBe(true);

    await act(async () => {
      resolveNative({ success: true });
      await Promise.resolve();
    });

    expect(result.current.printing).toBe(false);
    expect(document.title).toBe("Axir Finance");
    document.title = originalTitle;
  });

  it("exibe toast destrutivo se printCurrentWebView falhar no Android", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(nativeModule, "printCurrentWebView").mockResolvedValue({
      success: false,
      error: "PrintManager indisponível.",
    });
    const toastSpy = vi.spyOn(toastModule, "pushToast").mockImplementation(() => 1);

    const { result } = renderHook(() => usePrint("Fatura.pdf"));

    act(() => {
      result.current.triggerPrint();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível gerar o PDF",
        description: "PrintManager indisponível.",
        variant: "destructive",
      }),
    );
    expect(result.current.printing).toBe(false);
  });
});
