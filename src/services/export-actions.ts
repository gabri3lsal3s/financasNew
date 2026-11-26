import { Clipboard } from "@capacitor/clipboard";
import { getErrorMessage } from "@/services/errors/index";
import { blobToBase64, exportNativeFile, shareNativeText } from "@/services/native/native-export";
import { isNativePlatform } from "@/services/native/platform";
import { pushToast } from "@/services/toast";

/**
 * Ações de borda de exportação (F22) — suporte unificado Web/PWA + Android nativo (Capacitor).
 *
 * Na Web/PWA usa Blob + object URL; no APK Android envia os bytes codificados em Base64
 * ao plugin nativo (`NativeExportPlugin`) para salvar em `Downloads/Axir` e abrir o Share Sheet.
 */

export type ShareResult = "shared" | "copied" | "unsupported";

export interface DownloadFileOptions {
  /** Suprime toasts automáticos quando o componente chamador já exibe o próprio feedback. */
  silentToast?: boolean;
  /** Abre o Share Sheet nativo no Android após salvar o arquivo (padrão: true). */
  share?: boolean;
}

/** Sanitiza o nome do arquivo prevenindo path traversal e caracteres inválidos. */
export function sanitizeFilename(filename: string, defaultName = "export"): string {
  const clean = Array.from(filename)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\.\.[/\\]/g, "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
  return clean.length > 0 ? clean : defaultName;
}

/** Baixa ou exporta um Blob com nome de arquivo seguro em Web/PWA e no APK Android. */
export async function downloadBlob(
  filename: string,
  blob: Blob,
  options?: DownloadFileOptions,
): Promise<boolean> {
  const safeFilename = sanitizeFilename(filename);

  if (isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const res = await exportNativeFile({
        filename: safeFilename,
        mimeType: blob.type || "application/octet-stream",
        base64Data,
        share: options?.share ?? true,
      });

      if (!res.success) {
        if (!options?.silentToast) {
          pushToast({
            title: "Erro ao exportar arquivo",
            description: res.error ?? "Não foi possível exportar o arquivo no aparelho.",
            variant: "destructive",
          });
        }
        return false;
      }

      if (!options?.silentToast && res.savedToDownloads) {
        pushToast({
          title: "Arquivo exportado",
          description: "Salvo em Downloads/Axir e pronto para compartilhar.",
          variant: "success",
        });
      }
      return true;
    } catch (error) {
      if (!options?.silentToast) {
        pushToast({
          title: "Erro ao exportar arquivo",
          description: getErrorMessage(error) || "Não foi possível exportar o arquivo no aparelho.",
          variant: "destructive",
        });
      }
      return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Baixa ou exporta um arquivo de texto (Markdown, XLS SpreadsheetML, etc.). */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
  options?: DownloadFileOptions,
): Promise<boolean> {
  return downloadBlob(filename, new Blob([content], { type: mimeType }), options);
}

/** Baixa um CSV (garante prefixo BOM UTF-8 para abertura sem falhas de acentuação no Excel). */
export function downloadCsv(
  filename: string,
  csvContent: string,
  options?: DownloadFileOptions,
): Promise<boolean> {
  const contentWithBom = csvContent.startsWith("\uFEFF") ? csvContent : `\uFEFF${csvContent}`;
  const safeFilename = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  return downloadBlob(
    safeFilename,
    new Blob([contentWithBom], { type: "text/csv;charset=utf-8" }),
    options,
  );
}

/** Baixa um objeto JSON formatado. */
export function downloadJson(
  filename: string,
  payload: unknown,
  options?: DownloadFileOptions,
): Promise<boolean> {
  return downloadBlob(
    filename,
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    options,
  );
}

/**
 * Compartilha um texto via Share Sheet nativo (no APK Android) ou Web Share API.
 * Sem suporte, copia para o clipboard (resultado "copied"); sem clipboard, retorna "unsupported".
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (isNativePlatform()) {
    const shared = await shareNativeText(title, text);
    if (shared) {
      return "shared";
    }
    try {
      await Clipboard.write({ string: text });
      return "copied";
    } catch {
      // Tenta navigator.clipboard como último recurso
    }
  }

  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string }) => Promise<void>;
    canShare?: (data: { title?: string; text?: string }) => boolean;
  };

  if (typeof nav.share === "function" && (!nav.canShare || nav.canShare({ title, text }))) {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (error) {
      // Usuário cancelou o compartilhamento nativo — não é um erro.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "shared";
      }
      // Outra falha da share API → tenta fallback de clipboard.
    }
  }

  if (await copyTextToClipboard(text)) {
    return "copied";
  }
  return "unsupported";
}

/**
 * Copia texto para a área de transferência de forma resiliente, usando Clipboard API
 * com fallback automático via textarea temporário para navegadores embutidos (WhatsApp/Instagram).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continua para fallback via execCommand
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
