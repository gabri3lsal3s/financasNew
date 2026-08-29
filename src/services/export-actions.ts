/**
 * Ações de borda de exportação (F22) — DOM glue.
 *
 * `downloadFile`/`downloadCsv`/`downloadJson` usam Blob + object URL (sem
 * libs externas). `shareText` usa a Web Share API (`navigator.share`) quando
 * disponível, com fallback para clipboard — nunca lança (AbortError do
 * usuário é silenciado; sem share → retorna "unsupported").
 */

export type ShareResult = "shared" | "copied" | "unsupported";

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

/** Baixa um Blob com nome de arquivo (dispara o download nativo). */
function downloadBlob(filename: string, blob: Blob): void {
  const safeFilename = sanitizeFilename(filename);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Baixa um CSV (mime com BOM já embutido no conteúdo). */
export function downloadCsv(filename: string, csvContent: string): void {
  downloadBlob(filename, new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
}

/** Baixa um objeto JSON formatado. */
export function downloadJson(filename: string, payload: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
}

/**
 * Compartilha um texto via Web Share API. Sem suporte, copia para o
 * clipboard (resultado "copied"); sem clipboard, retorna "unsupported".
 * AbortError (usuário cancelou) é tratado como sucesso silencioso.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
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

  if (typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "unsupported";
    }
  }
  return "unsupported";
}
