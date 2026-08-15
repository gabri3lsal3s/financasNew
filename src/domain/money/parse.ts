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

// Formatação exibível (R$ 1.500,00) vive em `services/masks/money`
// (`formatCentsAsBRL`) — fonte única (DRY); não duplicar aqui.

/**
 * Helper canônico de conversão para centavos (F19).
 * Guarda `isFinite` — NaN/Infinity viram 0 (contrato único; antes havia
 * ~8 `toCents` locais divergentes, metade sem a guarda). Nunca lança.
 */
export function numberToCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}
