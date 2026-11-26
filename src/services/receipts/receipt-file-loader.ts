import { cleanOcrText } from "@/domain/notifications/ocr-cleaner";
import { reconstructSpatialReceiptText, selectCandidateReceiptVisionPages } from "@/domain/notifications/receipt-spatial-normalizer";
import { detectFileKindFromBytes } from "@/domain/reconciliation/extractors/magic-bytes";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
} from "@/services/native/receipt-extractor";
import { openPdfDocumentSession, type PdfDocumentSession } from "@/services/pdf-session";

export const DEFAULT_COMPRESS_MAX_BYTES = 1.5 * 1024 * 1024;
export const DEFAULT_COMPRESS_MAX_DIMENSION = 2000;
export const DEFAULT_COMPRESS_QUALITY = 0.85;
const TALL_RECEIPT_ASPECT_RATIO = 2.2;
const TALL_RECEIPT_MAX_WIDTH = 1280;
const TALL_RECEIPT_MAX_HEIGHT = 4096;

const RASTER_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
] as const;

export interface CompressReceiptImageOptions {
  /** Tamanho máximo alvo em bytes antes de comprimir (padrão: 1,5 MB). */
  maxBytes?: number;
  /** Dimensão máxima de largura/altura em pixels (padrão: 2000px). */
  maxDimension?: number;
  /** Qualidade JPEG/WebP entre 0 e 1 (padrão: 0.85). */
  quality?: number;
}

export interface DetectedReceiptFileFormat {
  kind: "pdf" | "image" | "text" | "unsupported_svg" | "unsupported_archive" | "empty_file";
  hasPdfHeader: boolean;
  isRasterImage: boolean;
}

export function isRasterReceiptFileNameOrMime(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    return true;
  }
  const lowerName = file.name.trim().toLowerCase();
  return RASTER_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Inspeciona magic bytes e metadados do arquivo para classificar com segurança PDFs,
 * imagens (inclusive sem extensão no mobile/WhatsApp) e arquivos bloqueados (SVG/ZIP).
 */
export async function detectReceiptFileFormat(
  file: File,
): Promise<DetectedReceiptFileFormat> {
  const lowerName = file.name.trim().toLowerCase();
  const mime = file.type.trim().toLowerCase();

  if (mime === "image/svg+xml" || lowerName.endsWith(".svg")) {
    return { kind: "unsupported_svg", hasPdfHeader: false, isRasterImage: false };
  }

  let headBytes = new Uint8Array(0);
  try {
    if (typeof file.slice === "function") {
      const buf = await file.slice(0, 4096).arrayBuffer();
      headBytes = new Uint8Array(buf);
    }
  } catch {
    headBytes = new Uint8Array(0);
  }

  if (file.size === 0 && headBytes.byteLength === 0) {
    return { kind: "empty_file", hasPdfHeader: false, isRasterImage: false };
  }

  const hasPdfHeader =
    headBytes.length >= 5 &&
    headBytes[0] === 0x25 &&
    headBytes[1] === 0x50 &&
    headBytes[2] === 0x44 &&
    headBytes[3] === 0x46 &&
    headBytes[4] === 0x2d;

  const detected = detectFileKindFromBytes(headBytes, file.name || file.type);

  if (detected === "unsupported_archive") {
    return { kind: "unsupported_archive", hasPdfHeader: false, isRasterImage: false };
  }

  if (detected === "pdf" || hasPdfHeader || mime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return { kind: "pdf", hasPdfHeader, isRasterImage: false };
  }

  if (detected === "image" || isRasterReceiptFileNameOrMime(file)) {
    return { kind: "image", hasPdfHeader: false, isRasterImage: true };
  }

  return { kind: "text", hasPdfHeader: false, isRasterImage: false };
}

/**
 * Comprime e redimensiona imagens raster grandes (JPG/PNG/WebP) via canvas no navegador.
 * Para cupons fiscais longos/verticais (`height / width > 2.2`), preserva a largura útil
 * até 1280px para não destruir a legibilidade numérica de valores e CNPJs.
 */
export async function compressReceiptImageIfNeeded(
  file: File,
  options?: CompressReceiptImageOptions,
): Promise<File> {
  const maxBytes = options?.maxBytes ?? DEFAULT_COMPRESS_MAX_BYTES;
  const maxDimension = options?.maxDimension ?? DEFAULT_COMPRESS_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_COMPRESS_QUALITY;

  const isRasterImage = isRasterReceiptFileNameOrMime(file);

  if (
    !isRasterImage ||
    file.size <= maxBytes ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const isTallReceipt =
      bitmap.width > 0 && bitmap.height / bitmap.width > TALL_RECEIPT_ASPECT_RATIO;

    let scale = 1;
    if (isTallReceipt) {
      scale = Math.min(
        1,
        TALL_RECEIPT_MAX_WIDTH / Math.max(bitmap.width, 1),
        TALL_RECEIPT_MAX_HEIGHT / Math.max(bitmap.height, 1),
      );
    } else if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
      scale = maxDimension / Math.max(bitmap.width, bitmap.height);
    }

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), outputType, quality);
    });

    if (!compressedBlob || compressedBlob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = outputType === "image/webp" ? "webp" : "jpg";
    return new File([compressedBlob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export interface LoadedReceiptPdfSession {
  extractedText: string;
  pageTexts: string[];
  candidateVisionPages: number[];
  renderPrimaryVisionBlob: () => Promise<Blob | null>;
  dispose: () => Promise<void>;
}

/**
 * Abre um PDF real de comprovante/boleto/cupom 1 única vez via `openPdfDocumentSession`,
 * propagando `PdfPasswordProtectedError`, reconstruindo layout espacial X/Y e selecionando
 * a página mais relevante caso precise escalar para Vision.
 */
export async function loadReceiptPdfWithSession(
  file: File,
  sha256: string | null,
  password?: string,
): Promise<LoadedReceiptPdfSession | null> {
  let session: PdfDocumentSession | null = null;
  try {
    const buffer = await file.arrayBuffer();
    session = await openPdfDocumentSession({
      buffer,
      fileName: file.name,
      sha256,
      password,
    });

    const pageTexts = await session.extractPageTexts();
    const spatial = await session.extractSpatialPages({ columnMode: "single" });
    const spatialText = reconstructSpatialReceiptText(spatial.lines);
    const joinedPageText = pageTexts.join("\n").trim();
    const rawBestText =
      spatialText.length >= joinedPageText.length ? spatialText : joinedPageText;
    const extractedText = cleanOcrText(rawBestText).trim();
    const candidateVisionPages = selectCandidateReceiptVisionPages(
      pageTexts,
      session.getTotalPages(),
      2,
    );

    const activeSession = session;
    return {
      extractedText,
      pageTexts,
      candidateVisionPages,
      renderPrimaryVisionBlob: async () => {
        const targetPage = candidateVisionPages[0] ?? 1;
        return activeSession.renderPageToBlob(targetPage);
      },
      dispose: async () => {
        await activeSession.dispose();
      },
    };
  } catch (err: unknown) {
    if (session) {
      await session.dispose();
    }
    if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
      throw new PdfPasswordProtectedError();
    }
    return null;
  }
}
