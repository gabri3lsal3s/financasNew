import { cleanOcrText } from "@/domain/notifications/ocr-cleaner";
import { BankNotificationPlugin } from "./bank-listener";
import { isNativePlatform } from "./platform";
import { extractTextFromImageWeb } from "./web-ocr";

export const MAX_RECEIPT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MIN_DIGITAL_PDF_TEXT_LENGTH = 40;
const PDF_RENDER_MAX_DIMENSION = 2000;

/**
 * Converte um arquivo do navegador (File ou Blob) em string base64 pura (sem data prefix).
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      if (commaIndex !== -1) {
        resolve(result.slice(commaIndex + 1));
      } else {
        resolve(result);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function isReadablePdfTextChunk(chunk: string): boolean {
  const trimmed = chunk.trim();
  if (trimmed.length < 2) return false;

  let hasAlnum = false;
  let readableCount = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 8 || (code >= 14 && code <= 31) || code === 127) {
      return false;
    }
    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 192 && code <= 255)
    ) {
      hasAlnum = true;
      readableCount++;
    } else if (code >= 32 && code <= 126) {
      readableCount++;
    } else if (code === 9 || code === 10 || code === 13) {
      readableCount++;
    }
  }

  return hasAlnum && readableCount / trimmed.length >= 0.7;
}

/**
 * Extrai texto legível de streams embutidas de um arquivo PDF digital no navegador
 * com fallback leve caso o módulo principal não esteja disponível.
 */
export function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder("latin1");
  const rawString = textDecoder.decode(bytes);

  const textChunks: string[] = [];

  // 1. Extrai blocos literais entre parênteses em operadores de texto Tj ou TJ
  const tjRegex = /\(([^()]{2,})\)\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;

  while ((match = tjRegex.exec(rawString)) !== null) {
    const chunk = match[1]?.trim();
    if (chunk && isReadablePdfTextChunk(chunk)) {
      textChunks.push(chunk);
    }
  }

  // 2. Extrai arrays de texto TJ
  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawString)) !== null) {
    const inner = match[1] || "";
    const innerChunks = inner.match(/\(([^()]+)\)/g);
    if (innerChunks) {
      const line = innerChunks
        .map((c) => c.slice(1, -1))
        .join(" ")
        .trim();
      if (line && isReadablePdfTextChunk(line)) {
        textChunks.push(line);
      }
    }
  }

  // 3. Fallback: Procura padrões de texto e números monetários legíveis no arquivo
  if (textChunks.length === 0) {
    const plainMatches = rawString.match(
      /(?:R\$|Pix|Transfer[eê]ncia|Pagamento|Comprovante)[\s\S]{0,100}/gi,
    );
    if (plainMatches) {
      textChunks.push(...plainMatches.map((m) => m.trim()).filter(isReadablePdfTextChunk));
    }
  }

  return textChunks.join("\n");
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

export class PdfPasswordProtectedError extends Error {
  readonly code = "PDF_PASSWORD_PROTECTED";
  constructor(message = "O arquivo PDF está protegido por senha.") {
    super(message);
    this.name = "PdfPasswordProtectedError";
  }
}

export function isPdfPasswordProtectedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return (
    e.name === "PasswordException" ||
    e.name === "PdfPasswordProtectedError" ||
    (typeof e.message === "string" && /password/i.test(e.message))
  );
}

/**
 * Renderiza a primeira página de um PDF escaneado em PNG Blob via `unpdf` (`getDocumentProxy` + `<canvas>`),
 * com fallback automático para `extractImages` quando necessário.
 */
export async function renderScannedPdfPageToBlob(
  buffer: ArrayBuffer,
  pageNumber = 1,
): Promise<Blob | null> {
  if (typeof document === "undefined" || pageNumber < 1) {
    return null;
  }

  const unpdf = await import("unpdf");

  // Estratégia 1: renderização fiel da página solicitada em <canvas> com canvasContext 2D
  try {
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer.slice(0)));
    try {
      if (pageNumber > pdf.numPages) {
        return null;
      }
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const largestSide = Math.max(baseViewport.width, baseViewport.height, 1);
      const scale = Math.min(2, PDF_RENDER_MAX_DIMENSION / largestSide);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d");
      if (!context) return null;

      // PDF.js v4+/v6+ exige canvasContext explicitamente para chamar ctx.save() sem TypeError
      await (
        (page.render as unknown as (params: {
          canvasContext: CanvasRenderingContext2D;
          canvas?: HTMLCanvasElement | null;
          viewport: unknown;
        }) => { promise: Promise<unknown> })
      )({
        canvasContext: context,
        canvas,
        viewport,
      }).promise;
      page.cleanup();
      const renderedBlob = await canvasToPngBlob(canvas);
      if (renderedBlob && renderedBlob.size > 0) {
        return renderedBlob;
      }
    } finally {
      try {
        await pdf.cleanup();
        await pdf.loadingTask?.destroy();
      } catch {
        // Ignora erro ao liberar recursos do documento PDF
      }
    }
  } catch (err: unknown) {
    if (isPdfPasswordProtectedError(err)) {
      throw new PdfPasswordProtectedError();
    }
    // Segue para fallback de extração direta de imagens embutidas
  }

  // Estratégia 2: extração da maior imagem embutida na página solicitada via unpdf.extractImages
  try {
    const images = await unpdf.extractImages(new Uint8Array(buffer.slice(0)), pageNumber);
    const largest = images
      .filter((img) => img.width >= 200 && img.height >= 200)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];

    if (!largest) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = largest.width;
    canvas.height = largest.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const pixelCount = largest.width * largest.height;
    const rgba = new Uint8ClampedArray(pixelCount * 4);

    if (largest.channels === 4) {
      rgba.set(largest.data.subarray(0, pixelCount * 4));
    } else if (largest.channels === 3) {
      for (let i = 0; i < pixelCount; i++) {
        rgba[i * 4] = largest.data[i * 3] ?? 0;
        rgba[i * 4 + 1] = largest.data[i * 3 + 1] ?? 0;
        rgba[i * 4 + 2] = largest.data[i * 3 + 2] ?? 0;
        rgba[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < pixelCount; i++) {
        const gray = largest.data[i] ?? 0;
        rgba[i * 4] = gray;
        rgba[i * 4 + 1] = gray;
        rgba[i * 4 + 2] = gray;
        rgba[i * 4 + 3] = 255;
      }
    }

    const imageData = new ImageData(rgba, largest.width, largest.height);
    ctx.putImageData(imageData, 0, 0);
    return await canvasToPngBlob(canvas);
  } catch {
    return null;
  }
}

