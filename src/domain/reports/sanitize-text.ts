/**
 * Sanitização e Normalização Tipográfica para Relatórios e Impressão (A4/PDF).
 *
 * Normaliza caracteres tipográficos não-ASCII (hífens especiais, travessões,
 * espaços sem quebra, caracteres invisíveis) que causam artefatos de renderização
 * ou glifos corrompidos (como o símbolo ) nos motores de impressão de navegadores.
 */

// Regex para traços e hífens Unicode especiais:
// \u2010 (Hyphen), \u2011 (Non-Breaking Hyphen), \u2012 (Figure Dash),
// \u2013 (En Dash), \u2014 (Em Dash), \u2015 (Horizontal Bar), \u2212 (Minus Sign)
const UNICODE_DASHES_REGEX = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

// Regex para espaços especiais Unicode:
// \u00A0 (Non-breaking space), \u202F (Narrow no-break space), \u2007 (Figure space)
const UNICODE_SPACES_REGEX = /[\u00A0\u202F\u2007]/g;

// Regex para caracteres invisíveis / zero-width:
// \u200B (Zero-width space), \u200C (ZWNJ), \u200D (ZWJ), \uFEFF (BOM)
const INVISIBLE_CHARS_REGEX = /\u200B|\u200C|\u200D|\uFEFF/g;

/**
 * Sanitiza uma string para garantir impressão segura sem glifos ausentes ou caracteres corrompidos.
 *
 * @param text Texto de entrada (ticker, nome de ativo, setor, discriminação fiscal)
 * @returns Texto normalizado com ASCII seguro
 */
export function sanitizeReportText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .replace(UNICODE_DASHES_REGEX, "-")
    .replace(UNICODE_SPACES_REGEX, " ")
    .replace(INVISIBLE_CHARS_REGEX, "")
    .trim();
}
