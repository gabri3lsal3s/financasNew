import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractReceiptTextFromFile } from "./receipt-extractor";

const mockIsNativePlatform = vi.fn<() => boolean>();
const mockExtractTextFromReceipt = vi.fn();
const mockExtractTextFromImageWeb = vi.fn();
const mockUnpdfExtractText = vi.fn();
const mockUnpdfGetDocumentProxy = vi.fn();
const mockUnpdfExtractImages = vi.fn();

vi.mock("./platform", () => ({
  isNativePlatform: () => mockIsNativePlatform(),
}));

vi.mock("./bank-listener", () => ({
  BankNotificationPlugin: {
    extractTextFromReceipt: (...args: unknown[]) => mockExtractTextFromReceipt(...args),
  },
}));

vi.mock("./web-ocr", () => ({
  extractTextFromImageWeb: (...args: unknown[]) => mockExtractTextFromImageWeb(...args),
}));

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockUnpdfExtractText(...args),
  getDocumentProxy: (...args: unknown[]) => mockUnpdfGetDocumentProxy(...args),
  extractImages: (...args: unknown[]) => mockUnpdfExtractImages(...args),
}));

describe("receipt-extractor (Pipeline Unificado PDF Digital & Escaneado)", () => {
  const originalToBlobDesc = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "toBlob",
  );
  const originalGetContextDesc = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "getContext",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNativePlatform.mockReturnValue(false);
    mockExtractTextFromReceipt.mockResolvedValue({ text: "" });
    mockExtractTextFromImageWeb.mockResolvedValue("");
    mockUnpdfExtractText.mockResolvedValue({ totalPages: 1, text: "" });
    mockUnpdfExtractImages.mockResolvedValue([]);

    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      writable: true,
      value: (callback: BlobCallback) => {
        callback(new Blob(["rendered-png-page"], { type: "image/png" }));
      },
    });
  });

  afterEach(() => {
    if (originalToBlobDesc) {
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", originalToBlobDesc);
    } else {
      delete (HTMLCanvasElement.prototype as { toBlob?: unknown }).toBlob;
    }
    if (originalGetContextDesc) {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", originalGetContextDesc);
    } else {
      delete (HTMLCanvasElement.prototype as { getContext?: unknown }).getContext;
    }
  });

  it("Android nativo + PDF digital usa unpdf primeiro (>= 40 chars) e NÃO chama plugin OCR nativo", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockUnpdfExtractText.mockResolvedValueOnce({
      totalPages: 1,
      text: "Nubank Comprovante de transferência Pix Valor: R$ 150,00 Para: Padaria Central Data: 20/11/2026",
    });

    const pdfFile = new File(["%PDF-1.4 digital"], "pix-digital.pdf", {
      type: "application/pdf",
    });

    const text = await extractReceiptTextFromFile(pdfFile);

    expect(text).toContain("Padaria Central");
    expect(text).toContain("150,00");
    expect(mockUnpdfExtractText).toHaveBeenCalledTimes(1);
    expect(mockExtractTextFromReceipt).not.toHaveBeenCalled();
    expect(mockExtractTextFromImageWeb).not.toHaveBeenCalled();
  });

  it("Android nativo + PDF escaneado (unpdf < 40 chars) delega automaticamente para ML Kit nativo", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockUnpdfExtractText.mockResolvedValueOnce({ totalPages: 1, text: "   " });
    mockExtractTextFromReceipt.mockResolvedValueOnce({
      text: "Comprovante Pix Itaú Valor Pago: R$ 89,90 Favorecido: Drogasil",
    });

    const scannedPdf = new File(["%PDF-1.4 image-only"], "escaneado.pdf", {
      type: "application/pdf",
    });

    const text = await extractReceiptTextFromFile(scannedPdf);

    expect(mockUnpdfExtractText).toHaveBeenCalledTimes(1);
    expect(mockExtractTextFromReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
    expect(text).toContain("Drogasil");
  });

  it("Web/PWA + PDF escaneado (< 40 chars) renderiza página via getDocumentProxy em <canvas> e aciona OCR web", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    mockUnpdfExtractText.mockResolvedValueOnce({ totalPages: 1, text: "123" });

    const destroyMock = vi.fn().mockResolvedValue(undefined);
    const cleanupDocMock = vi.fn().mockResolvedValue(undefined);
    const cleanupPageMock = vi.fn().mockReturnValue(true);
    const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
    mockUnpdfGetDocumentProxy.mockResolvedValueOnce({
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn(({ scale }: { scale: number }) => ({
          width: 600 * scale,
          height: 800 * scale,
        })),
        render: renderMock,
        cleanup: cleanupPageMock,
      }),
      cleanup: cleanupDocMock,
      loadingTask: { destroy: destroyMock },
    });

    mockExtractTextFromImageWeb.mockResolvedValueOnce(
      "Comprovante Pix Banco Inter\nValor Pago: R$ 210,00\nRecebedor: Mercado Central",
    );

    const scannedWebPdf = new File(["%PDF-1.4 scanned"], "scanned-web.pdf", {
      type: "application/pdf",
    });

    const text = await extractReceiptTextFromFile(scannedWebPdf);

    expect(mockUnpdfGetDocumentProxy).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(cleanupPageMock).toHaveBeenCalledTimes(1);
    expect(cleanupDocMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(mockExtractTextFromImageWeb).toHaveBeenCalledTimes(1);
    expect(text).toContain("Mercado Central");
  });

  it("Web/PWA faz fallback para extractImages quando getDocumentProxy falhar na renderização", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    mockUnpdfExtractText.mockResolvedValueOnce({ totalPages: 1, text: "" });
    mockUnpdfGetDocumentProxy.mockRejectedValueOnce(new Error("canvas render blocked"));

    const putImageDataMock = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => ({ putImageData: putImageDataMock }),
    });

    const originalImageData = globalThis.ImageData;
    if (typeof originalImageData === "undefined") {
      globalThis.ImageData = class MockImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      } as unknown as typeof ImageData;
    }

    mockUnpdfExtractImages.mockResolvedValueOnce([
      {
        width: 300,
        height: 400,
        channels: 1,
        key: "img0",
        data: new Uint8ClampedArray(300 * 400).fill(200),
      },
    ]);
    mockExtractTextFromImageWeb.mockResolvedValueOnce("Pix Enviado Valor: R$ 75,00");

    try {
      const scannedPdf = new File(["%PDF-1.4 img-stream"], "img-fallback.pdf", {
        type: "application/pdf",
      });
      const text = await extractReceiptTextFromFile(scannedPdf);

      expect(mockUnpdfExtractImages).toHaveBeenCalledTimes(1);
      expect(putImageDataMock).toHaveBeenCalledTimes(1);
      expect(mockExtractTextFromImageWeb).toHaveBeenCalledTimes(1);
      expect(text).toContain("75,00");
    } finally {
      if (typeof originalImageData === "undefined") {
        delete (globalThis as { ImageData?: unknown }).ImageData;
      }
    }
  });
});
