/**
 * Máscaras para campos de cartão de crédito.
 */

/** Formata número de cartão agrupando em blocos de 4 dígitos. */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(" ");
}

/** Formata data de validade de cartão no padrão MM/AA. */
export function formatCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

/**
 * Detecta a bandeira provável do cartão pelo prefixo de dígitos (IIN/BIN).
 */
export function detectCardBrand(value: string): "Visa" | "Mastercard" | "Elo" | "Amex" | "Hipercard" | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  // Elo (prefixos comuns no Brasil)
  if (/^(4011|4389|5041|5067|5090|6277|6362|6363)/.test(digits)) {
    return "Elo";
  }
  // American Express (34 ou 37)
  if (/^3[47]/.test(digits)) {
    return "Amex";
  }
  // Hipercard (6062)
  if (/^6062/.test(digits)) {
    return "Hipercard";
  }
  // Visa (começa com 4)
  if (/^4/.test(digits)) {
    return "Visa";
  }
  // Mastercard (51-55 ou 2221-2720)
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/.test(digits)) {
    return "Mastercard";
  }

  return null;
}
