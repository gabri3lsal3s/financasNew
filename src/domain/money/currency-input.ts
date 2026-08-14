/**
 * Entrada monetária progressiva (padrão Nubank) — máquina de estados PURA.
 *
 * Regra central: a string de dígitos crus é interpretada como um inteiro de
 * CENTAVOS. O primeiro dígito digitado entra nos centavos e cada novo dígito
 * "desloca" o valor para a esquerda:
 *
 *   digitar "1"     -> 1 centavo   -> R$ 0,01
 *   digitar "5"     -> 15 centavos -> R$ 0,15
 *   digitar "0"     -> 150         -> R$ 1,50
 *   digitar "0"     -> 1500        -> R$ 15,00
 *   digitar "0"     -> 15000       -> R$ 150,00
 *   digitar "0"     -> 150000      -> R$ 1.500,00
 *
 * Backspace remove o último dígito (recuo na ordem inversa).
 * Sem dependências de UI — testável isoladamente (Vitest).
 */

/** Máximo de dígitos: compatível com numeric(12,2) => 9.999.999.999,99 (10 inteiros + 2 decimais). */
export const CURRENCY_INPUT_MAX_DIGITS = 12;

/** Extrai apenas dígitos de uma entrada crua (cobre colar texto formatado). */
export function extractDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CURRENCY_INPUT_MAX_DIGITS);
}

/** Acrescenta um dígito à direita (centavos), respeitando o limite. */
export function appendDigit(digits: string, digit: string): string {
  if (!/^\d$/.test(digit)) return digits;
  if (digits.length >= CURRENCY_INPUT_MAX_DIGITS) return digits;
  return digits + digit;
}

/** Backspace: remove o último dígito (recua para a direita). */
export function removeLastDigit(digits: string): string {
  return digits.slice(0, -1);
}

/** Interpreta a string de dígitos como valor em centavos (inteiro). */
export function centsFromDigits(digits: string): number {
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

/** Converte centavos para reais (number com até 2 casas). */
export function brlFromCents(cents: number): number {
  return cents / 100;
}

/** Converte centavos em string de dígitos (uso programático / reset). 0 → "" (R$ 0,00). */
export function digitsFromCents(cents: number, maxDigits = CURRENCY_INPUT_MAX_DIGITS): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return String(Math.round(cents)).slice(0, maxDigits);
}
