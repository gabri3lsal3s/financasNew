import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPasswordProtectedError } from "@/services/native/receipt-extractor";
import { openPdfDocumentSession } from "./pdf-session";

const mockGetDocumentProxy = vi.fn();
const mockExtractText = vi.fn();

vi.mock("unpdf", () => ({
  getDocumentProxy: (...args: unknown[]) => mockGetDocumentProxy(...args),
  extractText: (...args: unknown[]) => mockExtractText(...args),
}));

describe("pdf-session (Abertura Única de DocumentProxy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("abre getDocumentProxy 1 única vez compartilhada entre texto, espacial, render e cache, limpando no dispose()", async () => {
    const pageCleanupMock = vi.fn();
    const proxyCleanupMock = vi.fn().mockResolvedValue(undefined);
    const loadingDestroyMock = vi.fn().mockResolvedValue(undefined);

    const mockPage = {
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
      }),
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: "15/11", transform: [10, 0, 0, 10, 40, 700], width: 25, height: 10 },
          { str: "PADARIA ESTRELA", transform: [10, 0, 0, 10, 95, 700], width: 120, height: 10 },
          { str: "45,90", transform: [10, 0, 0, 10, 450, 700], width: 35, height: 10 },
        ],
      }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: pageCleanupMock,
    };

    const getPageMock = vi.fn().mockResolvedValue(mockPage);
    mockGetDocumentProxy.mockResolvedValueOnce({
      numPages: 1,
      getPage: getPageMock,
      cleanup: proxyCleanupMock,
      loadingTask: { destroy: loadingDestroyMock },
    });

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
      cb(new Blob(["rendered-page-png"], { type: "image/png" }));
    });

    const buffer = new TextEncoder().encode("%PDF-1.7\nfatura").buffer;
    const session = await openPdfDocumentSession({
      buffer,
      fileName: "fatura.pdf",
      sha256: "a".repeat(64),
    });

    expect(mockGetDocumentProxy).toHaveBeenCalledTimes(1);
    expect(session.getTotalPages()).toBe(1);

    const spatial = await session.extractSpatialPages();
    expect(spatial.lines.length).toBeGreaterThan(0);
    expect(spatial.lines[0]?.text).toContain("PADARIA ESTRELA");

    const texts = await session.extractPageTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("PADARIA ESTRELA");

    const blob1 = await session.renderPageToBlob(1);
    const blob1Cached = await session.renderPageToBlob(1);
    expect(blob1).toBeInstanceOf(Blob);
    expect(blob1Cached).toBe(blob1);

    // Continua exatamente 1 única abertura do proxy
    expect(mockGetDocumentProxy).toHaveBeenCalledTimes(1);
    // Cache de tokens evita nova chamada getTextContent repetida para extração de texto
    expect(mockPage.getTextContent).toHaveBeenCalledTimes(1);
    expect(mockPage.render).toHaveBeenCalledTimes(1);

    await session.dispose();
    await session.dispose(); // idempotente
    expect(proxyCleanupMock).toHaveBeenCalledTimes(1);
    expect(loadingDestroyMock).toHaveBeenCalledTimes(1);
  });

  it("propaga PdfPasswordProtectedError quando o PDF está bloqueado por senha", async () => {
    const err = Object.assign(new Error("Password required"), { name: "PasswordException" });
    mockGetDocumentProxy.mockRejectedValueOnce(err);

    const buffer = new TextEncoder().encode("%PDF-1.7\nencrypted").buffer;
    await expect(
      openPdfDocumentSession({
        buffer,
        fileName: "protegido.pdf",
      }),
    ).rejects.toThrow(PdfPasswordProtectedError);
  });
});
