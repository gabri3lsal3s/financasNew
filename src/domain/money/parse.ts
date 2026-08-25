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

/**
 * Converte texto numérico (pt-BR ou internacional) para float não negativo.
 * Trata vírgulas, pontos decimais, percentuais e separadores de milhar com resiliência.
 *
 * Exemplos:
 *   "8,52"     -> 8.52
 *   "8.52"     -> 8.52
 *   "110"      -> 110
 *   "12,5%"    -> 12.5
 *   "1.234,56" -> 1234.56
 *   "1234.56"  -> 1234.56
 */
export function parseDecimalNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const trimmed = String(raw).trim().replace(/^R\$\s*/i, "").replace(/^\$\s*/, "").replace(/[%]/g, "").trim();
  if (!trimmed || trimmed === "-") return 0;

  // Se possui ponto e vírgula juntos (ex: 1.234,56)
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const clean = trimmed.replace(/\./g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui múltiplos pontos (ex: 1.000.000)
  if ((trimmed.match(/\./g) || []).length > 1) {
    const clean = trimmed.replace(/\./g, "");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui vírgula como separador decimal (ex: 8,52)
  if (trimmed.includes(",")) {
    const clean = trimmed.replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Se possui apenas ponto decimal ou número inteiro (ex: 8.52 ou 110)
  const val = Number(trimmed);
  return Number.isFinite(val) && val >= 0 ? val : 0;
}

/**
 * Formata um número decimal para exibição em input pt-BR amigável.
 * Mantém inteiros limpos (ex: 100 -> "100") e decimais com vírgula (ex: 8.52 -> "8,52").
 */
export function formatDecimalNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

