import { findBimodalGutterX, groupTokensIntoLines, type SpatialPdfLine, type SpatialPdfToken } from "@/domain/reconciliation/extractors/spatial-pdf-extractor";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
  renderScannedPdfPageToBlob,
} from "@/services/native/receipt-extractor";

const PDF_RENDER_MAX_DIMENSION = 2000;

interface RawPdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

interface PdfPageProxyLike {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items?: unknown[] }>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    canvas?: HTMLCanvasElement | null;
    viewport: unknown;
  }) => { promise: Promise<unknown> };
  cleanup?: () => void;
}

interface PdfDocumentProxyLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxyLike>;
  cleanup?: () => Promise<void> | void;
  loadingTask?: { destroy?: () => Promise<void> | void };
}

export interface PdfSpatialExtractionResult {
  lines: SpatialPdfLine[];
  usedTwoColumnMode: boolean;
  totalPages: number;
}

export interface PdfDocumentSession {
  readonly fileName: string;
  readonly sha256: string | null;
  readonly totalPages: number;
  getTotalPages: () => number;
  extractPageTexts: () => Promise<string[]>;
  extractSpatialPages: (options?: {
    columnMode?: "auto" | "single" | "bimodal";
  }) => Promise<PdfSpatialExtractionResult>;
  renderPageToBlob: (pageNumber: number) => Promise<Blob | null>;
  getBuffer: () => ArrayBuffer;
  dispose: () => Promise<void>;
}

export interface OpenPdfDocumentSessionParams {
  buffer: ArrayBuffer;
  fileName: string;
  sha256?: string | null;
  password?: string;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function parseRawTextTokens(rawItems: readonly RawPdfTextItem[]): SpatialPdfToken[] {
  return rawItems
    .filter(
      (item): item is RawPdfTextItem & { str: string } =>
        typeof item.str === "string" && item.str.trim() !== "",
    )
    .map((item) => {
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const fontSize = Math.hypot(transform[0] || 1, transform[1] || 0);
      return {
        str: item.str,
        x: transform[4] || 0,
        y: transform[5] || 0,
        width: item.width || 0,
        height: item.height || fontSize,
        fontSize,
      };
    });
}

function joinTokensAsPageText(tokens: readonly SpatialPdfToken[]): string {
  if (tokens.length === 0) return "";
  return groupTokensIntoLines([...tokens], 600, false)
    .map((l) => l.text)
    .join("\n");
}

/**
 * Abre o PDF exatamente 1 vez via `unpdf.getDocumentProxy`, compartilhando leitura textual,
 * extração espacial (X/Y) e renderização em canvas sem reabrir ou duplicar buffers.
 */
export async function openPdfDocumentSession(
  params: OpenPdfDocumentSessionParams,
): Promise<PdfDocumentSession> {
  const { buffer, fileName, sha256 = null } = params;
  let passwordRef: string | undefined = params.password;
  const unpdf = await import("unpdf");

  let proxy: PdfDocumentProxyLike | null = null;
  let fallbackPageTexts: string[] | null = null;
  let totalPages = 1;

  try {
    if (typeof unpdf.getDocumentProxy === "function") {
      const data = new Uint8Array(buffer.slice(0));
      const candidate = passwordRef
        ? await unpdf.getDocumentProxy(data, { password: passwordRef })
        : await unpdf.getDocumentProxy(data);
      if (candidate && typeof candidate.getPage === "function") {
        proxy = candidate as unknown as PdfDocumentProxyLike;
        totalPages = Math.max(1, proxy.numPages || 1);
      }
    }

    if (!proxy && typeof unpdf.extractText === "function") {
      const extracted = await unpdf.extractText(new Uint8Array(buffer.slice(0)), {
        mergePages: false,
      });
      fallbackPageTexts = Array.isArray(extracted.text)
        ? (extracted.text as string[]).map((p) => String(p ?? ""))
        : typeof extracted.text === "string"
          ? [extracted.text]
          : [];
      totalPages =
        typeof extracted.totalPages === "number" && extracted.totalPages > 0
          ? extracted.totalPages
          : Math.max(1, fallbackPageTexts.length);
    }
  } catch (err: unknown) {
    if (isPdfPasswordProtectedError(err)) throw new PdfPasswordProtectedError();
  }

  let disposed = false;
  let cachedPageTexts: string[] | null = fallbackPageTexts;
  const cachedPageData = new Map<
    number,
    { tokens: SpatialPdfToken[]; width: number; text: string }
  >();
  const cachedSpatialByMode = new Map<string, PdfSpatialExtractionResult>();
  const cachedBlobs = new Map<number, Blob | null>();

  const loadPageTokens = async (pageNum: number) => {
    const cached = cachedPageData.get(pageNum);
    if (cached) return cached;
    if (!proxy) return null;

    try {
      const page = await proxy.getPage(pageNum);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const tokens = parseRawTextTokens((content.items || []) as unknown as RawPdfTextItem[]);
        const entry = { tokens, width: viewport.width || 600, text: joinTokensAsPageText(tokens) };
        cachedPageData.set(pageNum, entry);
        return entry;
      } finally {
        page.cleanup?.();
      }
    } catch (err: unknown) {
      if (isPdfPasswordProtectedError(err)) throw new PdfPasswordProtectedError();
      return null;
    }
  };

