import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computeEMVCRC16 } from "@/domain/notifications";
import * as clipboardService from "@/services/clipboard";
import { isNativePlatform } from "@/services/native";
import {
  DISMISSED_CLIPBOARD_HASHES_KEY,
  fnv1aHash,
  resetPixClipboardStoreForTests,
} from "@/services/pix-clipboard-store";
import { setActiveUserId } from "@/services/user-storage";
import { usePixClipboardDetector } from "./use-pix-clipboard-detector";

const appStateListeners: Array<(state: { isActive: boolean }) => void> = [];
const mockAppAddListener = vi.fn(
  async (
    _event: string,
    cb: (state: { isActive: boolean }) => void,
  ) => {
    appStateListeners.push(cb);
    return { remove: vi.fn() };
  },
);

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (event: string, cb: (state: { isActive: boolean }) => void) =>
      mockAppAddListener(event, cb),
  },
}));

vi.mock("@/services/native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native")>();
  return {
    ...actual,
    isNativePlatform: vi.fn(() => false),
  };
});

vi.mock("@/services/merchant-learning", () => ({
  useMerchantLearning: () => ({
    memory: {
      name_padaria_sao_bento: {
        friendlyName: "Padaria São Bento",
        categorySlug: "alimentacao",
        defaultNature: "expense" as const,
        pixKeys: ["+5511987654321"],
        rawAliases: ["padaria sao bento"],
        usageCount: 5,
        lastUsedAt: "2026-11-13T12:00:00Z",
      },
    },
    recordLearning: vi.fn(),
  }),
}));

function buildValidEmv(options: { amount?: string; merchant?: string }): string {
  const merchant = options.merchant ?? "PADARIA SAO BENTO";
  const amountTag =
    options.amount !== undefined
      ? `54${String(options.amount.length).padStart(2, "0")}${options.amount}`
      : "";
  const merchantLen = String(merchant.length).padStart(2, "0");
  const base = `00020126360014br.gov.bcb.pix0114+5511987654321520400005303986${amountTag}5802BR59${merchantLen}${merchant}6009SAO PAULO6304`;
  return `${base}${computeEMVCRC16(base)}`;
}

describe("usePixClipboardDetector (Passivo Estrito PIX_BRCODE + FNV-1a + Android Cooldown)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    appStateListeners.length = 0;
    localStorage.clear();
    setActiveUserId("user-1");
    resetPixClipboardStoreForTests();
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.spyOn(clipboardService, "canReadClipboardSilently").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborta e não tenta ler a área de transferência na Web quando canReadClipboardSilently for false", async () => {
    vi.spyOn(clipboardService, "canReadClipboardSilently").mockResolvedValue(false);
    const readSpy = vi.spyOn(clipboardService, "readClipboardText");

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(result.current.detectedPix).toBeNull();
  });

  it("não detecta clipboard vazio, chave isolada (PIX_KEY), mensagem solta nem comprovante (PIX_RECEIPT)", async () => {
    const samples = [
      "usuario@exemplo.com.br",
      "Pix de R$ 35,50 para Padaria São Bento",
      "Comprovante de transferência Pix\nValor: R$ 120,00\nPara: Mercado Central\nData: 20/11/2026",
    ];

    for (const sample of samples) {
      resetPixClipboardStoreForTests();
      vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
        status: "success",
        text: sample,
      });

      const { result, unmount } = renderHook(() => usePixClipboardDetector());
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.detectedPix).toBeNull();
      unmount();
    }
  });

  it("detecta PIX_BRCODE válido com Tag 54 e associa memória do estabelecimento", async () => {
    const emv = buildValidEmv({ amount: "35.50", merchant: "PADARIA SAO BENTO" });
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: emv,
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).not.toBeNull();
    expect(result.current.detectedPix?.candidate.kind).toBe("PIX_BRCODE");
    expect(result.current.detectedPix?.candidate.valueCents).toBe(3550);
    expect(result.current.detectedPix?.identity.friendlyName).toBe("Padaria São Bento");
    expect(result.current.detectedPix?.identity.categorySlug).toBe("alimentacao");
  });

  it("detecta PIX_BRCODE válido SEM Tag 54 com valueCents === 0", async () => {
    const emvNoAmount = buildValidEmv({ merchant: "CAFE CENTRAL" });
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: emvNoAmount,
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).not.toBeNull();
    expect(result.current.detectedPix?.candidate.kind).toBe("PIX_BRCODE");
    expect(result.current.detectedPix?.candidate.valueCents).toBe(0);
    expect(result.current.detectedPix?.candidate.recipientName).toBe("CAFE CENTRAL");
  });

  it("dispensa persistindo hash FNV-1a em user-storage (sem texto bruto) e não reativa no focus", async () => {
    const emv = buildValidEmv({ amount: "50.00", merchant: "FARMACIA SAUDE" });
    vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: emv,
    });

    const { result } = renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).not.toBeNull();

    act(() => {
      result.current.dismissDetectedPix();
    });

    expect(result.current.detectedPix).toBeNull();

    const stored =
      localStorage.getItem(`financas_user-1_${DISMISSED_CLIPBOARD_HASHES_KEY}`) ?? "";
    expect(stored).toContain(fnv1aHash(emv));
    expect(stored).not.toContain("FARMACIA SAUDE");

    // Novo foco não reativa
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });

    expect(result.current.detectedPix).toBeNull();
  });

  it("Android nativo usa App.appStateChange (ignora window.focus) com cooldown mínimo de 10s", async () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    const emv = buildValidEmv({ amount: "42.00", merchant: "MERCADO NATIVO" });
    const readSpy = vi.spyOn(clipboardService, "readClipboardText").mockResolvedValue({
      status: "success",
      text: emv,
    });

    renderHook(() => usePixClipboardDetector());

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(mockAppAddListener).toHaveBeenCalledWith("appStateChange", expect.any(Function));

    // window.focus no Android NÃO deve disparar nova leitura
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });
    expect(readSpy).toHaveBeenCalledTimes(1);

    // appStateChange dentro do cooldown (< 10s) NÃO lê novamente
    await act(async () => {
      vi.advanceTimersByTime(4_000);
      appStateListeners.forEach((cb) => cb({ isActive: true }));
    });
    expect(readSpy).toHaveBeenCalledTimes(1);

    // Após 10s, retorno ao primeiro plano executa nova checagem
    await act(async () => {
      vi.advanceTimersByTime(7_000);
      appStateListeners.forEach((cb) => cb({ isActive: true }));
    });
    expect(readSpy).toHaveBeenCalledTimes(2);
  });
});
