import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePixClipboardDetector } from "./use-pix-clipboard-detector";
import * as clipboardService from "@/services/clipboard";

vi.mock("@/services/merchant-learning", () => ({
  useMerchantLearning: () => ({
    memory: {
      version: 1,
      merchants: {
        "padaria sao bento": {
          normalizedMerchant: "padaria sao bento",
          friendlyName: "Padaria São Bento",
          categorySlug: "alimentacao",
          defaultNature: "expense",
          pixKeys: ["12345678000199"],
          count: 5,
          lastUsedAt: "2026-11-13T12:00:00Z",
        },
      },
    },
    recordLearning: vi.fn(),
  }),
}));

describe("usePixClipboardDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(clipboardService, "canReadClipboardSilently").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborta e não tenta ler a área de transferência quando canReadClipboardSilently for false (evita popup do Chrome)", async () => {
    vi.spyOn(clipboardService, "canReadClipboardSilently").mockResolvedValue(false);
    const readSpy = vi.spyOn(clipboardService, "readClipboardText");

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(result.current.detectedPix).toBeNull();
  });

  it("não detecta nada quando o clipboard estiver vazio ou falhar", async () => {
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "empty",
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).toBeNull();
  });

  it("REQUISITO ESTRITO: descarta chaves Pix avulsas sem valor monetário (valueCents = 0)", async () => {
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: "usuario@exemplo.com.br", // Chave Pix pura sem valor
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Deve ser nulo porque não tem valor associado!
    expect(result.current.detectedPix).toBeNull();
  });

  it("detecta com sucesso código/mensagem Pix que contenha valor válido (> 0) e associa memória", async () => {
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: "Pix de R$ 35,50 para Padaria São Bento chave 12345678000199",
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).not.toBeNull();
    expect(result.current.detectedPix?.candidate.valueCents).toBe(3550);
    expect(result.current.detectedPix?.identity.friendlyName).toBe("Padaria São Bento");
    expect(result.current.detectedPix?.identity.categorySlug).toBe("alimentacao");
  });

  it("dispensa a detecção atual e não reativa para o mesmo texto", async () => {
    const text = "Pix de R$ 50,00 para Farmácia Saúde";
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text,
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).not.toBeNull();

    // Dispensar
    act(() => {
      result.current.dismissDetectedPix();
    });

    expect(result.current.detectedPix).toBeNull();

    // Novo foco/trigger da janela não deve restaurar o mesmo texto dispensado
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).toBeNull();
  });
});