  return {
    fileName,
    sha256,
    totalPages,
    getTotalPages: () => totalPages,
    getBuffer: () => buffer,
    extractPageTexts: async () => {
      if (cachedPageTexts) return cachedPageTexts;
      if (!proxy || disposed) return [];
      const texts: string[] = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageEntry = await loadPageTokens(pageNum);
        texts.push(pageEntry?.text ?? "");
      }
      cachedPageTexts = texts;
      return texts;
    },
    extractSpatialPages: async (options) => {
      const colMode = options?.columnMode ?? "auto";
      const existing = cachedSpatialByMode.get(colMode);
      if (existing) return existing;
      if (!proxy || disposed) {
        return { lines: [], usedTwoColumnMode: false, totalPages };
      }

      const allLines: SpatialPdfLine[] = [];
      let usedTwoColumnMode = false;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const entry = await loadPageTokens(pageNum);
        if (!entry) continue;

        let gutterX: number | undefined;
        let isBimodal = false;
        if (colMode === "bimodal") {
          isBimodal = true;
          gutterX = findBimodalGutterX(entry.tokens, entry.width) ?? entry.width * 0.5;
        } else if (colMode === "auto") {
          const detected = findBimodalGutterX(entry.tokens, entry.width);
          if (detected !== null) {
            isBimodal = true;
            gutterX = detected;
          }
        }
        if (isBimodal) usedTwoColumnMode = true;

        const pageLines = groupTokensIntoLines(
          entry.tokens,
          entry.width,
          isBimodal,
          gutterX,
        ).map((l) => ({ ...l, pageNumber: pageNum }));
        allLines.push(...pageLines);
      }

      const result = { lines: allLines, usedTwoColumnMode, totalPages };
      cachedSpatialByMode.set(colMode, result);
      return result;
    },
    renderPageToBlob: async (pageNumber: number) => {
      if (disposed || pageNumber < 1 || pageNumber > totalPages) return null;
      if (cachedBlobs.has(pageNumber)) {
        return cachedBlobs.get(pageNumber) ?? null;
      }

      let renderedBlob: Blob | null = null;
      if (typeof document !== "undefined" && proxy) {
        const probeCanvas = document.createElement("canvas");
        const hasCanvas2d = Boolean(probeCanvas.getContext("2d"));

        if (hasCanvas2d) {
          try {
            const page = await proxy.getPage(pageNumber);
            try {
              const baseViewport = page.getViewport({ scale: 1 });
              const largestSide = Math.max(baseViewport.width, baseViewport.height, 1);
              const scale = Math.min(2, PDF_RENDER_MAX_DIMENSION / largestSide);
              const viewport = page.getViewport({ scale });

              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.round(viewport.width));
              canvas.height = Math.max(1, Math.round(viewport.height));
              const context = canvas.getContext("2d");
              if (context) {
                await page.render({ canvasContext: context, canvas, viewport }).promise;
                const blob = await canvasToPngBlob(canvas);
                if (blob && blob.size > 0) {
                  renderedBlob = blob;
                }
              }
            } finally {
              page.cleanup?.();
            }
          } catch {
            renderedBlob = null;
          }
          cachedBlobs.set(pageNumber, renderedBlob);
          return renderedBlob;
        }
      }

      renderedBlob = await renderScannedPdfPageToBlob(
        buffer,
        pageNumber,
        passwordRef ? { password: passwordRef } : undefined,
      );
      cachedBlobs.set(pageNumber, renderedBlob);
      return renderedBlob;
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      passwordRef = undefined;
      cachedPageTexts = null;
      cachedPageData.clear();
      cachedSpatialByMode.clear();
      cachedBlobs.clear();
      if (proxy) {
        const activeProxy = proxy;
        proxy = null;
        try {
          await activeProxy.cleanup?.();
          await activeProxy.loadingTask?.destroy?.();
        } catch {
          // Ignora falha na limpeza de worker PDF
        }
      }
    },
  };
}
