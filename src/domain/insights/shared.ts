/**
 * Fontes únicas de regras compartilhadas dos insights (F19).
 *
 * Antes havia 3 listas sobrepostas de categorias essenciais/agregadoras e
 * implementações duplicadas de normalização e tolerância de valores:
 *   • `normalizeServiceName` (subscriptions) vs `normalizeKey` (recurrences);
 *   • `hasStableValue` (±5%) vs `hasValuesWithin` (tolerância param);
 *   • `ESSENTIAL_CATEGORIES` (subscriptions) ∪ `AGGREGATING_CATEGORY_ICONS`
 *     (recurrences) duplicadas em `isEssentialIcon` (InsightsPage).
 * Tudo unificado aqui — uma única implementação, testada (testes de unificação).
 */

/** Essenciais (nunca cortáveis — subscriptions) ∪ agregadoras (excluídas da detecção `similar` — recurrences). */
export const ESSENTIAL_CATEGORY_ICONS = new Set([
  // Essenciais (§3.7.2 — tier `essential` por categoria).
  "moradia",
  "saude",
  "educacao",
  // Agregadoras (§3.7.3 — excluídas da detecção `similar`).
  "mercado",
  "supermercado",
  "combustivel",
  "transporte",
  "farmacia",
]);

/**
 * Normalização canônica de texto: minúsculas, sem acentos, espaços
 * colapsados e aparados. Unifica `normalizeServiceName`/`normalizeKey`.
 */
export function normalizeText(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove tudo que não for letra/número — usado pelo catálogo de serviços. */
export function normalizeServiceKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9]/g, "");
}

/**
 * Remove sufixos e prefixos temporais (meses, anos, referências, competências, parcelas)
 * de descrições de despesas, permitindo que repetições como "Condomínio Jan" e
 * "Condomínio Fev" compartilhem o mesmo nome base higienizado.
 */
export function stripTemporalSuffixes(text: string): string {
  if (!text || !text.trim()) return "";

  let cleaned = text;

  // 1. Competência / Referência (ex: "ref. 08/26", "ref 08", "competencia 09", "comp. janeiro/2026")
  cleaned = cleaned.replace(
    /\b(?:ref(?:erencia)?|comp(?:etencia)?)\.?\s*(?:de\s+)?(?:\d{1,2}(?:[/-]\d{2,4})?|[a-zà-ú]{3,9}(?:[/-]\d{2,4})?)\b/gi,
    " ",
  );

  // 2. Parcelas explícitas (ex: "parcela 1/12", "parc. 2 de 10", "parc 01/06")
  cleaned = cleaned.replace(/\bparc(?:ela)?\.?\s*\d+\s*(?:\/|de)\s*\d+\b/gi, " ");

  // 3. Meses combinados com ano (ex: "jan/26", "janeiro/2026", "fev 2026", "mar-26", "março/26")
  const monthNames =
    "jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?";
  const monthYearRegex = new RegExp(`\\b(?:${monthNames})[\\s/-]+(?:20)?\\d{2}\\b`, "gi");
  cleaned = cleaned.replace(monthYearRegex, " ");

  // 4. Formatos de data numérica como MM/AA, MM/AAAA, AAAA/MM (ex: "01/26", "12/2026", "2026/01")
  cleaned = cleaned.replace(/\b(?:0?[1-9]|1[0-2])[/-](?:20)?\d{2}\b/g, " ");
  cleaned = cleaned.replace(/\b20\d{2}[/-](?:0?[1-9]|1[0-2])\b/g, " ");

  // 5. Frações que parecem parcelas no fim ou isoladas (ex: " 1/12", " 02/10")
  cleaned = cleaned.replace(/\b\d{1,2}\/\d{1,2}\b/g, " ");

  // 6. Meses isolados (ex: "Condomínio Jan", "Aluguel Março", "Plano Fev")
  const isolatedMonthRegex = new RegExp(`\\b(?:${monthNames})\\b`, "gi");
  cleaned = cleaned.replace(isolatedMonthRegex, " ");

  // 7. Anos isolados de 4 dígitos entre 2000 e 2099 (ex: "2025", "2026")
  cleaned = cleaned.replace(/\b20\d{2}\b/g, " ");

  // 8. Limpar pontuações e delimitadores residuais soltos (- / . : , ; #)
  cleaned = cleaned
    .replace(/[\s\-_/.:,;|#]+$/g, "")
    .replace(/^[\s\-_/.:,;|#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Fallback: se apagou tudo (ex: o usuário só digitou "2026" ou "Jan"), preserva o original aparado
  return cleaned || text.trim();
}

/**
 * Divide o texto normalizado em tokens alfanuméricos (palavras).
 */
export function tokenizeText(name: string): string[] {
  const normalized = normalizeText(name);
  return normalized.split(/[^a-z0-9]+/g).filter(Boolean);
}

/**
 * Verifica se o nome da despesa corresponde com segurança a uma chave do catálogo.
 * Para chaves curtas (<= 3 caracteres, ex.: 'oi', 'tim', 'max', 'uol', 'sky'),
 * exige token exato isolado para evitar falsos positivos com 'maxxi', 'biscoito', 'estimativa'.
 * Para chaves mais longas (ex.: 'netflix', 'smartfit', 'disneyplus'), permite token ou junção de tokens.
 */
export function matchesServiceKey(name: string, serviceKey: string): boolean {
  const cleanKey = normalizeServiceKey(serviceKey);
  if (!cleanKey) return false;

  const tokens = tokenizeText(name);
  if (tokens.length === 0) return false;

  // Chaves curtas (<= 3 caracteres) exigem casamento exato de token isolado.
  if (cleanKey.length <= 3) {
    return tokens.includes(cleanKey);
  }

  // Chave igual a algum token (ex.: 'netflix', 'spotify').
  if (tokens.includes(cleanKey)) {
    return true;
  }

  // Nome compacto contém a chave (ex.: 'Smart Fit' -> 'smartfit' contém 'smartfit', 'Disney+' -> 'disneyplus').
  const compactName = normalizeServiceKey(name);
  if (compactName.includes(cleanKey)) {
    return true;
  }

  return false;
}

/**
 * Todos os valores dentro da tolerância relativa ao primeiro.
 * Unifica `hasStableValue`/`hasValuesWithin` — uma única verificação.
 */
export function valuesWithinTolerance(values: readonly number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const base = values[0] ?? 0;
  if (base <= 0) return false;
  return values.every((value) => Math.abs(value - base) / base <= tolerance);
}

