/**
 * Parsing de valores monetários — entrada livre do usuário → centavos.
 * Aceita formatos pt-BR: "R$ 1.500,00", "1.500,5", "1500", "0,01".
 */

const DECIMAL_PATTERN = /^\s*(?:R\$\s*)?([\d.]+(?:[.,]\d{1,2})?|\d+)\s*$/;

/** Converte texto monetário pt-BR em centavos; retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const match = DECIMAL_PATTERN.exec(input);
  if (!match) return null;

  const raw = match[1] ?? "";
  // Remove pontos de milhar e troca vírgula decimal por ponto.
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

/** Formata centavos como texto pt-BR (R$ 1.500,00) — espelha services/masks. */
export function centsToBRL(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
