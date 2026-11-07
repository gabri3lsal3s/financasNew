import { getSupabaseEnv } from "@/lib/env";

/**
 * Converte um buffer de bytes para representação hexadecimal em minúsculas.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calcula o hash SHA-256 de uma string utilizando a Web Crypto API nativa do navegador.
 */
export async function computeTokenHash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Gera um token aleatório criptograficamente seguro para atalhos iOS/Webhooks.
 *
 * Formato: axq_<48 caracteres hexadecimais aleatórios>
 */
export async function generateNewQuickToken(): Promise<{
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
}> {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const rawToken = `axq_${hex}`;
  const tokenHash = await computeTokenHash(rawToken);
  const tokenPrefix = `axq_${hex.slice(0, 8)}…`;

  return {
    rawToken,
    tokenHash,
    tokenPrefix,
  };
}

/**
 * Retorna a URL pública canônica da Edge Function quick-expense.
 */
export function getQuickExpenseWebhookUrl(): string {
  try {
    const { url } = getSupabaseEnv();
    const cleanUrl = url.replace(/\/+$/, "");
    return `${cleanUrl}/functions/v1/quick-expense`;
  } catch {
    return "https://api.axisfinance.app/functions/v1/quick-expense";
  }
}
