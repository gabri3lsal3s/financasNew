/**
 * Utilitário de Geração e Validação de Tokens de Compartilhamento Seguro (token.ts).
 *
 * Gera tokens amigáveis para URL (URL-safe, alfanuméricos sem caracteres ambíguos)
 * para links curtos de racha de conta (/r/:token), orçamento familiar e metas.
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md seção 3).
 */

const SHARE_TOKEN_ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export const DEFAULT_SHARE_TOKEN_LENGTH = 10;
export const MIN_SHARE_TOKEN_LENGTH = 6;
export const MAX_SHARE_TOKEN_LENGTH = 64;

/**
 * Gera um token alfanumérico seguro para compartilhamento público.
 */
export function generateShareToken(length: number = DEFAULT_SHARE_TOKEN_LENGTH): string {
  if (!Number.isSafeInteger(length) || length < MIN_SHARE_TOKEN_LENGTH || length > MAX_SHARE_TOKEN_LENGTH) {
    throw new Error(
      `Tamanho do token deve ser um inteiro entre ${MIN_SHARE_TOKEN_LENGTH} e ${MAX_SHARE_TOKEN_LENGTH}.`,
    );
  }

  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let token = "";
  for (let i = 0; i < length; i++) {
    token += SHARE_TOKEN_ALPHABET[bytes[i]! % SHARE_TOKEN_ALPHABET.length];
  }
  return token;
}

/**
 * Valida se um valor é um token de compartilhamento bem formatado.
 */
export function isValidShareToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (trimmed.length < MIN_SHARE_TOKEN_LENGTH || trimmed.length > MAX_SHARE_TOKEN_LENGTH) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}
