import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeEMVCRC16 } from "@/domain/notifications";
import { PdfPasswordProtectedError } from "@/services/native/receipt-extractor";
import * as pdfSessionService from "@/services/pdf-session";
import { setActiveUserId } from "@/services/user-storage";
import { clearLocalReceiptScanCache, resolveAndScanReceiptFile } from "./index";

const mockExtractReceiptTextFromFile = vi.fn();
const mockExtractSingleReceiptWithAi = vi.fn();

vi.mock("@/services/native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native")>();
  return {
    ...actual,
    isNativePlatform: () => false,
    extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
  };
});

vi.mock("@/services/ai-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ai-assistant")>();
  return {
    ...actual,
    extractSingleReceiptWithAi: (...args: unknown[]) => mockExtractSingleReceiptWithAi(...args),
  };
});

vi.mock("@/services/merchant-learning", () => ({
  getMerchantLearningMemory: () => ({}),
  getCardDigitsMapping: () => ({}),
  getBankCardMapping: () => ({}),
}));

describe("receipts/receipt-pipeline (PDF session, senha, abort, magic bytes e QR local)", () => {
  const originalBarcodeDetector = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActiveUserId("user-pipe");
    clearLocalReceiptScanCache("user-pipe");
    mockExtractSingleReceiptWithAi.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
      fallbackToLocal: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = originalBarcodeDetector;
    globalThis.createImageBitmap = originalCreateImageBitmap;
  });

  it("rejeita arquivo ZIP mascarado via magic bytes (PK) como unsupported_format", async () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const zipFile = new File([zipHeader], "fatura-falsa.pdf", { type: "application/pdf" });

    const res = await resolveAndScanReceiptFile(zipFile, { userId: "user-pipe" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("unsupported_format");
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
  });

  it("abre PDF real com %PDF- via openPdfDocumentSession, propaga password_required e desbloqueia com senha", async () => {
    const disposeMock = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi
      .spyOn(pdfSessionService, "openPdfDocumentSession")
      .mockRejectedValueOnce(new PdfPasswordProtectedError())
      .mockResolvedValueOnce({
        fileName: "boleto-protegido.pdf",
        sha256: null,
        totalPages: 2,
        getTotalPages: () => 2,
        getBuffer: () => new ArrayBuffer(16),
        extractPageTexts: async () => [
          "Demonstrativo de mensalidade",
          "Ficha de compensação\nBeneficiário: Colégio Horizonte\nVencimento: 10/12/2026\nValor do documento: R$ 850,00",
        ],
        extractSpatialPages: async () => ({
          usedTwoColumnMode: false,
          totalPages: 2,
          lines: [
            {
              text: "Ficha de compensação",
              y: 700,
              xStart: 40,
              xEnd: 180,
              fontSize: 10,
              column: 1,
              pageNumber: 2,
              tokens: [],
            },
            {
              text: "Beneficiário: Colégio Horizonte",
              y: 680,
              xStart: 40,
              xEnd: 220,
              fontSize: 10,
              column: 1,
              pageNumber: 2,
              tokens: [],
            },
            {
              text: "Vencimento: 10/12/2026",
              y: 660,
              xStart: 40,
              xEnd: 180,
              fontSize: 10,
              column: 1,
              pageNumber: 2,
              tokens: [],
            },
            {
              text: "Valor do documento: R$ 850,00",
              y: 660,
              xStart: 280,
              xEnd: 460,
              fontSize: 10,
              column: 1,
              pageNumber: 2,
              tokens: [],
            },
          ],
        }),
        renderPageToBlob: async () => new Blob(["page2"], { type: "image/png" }),
        dispose: disposeMock,
      });

    const realPdf = new File(["%PDF-1.4 encrypted-content"], "boleto-protegido.pdf", {
      type: "application/pdf",
    });

    const lockedRes = await resolveAndScanReceiptFile(realPdf, { userId: "user-pipe" });
    expect(lockedRes.ok).toBe(false);
    expect(lockedRes.status).toBe("password_required");
    expect(lockedRes.errorMessage).toMatch(/protegido por senha/i);

    const unlockedRes = await resolveAndScanReceiptFile(realPdf, {
      userId: "user-pipe",
      pdfPassword: "123",
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(unlockedRes.ok).toBe(true);
    expect(unlockedRes.status).toBe("success");
    expect(unlockedRes.parsed?.amountCents).toBe(85000);
    expect(unlockedRes.parsed?.documentStatus).toBe("pending_due");
    expect(unlockedRes.parsed?.dueDate).toBe("2026-12-10");
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("retorna status cancelled imediatamente quando AbortSignal é abortado", async () => {
    const controller = new AbortController();
    controller.abort();

    const file = new File(["%PDF-1.4 payload"], "boleto.pdf", { type: "application/pdf" });
    const res = await resolveAndScanReceiptFile(file, {
      userId: "user-pipe",
      signal: controller.signal,
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe("cancelled");
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
  });

  it("decodifica QR Code de Pix Copia e Cola localmente em imagem sem chamar OCR ou IA", async () => {
    const baseEmv =
      "00020126360014br.gov.bcb.pix0114+5511987654321520400005303986540562.405802BR5913CAFE SAO JOSE6009SAO PAULO6304";
    const emv = `${baseEmv}${computeEMVCRC16(baseEmv)}`;

    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 400,
      height: 400,
      close: vi.fn(),
    } as unknown as ImageBitmap);

    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = class {
      async detect() {
        return [{ rawValue: emv }];
      }
    };

    const imgFile = new File(["fake-png"], "qr-pix.png", { type: "image/png" });
    const res = await resolveAndScanReceiptFile(imgFile, {
      userId: "user-pipe",
      preferFastAiVisionForWebImages: true,
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe("success");
    expect(res.parsed?.amountCents).toBe(6240);
    expect(res.parsed?.paymentMethod).toBe("pix");
    expect(mockExtractSingleReceiptWithAi).not.toHaveBeenCalled();
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
  });
});
