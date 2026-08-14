/**
 * Busca global — ESPECIFICAÇÃO §3.9.
 *
 * Gatilho: query com ≥ 2 caracteres; busca em despesas, rendas, dívidas,
 * cartões e categorias.
 *
 *   • Normalização: remove acentos e converte para minúsculas;
 *   • Scoring por tipo de match: igual 100 / prefixo 85 / contém 60;
 *     match numérico (valor) 30; match de status (dívida) 40;
 *   • Bônus de recência logarítmico: mês atual +25, 1–2m +20, 3–4m +15,
 *     5–6m +10, 7–12m +5, 12m+ +0;
 *   • Limites: máx. 5 por tipo e 12 no total; ordenação por score desc;
 *   • Deep-link: cada resultado carrega a navegação (rota + params) para
 *     o registro com destaque visual (highlight + scroll) e mês correto.
 *
 * Motor puro — sem import de UI/Supabase; testável isoladamente.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SearchEntryType = "expense" | "income" | "debt" | "card" | "category";

export interface SearchEntry {
  id: string;
  type: SearchEntryType;
  /** Textos buscáveis (descrição, nome, categoria, forma, tipo…). */
  text: string[];
  /** Valor numérico em centavos (match numérico = 30). */
  amountCents?: number;
  /** Data (YYYY-MM-DD) — base do bônus de recência. */
  date?: string;
  /** Palavras de status (ex.: dívida "vencida") — match = +40. */
  statusWords?: string[];
  /** Rótulo principal exibido. */
  label: string;
  /** Rótulo secundário (categoria, data, forma…). */
  detail?: string;
  /** Deep-link: rota + params (ex.: /transacoes?month=…&q=…). */
  link: { path: string; params?: Record<string, string> };
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

export interface SearchLimits {
  /** Máximo de resultados por tipo (default 5). */
  maxPerType?: number;
  /** Máximo total de resultados (default 12). */
  maxTotal?: number;
}

// ---------------------------------------------------------------------------
// Normalização e scoring
// ---------------------------------------------------------------------------

/** Remove acentos e converte para minúsculas (matching §3.9). */
export function normalizeSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Score por tipo de match: igual 100 / prefixo 85 / contém 60. */
export function matchScore(query: string, haystack: string): number {
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 85;
  if (haystack.includes(query)) return 60;
  return 0;
}

/** Match numérico: dígitos da query batem com o valor em reais (30). */
export function numericMatchScore(query: string, amountCents: number): number {
  const queryDigits = query.replace(/\D/g, "");
  if (queryDigits.length < 2) return 0;
  const amount = String(Math.max(0, Math.round(amountCents / 100)));
  return amount.includes(queryDigits) ? 30 : 0;
}

/** Meses decorridos entre uma data (YYYY-MM-DD) e hoje (YYYY-MM-DD). */
export function monthsBetween(dateISO: string, today: string): number {
  const [year, month] = dateISO.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const diff = ((todayYear ?? 0) - (year ?? 0)) * 12 + ((todayMonth ?? 1) - (month ?? 1));
  return Math.max(0, diff);
}

/** Bônus de recência logarítmico (§3.9): mês atual +25 … 12m+ +0. */
export function recencyBonus(monthsAgo: number): number {
  if (monthsAgo === 0) return 25;
  if (monthsAgo <= 2) return 20;
  if (monthsAgo <= 4) return 15;
  if (monthsAgo <= 6) return 10;
  if (monthsAgo <= 12) return 5;
  return 0;
}

/** Score total de um registro: texto + numérico + status + recência. */
export function scoreSearchEntry(query: string, entry: SearchEntry, today: string): number {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return 0;

  let score = 0;
  for (const text of entry.text) {
    score = Math.max(score, matchScore(normalized, normalizeSearch(text)));
  }
  if (entry.amountCents !== undefined && numericMatchScore(normalized, entry.amountCents) > 0) {
    score += 30;
  }
  if (entry.statusWords !== undefined && entry.statusWords.some((word) => normalizeSearch(word).includes(normalized))) {
    score += 40;
  }
  // Bônus de recência só vale com um match base (texto/numérico/status) —
  // um registro recente sem correspondência não aparece só por ser novo.
  if (score > 0 && entry.date) {
    score += recencyBonus(monthsBetween(entry.date, today));
  }
  return score;
}

// ---------------------------------------------------------------------------
// Busca consolidada
// ---------------------------------------------------------------------------

/**
 * Executa a busca global: pontua todos os registros, aplica o bônus de
 * recência, respeita os limites (máx. por tipo e total) e ordena por score
 * decrescente (desempate alfabético). Query com < 2 caracteres → vazio.
 */
export function searchGlobal(
  query: string,
  entries: readonly SearchEntry[],
  today: string,
  limits: SearchLimits = {},
): SearchResult[] {
  const { maxPerType = 5, maxTotal = 12 } = limits;
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return [];

  const scored = entries
    .map((entry) => ({ entry, score: scoreSearchEntry(normalized, entry, today) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, "pt-BR"));

  const perType = new Map<SearchEntryType, number>();
  const results: SearchResult[] = [];
  for (const { entry, score } of scored) {
    if (results.length >= maxTotal) break;
    const count = perType.get(entry.type) ?? 0;
    if (count >= maxPerType) continue;
    perType.set(entry.type, count + 1);
    results.push({ entry, score });
  }
  return results;
}
