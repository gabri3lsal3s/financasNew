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
