import { registerPlugin } from "@capacitor/core";
import { getErrorMessage } from "@/services/errors/index";
import { isNativePlatform } from "./platform";

export interface NativePrintResult {
  success: boolean;
  error?: string;
}

export interface NativeExportFileOptions {
  filename: string;
  mimeType: string;
  base64Data: string;
  share?: boolean;
}

export interface NativeExportFileResult {
  success: boolean;
  fileName?: string;
  savedToDownloads?: boolean;
  shared?: boolean;
  error?: string;
}

export interface NativeShareTextResult {
  success: boolean;
  error?: string;
}

export interface NativeExportPluginInterface {
  printWebView(options: { jobName: string }): Promise<NativePrintResult>;
  exportFile(options: NativeExportFileOptions): Promise<NativeExportFileResult>;
  shareText(options: { title: string; text: string }): Promise<NativeShareTextResult>;
}

export const NativeExportPlugin = registerPlugin<NativeExportPluginInterface>("NativeExportPlugin", {
  web: {
    async printWebView() {
      return { success: false, error: "Impressão nativa disponível apenas no APK Android." };
    },
    async exportFile(options: NativeExportFileOptions) {
      return {
        success: false,
        fileName: options.filename,
        savedToDownloads: false,
        shared: false,
        error: "Exportação nativa disponível apenas no APK Android.",
      };
    },
    async shareText() {
      return { success: false, error: "Compartilhamento nativo disponível apenas no APK Android." };
    },
  },
});

const EXPORT_GRACE_WINDOW_MS = 2000;
const BASE64_CHUNK_SIZE = 0x8000; // 32 KB por bloco evita RangeError na stack ao chamar String.fromCharCode

let isExportOrPrintActive = false;
let exportGraceTimer: ReturnType<typeof setTimeout> | null = null;

function beginNativeExportGuard(): void {
  if (exportGraceTimer !== null) {
    clearTimeout(exportGraceTimer);
    exportGraceTimer = null;
  }
  isExportOrPrintActive = true;
}

function endNativeExportGuard(): void {
  if (exportGraceTimer !== null) {
    clearTimeout(exportGraceTimer);
  }
  exportGraceTimer = setTimeout(() => {
    isExportOrPrintActive = false;
    exportGraceTimer = null;
  }, EXPORT_GRACE_WINDOW_MS);
}

/**
 * Indica se há uma operação nativa de impressão (Print Spooler) ou Share Sheet em curso,
 * impedindo que o AppLock interprete a perda de foco da Activity como saída real do usuário.
 */
export function isNativeExportInProgress(): boolean {
  return isExportOrPrintActive;
}

/** Remove parâmetros como `;charset=utf-8` de MIME types antes de enviar ao MediaStore/Intent do Android. */
export function normalizeMimeType(mimeType?: string): string {
  if (!mimeType || !mimeType.trim()) {
    return "application/octet-stream";
  }
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return base.length > 0 ? base : "application/octet-stream";
}

/** Remove extensão `.pdf` (case-insensitive) do título de trabalho enviado ao PrintManager do Android. */
export function stripPdfExtension(title?: string): string {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return "Relatorio_Axir";
  const withoutExt = trimmed.replace(/\.pdf$/i, "").trim();
  return withoutExt.length > 0 ? withoutExt : "Relatorio_Axir";
}

/** Converte `Uint8Array` para Base64 em blocos de 32 KB para suportar arquivos grandes sem stack overflow. */
export function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const slice = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    let block = "";
    for (let i = 0; i < slice.length; i++) {
      block += String.fromCharCode(slice[i]!);
    }
    chunks.push(block);
  }
  return btoa(chunks.join(""));
}

/** Converte um `Blob` para string Base64 usando `arrayBuffer()` com fallback para `FileReader`. */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function") {
    const buffer = await blob.arrayBuffer();
    return bytesToBase64(new Uint8Array(buffer));
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Falha ao ler os bytes do arquivo para exportação."));
    };
    reader.readAsDataURL(blob);
  });
}

/** Dispara o PrintManager nativo do Android usando a WebView atual (respeitando @media print e .print-sheet). */
export async function printCurrentWebView(jobName?: string): Promise<NativePrintResult> {
  if (!isNativePlatform()) {
    return { success: false, error: "Impressão nativa disponível apenas no aplicativo Android." };
  }

  beginNativeExportGuard();
  try {
    const cleanJobName = stripPdfExtension(jobName);
    return await NativeExportPlugin.printWebView({ jobName: cleanJobName });
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error) || "Não foi possível abrir a impressão nativa no aparelho.",
    };
  } finally {
    endNativeExportGuard();
  }
}

/** Exporta um arquivo codificado em Base64 para `Downloads/Axir` e abre o Share Sheet nativo do Android. */
export async function exportNativeFile(options: NativeExportFileOptions): Promise<NativeExportFileResult> {
  if (!isNativePlatform()) {
    return {
      success: false,
      fileName: options.filename,
      savedToDownloads: false,
      shared: false,
      error: "Exportação nativa disponível apenas no aplicativo Android.",
    };
  }

  beginNativeExportGuard();
  try {
    return await NativeExportPlugin.exportFile({
      ...options,
      mimeType: normalizeMimeType(options.mimeType),
      share: options.share ?? true,
    });
  } catch (error) {
    return {
      success: false,
      fileName: options.filename,
      savedToDownloads: false,
      shared: false,
      error: getErrorMessage(error) || "Não foi possível exportar o arquivo no aparelho.",
    };
  } finally {
    endNativeExportGuard();
  }
}

/** Abre o Share Sheet nativo do Android para compartilhamento de texto plano. */
export async function shareNativeText(title: string, text: string): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }

  beginNativeExportGuard();
  try {
    const res = await NativeExportPlugin.shareText({ title, text });
    return Boolean(res.success);
  } catch {
    return false;
  } finally {
    endNativeExportGuard();
  }
}