export interface ExtractReceiptFileOptions {
  /** Pula OCR local no navegador para delegar imagens/PDFs escaneados diretamente ao Vision. */
  skipWebImageOcr?: boolean;
}

/**
 * Pipeline unificado de leitura de PDF (Web/PWA e Android):
 * 1. Tenta sempre extração de texto digital via `unpdf` (< 30ms) antes de qualquer OCR.
 * 2. Se texto < 40 caracteres (PDF escaneado):
 *    - No Android nativo: delega ao ReceiptOcrHelper (PdfRenderer + ML Kit).
 *    - Na Web/PWA: renderiza página em <canvas> e passa ao OCR local (ou pula se `skipWebImageOcr: true`).
 */
async function extractPdfTextUnified(
  file: File,
  options?: ExtractReceiptFileOptions,
): Promise<string> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return "";
  }

  let digitalText: string;
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer.slice(0)), { mergePages: true });
    digitalText = Array.isArray(result.text)
      ? result.text.join("\n").trim()
      : String(result.text ?? "").trim();
  } catch (err: unknown) {
    if (isPdfPasswordProtectedError(err)) {
      throw new PdfPasswordProtectedError();
    }
    digitalText = "";
  }

  if (digitalText.length < MIN_DIGITAL_PDF_TEXT_LENGTH) {
    const rawFallback = extractTextFromPdfArrayBuffer(buffer).trim();
    if (rawFallback.length > digitalText.length) {
      digitalText = rawFallback;
    }
  }

  if (digitalText.length >= MIN_DIGITAL_PDF_TEXT_LENGTH) {
    return digitalText;
  }

  // PDF escaneado (camada de texto insuficiente)
  if (isNativePlatform()) {
    try {
      const base64Data = await fileToBase64(file);
      const res = await BankNotificationPlugin.extractTextFromReceipt({
        base64Data,
        mimeType: "application/pdf",
      });
      const nativeText = res?.text?.trim() ?? "";
      if (nativeText.length > digitalText.length) {
        return nativeText;
      }
    } catch {
      // Fallback silencioso para renderização web caso o plugin falhe
    }
  } else if (!options?.skipWebImageOcr) {
    const pageBlob = await renderScannedPdfPageToBlob(buffer);
    if (pageBlob) {
      const ocrText = (await extractTextFromImageWeb(pageBlob)).trim();
      if (ocrText.length > digitalText.length) {
        return ocrText;
      }
    }
  }

  return digitalText;
}

/**
 * Extrai o texto contido em um arquivo de comprovante (PDF ou imagem):
 * - PDF digital (Web, PWA ou Android): extrai streams digitais via `unpdf` primeiro.
 * - PDF escaneado (< 40 chars): PdfRenderer + ML Kit no Android; <canvas> + OCR na Web/PWA (se não pulado).
 * - Imagem: ML Kit no Android nativo (fallback Web) e Tesseract.js com pré-processamento na Web/PWA.
 * - Em qualquer plataforma: higieniza e repara ruídos com cleanOcrText.
 */
export async function extractReceiptTextFromFile(
  file: File,
  options?: ExtractReceiptFileOptions,
): Promise<string> {
  if (file.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
    throw new Error("O arquivo excede o limite máximo permitido de 15 MB.");
  }

  const lowerName = file.name.toLowerCase();
  if (file.type === "image/svg+xml" || lowerName.endsWith(".svg")) {
    throw new Error("Formato SVG não suportado para leitura de comprovantes.");
  }

  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage =
    file.type.startsWith("image/") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".avif") ||
    lowerName.endsWith(".bmp") ||
    lowerName.endsWith(".gif") ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif");

  let extractedRaw = "";

  if (isPdf) {
    extractedRaw = await extractPdfTextUnified(file, options);
  } else if (isImage) {
    if (isNativePlatform()) {
      try {
        const base64Data = await fileToBase64(file);
        const res = await BankNotificationPlugin.extractTextFromReceipt({
          base64Data,
          mimeType: file.type || "image/jpeg",
        });
        if (res?.text && res.text.trim().length > 0) {
          extractedRaw = res.text.trim();
        }
      } catch {
        // Fallback para OCR Web
      }
    }
    if (!extractedRaw && !options?.skipWebImageOcr) {
      extractedRaw = await extractTextFromImageWeb(file);
    }
  } else if (file.type.startsWith("text/")) {
    try {
      extractedRaw = (await file.text()).trim();
    } catch {
      extractedRaw = "";
    }
  }

  // Normaliza ruídos de OCR e substituições ópticas antes de repassar aos motores semânticos
  return cleanOcrText(extractedRaw);
}
