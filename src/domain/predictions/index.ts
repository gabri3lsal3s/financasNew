/**
 * Motor preditivo de entrada — FASE 21 (Inteligência de Entrada & Smart Flow).
 *
 * Heurísticas PURAS e locais (zero API extra, zero latência) que inferem os
 * campos de um lançamento a partir da descrição digitada e do HISTÓRICO do
 * usuário: categoria, forma de pagamento, cartão e valor. Também deriva os
 * "lançamentos habituais" (favoritos/templates) para preenchimento em 1 toque.
 *
 * Motor puro — testável isoladamente; a UI só formata e aplica os resultados.
 */

export interface PredictionEntry {
  id: string;
  kind: "expense" | "income";
  /** Descrição do lançamento (vazia quando o usuário não informou). */
  description: string;
  /** Categoria selecionada (id). */
  categoryId: string;
  /** Nome da categoria (para exibição — resolvido pelo chamador). */
  categoryName: string;
  paymentMethod: string | null;
  cardId: string | null;
  receiveType: string | null;
  /** Valor em reais. */
  value: number;
  /** Data ISO (YYYY-MM-DD) — usada para ponderação por recência. */
  date: string;
}

/** Sugestão preditiva de um lançamento a partir da descrição. */
export interface PredictionSuggestion {
  categoryId: string;
  categoryName: string;
  paymentMethod: string | null;
  cardId: string | null;
  receiveType: string | null;
  /** Valor médio ponderado por recência (reais). */
  value: number;
  /** Confiança 0–1 (similaridade × recência). */
  confidence: number;
}

/** Lançamento habitual (favorito/template) derivado do histórico. */
export interface HabitualEntry {
  kind: "expense" | "income";
  /** Descrição mais frequente do grupo. */
  description: string;
  categoryId: string;
  categoryName: string;
  paymentMethod: string | null;
  cardId: string | null;
  receiveType: string | null;
  /** Valor mais recente do grupo (reais). */
  value: number;
  /** Quantas vezes apareceu no histórico. */
  frequency: number;
}

// ---------------------------------------------------------------------------
// Normalização e tokenização
// ---------------------------------------------------------------------------

/** Remove acentos e normaliza para minúsculas (base da comparação). */
export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Divide a descrição em tokens (palavras ≥ 2 chars, sem pontuação). */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

/**
 * Similaridade de Jaccard entre dois conjuntos de tokens (0–1).
 * 1 = mesmos tokens; 0 = nenhum token em comum. Descrições sem tokens
 * retornam 0 (nunca similar por acaso).
 */
export function jaccardTokens(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/** Fator de recência 0–1: lançamentos recentes pesam mais (janela de ~90 dias). */
export function recencyFactor(dateISO: string, todayISO: string, windowDays = 90): number {
  const date = new Date(`${dateISO}T00:00:00`);
  const today = new Date(`${todayISO}T00:00:00`);
  const diffDays = (today.getTime() - date.getTime()) / 86_400_000;
  if (diffDays < 0) return 1; // datas futuras (agendado) contam como recentes
  return Math.max(0, 1 - diffDays / windowDays);
}

// ---------------------------------------------------------------------------
// Predição por descrição
// ---------------------------------------------------------------------------

/**
 * Prediz os campos de um lançamento a partir da descrição digitada.
 *
 * Estratégia: agrupa o histórico por (categoria, forma, cartão), calcula a
 * similaridade máxima de tokens entre a query e as descrições do grupo e
 * pondera pela recência — o grupo mais parecido vence. Retorna os grupos
 * ordenados por confiança (top 3). Valor = média ponderada por recência.
 */
export function predictFromHistory(
  history: readonly PredictionEntry[],
  query: string,
  kind: "expense" | "income",
  todayISO: string,
): PredictionSuggestion[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const filtered = history.filter((entry) => entry.kind === kind && entry.description.trim() !== "");
  if (filtered.length === 0) return [];

  // Agrupa por (categoria, forma, cartão).
  const groups = new Map<string, { entry: PredictionEntry; count: number; bestSimilarity: number; weightedValue: number; weightSum: number }>();
  for (const entry of filtered) {
    const key = `${entry.categoryId}|${entry.paymentMethod ?? ""}|${entry.cardId ?? ""}|${entry.receiveType ?? ""}`;
    const similarity = jaccardTokens(queryTokens, tokenize(entry.description));
    const recency = recencyFactor(entry.date, todayISO);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        entry,
        count: 1,
        bestSimilarity: similarity,
        weightedValue: entry.value * recency,
        weightSum: recency,
      });
      continue;
    }
    group.count += 1;
    group.bestSimilarity = Math.max(group.bestSimilarity, similarity);
    group.weightedValue += entry.value * recency;
    group.weightSum += recency;
  }

  const suggestions = [...groups.values()]
    .filter((group) => group.bestSimilarity > 0)
    .map((group) => {
      // Confiança = similaridade × log1p(frequência) × recência média (0–1).
      const avgRecency = group.weightSum > 0 ? group.weightSum / group.count : 0;
      const frequencyBonus = Math.min(1, Math.log1p(group.count) / Math.log1p(10));
      const confidence = group.bestSimilarity * (0.6 + 0.4 * frequencyBonus) * (0.7 + 0.3 * avgRecency);
      return {
        categoryId: group.entry.categoryId,
        categoryName: group.entry.categoryName,
        paymentMethod: group.entry.paymentMethod,
        cardId: group.entry.cardId,
        receiveType: group.entry.receiveType,
        value: group.weightSum > 0 ? group.weightedValue / group.weightSum : group.entry.value,
        confidence: Math.min(1, Math.round(confidence * 100) / 100),
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return suggestions;
}

// ---------------------------------------------------------------------------
// Lançamentos habituais (favoritos/templates)
// ---------------------------------------------------------------------------

/**
 * Deriva os lançamentos habituais do histórico: agrupa por descrição
 * normalizada + categoria e ordena por frequência (desempate: mais recente).
 * Retorna os top N — atalhos de preenchimento em 1 toque.
 */
export function buildHabitualEntries(
  history: readonly PredictionEntry[],
  kind: "expense" | "income",
  limit = 5,
): HabitualEntry[] {
  const filtered = history.filter((entry) => entry.kind === kind && entry.description.trim() !== "");
  const groups = new Map<string, { entry: PredictionEntry; count: number }>();
  for (const entry of filtered) {
    const key = `${normalizeText(entry.description)}|${entry.categoryId}|${entry.paymentMethod ?? ""}|${entry.cardId ?? ""}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { entry, count: 1 });
      continue;
    }
    group.count += 1;
    // Mantém o mais recente para o valor (data mais nova vence o grupo).
    if (entry.date > group.entry.date) group.entry = entry;
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || (a.entry.date < b.entry.date ? 1 : -1))
    .slice(0, limit)
    .map((group) => ({
      kind,
      description: group.entry.description,
      categoryId: group.entry.categoryId,
      categoryName: group.entry.categoryName,
      paymentMethod: group.entry.paymentMethod,
      cardId: group.entry.cardId,
      receiveType: group.entry.receiveType,
      value: group.entry.value,
      frequency: group.count,
    }));
}
