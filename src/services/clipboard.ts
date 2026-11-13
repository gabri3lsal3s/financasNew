/**
 * Gateway central de Área de Transferência (Clipboard Service).
 *
 * Governança de Privacidade & Segurança (LGPD / PCI-DSS):
 * 1. Leitura EXCLUSIVAMENTE sob ação explícita e deliberada de toque do usuário.
 * 2. Proibido ler a área de transferência em montagem de componentes, focus, background ou polling.
 * 3. Não persiste texto bruto copiado em logs ou telemetria.
 */

export type ClipboardReadResult =
  | { status: "success"; text: string }
  | { status: "empty" }
  | { status: "permission_denied"; reason: string }
  | { status: "insecure_context"; reason: string }
  | { status: "unsupported"; reason: string };

/**
 * Lê o texto da área de transferência com tratamento robusto de permissões e contextos restritos.
 */
export async function readClipboardText(): Promise<ClipboardReadResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { status: "unsupported", reason: "Ambiente sem suporte a DOM / Window." };
  }

  // Validação de contexto seguro (HTTPS ou localhost)
  if (window.isSecureContext === false) {
    return {
      status: "insecure_context",
      reason: "A API de área de transferência exige conexão segura HTTPS.",
    };
  }

  if (!navigator.clipboard?.readText) {
    return {
      status: "unsupported",
      reason: "O navegador atual não suporta leitura programática de área de transferência.",
    };
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      return { status: "empty" };
    }
    return { status: "success", text: text.trim() };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: "permission_denied",
      reason: errorMsg || "Permissão negada pelo navegador ou pelo usuário.",
    };
  }
}

/**
 * Escreve um texto na área de transferência com tratamento seguro.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
