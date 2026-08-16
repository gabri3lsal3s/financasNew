/**
 * Motor preditivo de entrada — FASE 21 (Inteligência de Entrada & Smart Flow).
 *
 * Heurísticas PURAS e locais (zero API extra, zero latência) que derivam, a
 * partir do HISTÓRICO do usuário: os **lançamentos habituais** (favoritos/
 * templates para preenchimento em 1 toque — passo 1 do wizard) e as
 * **sugestões de descrição** (chips de autocomplete rápido — passo de
 * detalhes). O clique em uma sugestão de descrição atualiza APENAS o campo
 * de descrição (hotfix — nunca sobrescreve valor/data/forma já preenchidos).
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
  /** Data ISO (YYYY-MM-DD) — usada para ponderação por recência e janela do mês. */
  date: string;
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

/** Sugestão de descrição (chip de autocomplete rápido — hotfix). */
export interface DescriptionSuggestion {
  /** Descrição real do histórico (nunca o rótulo da categoria selecionada). */
  description: string;
  /** Quantas vezes apareceu no histórico. */
  frequency: number;
  /** Recência do lançamento mais recente do grupo (0–1). */
  recency: number;
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

/** Dia do mês (1–31) de uma data ISO. */
export function dayOfMonth(iso: string): number {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 1;
  return date.getDate();
}

// ---------------------------------------------------------------------------
// Janela temporal de dias do mês (hotfix — Smart Matching)
// ---------------------------------------------------------------------------

/**
 * Distância circular entre dois dias do mês (mês comercial de 30 dias):
 * dia 1 e dia 30 distam 1 (fim de um mês = início do próximo, ex.: contas
 * recorrentes); o máximo é 15 (meio do mês).
 */
export function dayOfMonthDistance(a: number, b: number): number {
  const days = 30;
  const diff = Math.abs(((a - b) % days) + days) % days;
  return Math.min(diff, days - diff);
}

/**
 * Fator temporal 0–1 da janela de dias do mês (hotfix — Etapa 1):
 * registros históricos que costumam ocorrer a ±5 dias do dia de referência
 * da transação recebem peso máximo; a faixa ±5–±10 também recebe peso alto
 * (contas de início de mês, faturas na metade, despesas de fim de mês);
 * fora dessa janela o peso cai. Usado no ranqueamento dos habituais.
 */
export function monthWindowFactor(day: number, referenceDay: number): number {
  const distance = dayOfMonthDistance(day, referenceDay);
  if (distance <= 5) return 1;
  if (distance <= 10) return 0.85;
  return 0.4;
}

// ---------------------------------------------------------------------------
// Lançamentos habituais (favoritos/templates) — Etapa 1 do wizard
// ---------------------------------------------------------------------------

export interface HabitualEntryOptions {
  /** Máximo de sugestões retornadas (hotfix: padrão 3). */
  limit?: number;
  /** Dia do mês de referência (1–31) da transação — janela temporal ±5–±10. */
  referenceDay?: number;
  /** Data de referência p/ recência (opcional — sem ela o ranque é por frequência). */
  todayISO?: string;
}

/**
 * Deriva os lançamentos habituais do histórico: agrupa por descrição
 * normalizada + categoria e ranqueia por relevância ponderada (hotfix):
 *
 *   score = frequência × fatorTemporal(dia do mês ±5–±10) × recência
 *
 * Despesas mais recentes com maior volume de repetição dentro da mesma faixa
 * de dias do mês lideram o ranking. Sem `referenceDay`/`todayISO`, o ranking
 * permanece por frequência pura (desempate: mais recente). Retorna top N
 * (padrão 3) — atalhos de preenchimento em 1 toque.
 */
export function buildHabitualEntries(
  history: readonly PredictionEntry[],
  kind: "expense" | "income",
  options: HabitualEntryOptions = {},
): HabitualEntry[] {
  const { limit = 3, referenceDay, todayISO } = options;
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
    .map((group) => {
      const temporal = referenceDay != null ? monthWindowFactor(dayOfMonth(group.entry.date), referenceDay) : 1;
      const recency = todayISO ? recencyFactor(group.entry.date, todayISO) : 1;
      return { group, score: group.count * temporal * recency };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.group.count !== a.group.count) return b.group.count - a.group.count;
      return a.group.entry.date < b.group.entry.date ? 1 : -1; // mais recente primeiro
    })
    .slice(0, limit)
    .map(({ group }) => ({
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

// ---------------------------------------------------------------------------
// Sugestões de descrição pura — Etapa 2 (detalhes) do wizard (hotfix)
// ---------------------------------------------------------------------------

export interface DescriptionSuggestionOptions {
  /** Máximo de chips retornados (hotfix: padrão 3). */
  limit?: number;
  /** Nome da categoria selecionada — descrições redundantes (só o nome) saem. */
  categoryName?: string | null;
  /** Texto digitado — filtra descrições cujos tokens contêm todos os do texto. */
  query?: string;
  /** Data de referência p/ recência (opcional — sem ela o ranque é por frequência). */
  todayISO?: string;
}

/**
 * Sugestões de descrição reais e semânticas do histórico (hotfix — Etapa 2):
 * agrupa por descrição normalizada, **elimina rótulos redundantes** que sejam
 * apenas o nome da categoria selecionada (ex.: "Alimentação") e ranqueia por
 * frequência × recência. Retorna até `limit` chips (padrão 3). O clique no
 * chip preenche APENAS a descrição — nunca toca em valor/data/forma (bug de
 * sobrescrita corrigido).
 */
export function buildDescriptionSuggestions(
  history: readonly PredictionEntry[],
  kind: "expense" | "income",
  options: DescriptionSuggestionOptions = {},
): DescriptionSuggestion[] {
  const { limit = 3, categoryName, query, todayISO } = options;
  const filtered = history.filter((entry) => entry.kind === kind && entry.description.trim() !== "");
  if (filtered.length === 0) return [];

  const categoryTokens = categoryName ? new Set(tokenize(categoryName)) : null;
  const normalizedQuery = query ? normalizeText(query) : "";
  const queryTokens = normalizedQuery ? new Set(tokenize(normalizedQuery)) : null;

  const groups = new Map<string, { entry: PredictionEntry; count: number }>();
  for (const entry of filtered) {
    // Filtro de relevância: descrições que são apenas o nome da categoria
    // selecionada (ex.: categoria "Alimentação" não gera o chip "Alimentação").
    if (categoryTokens && categoryTokens.size > 0) {
      const tokens = tokenize(entry.description);
      if (tokens.length > 0 && tokens.every((token) => categoryTokens.has(token))) continue;
    }
    const key = normalizeText(entry.description);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { entry, count: 1 });
      continue;
    }
    group.count += 1;
    if (entry.date > group.entry.date) group.entry = entry;
  }

  return [...groups.values()]
    .filter((group) => {
      if (!normalizedQuery) return true;
      const description = normalizeText(group.entry.description);
      // Autocomplete amigável: substring ("mercado" casa com "Supermercado…")
      // OU todos os tokens digitados contidos na descrição.
      if (description.includes(normalizedQuery)) return true;
      const descriptionTokens = new Set(tokenize(description));
      if (descriptionTokens.size === 0) return false;
      return queryTokens ? [...queryTokens].every((token) => descriptionTokens.has(token)) : true;
    })
    .map((group) => ({
      description: group.entry.description,
      frequency: group.count,
      recency: todayISO ? recencyFactor(group.entry.date, todayISO) : 0,
    }))
    .sort((a, b) => b.frequency - a.frequency || b.recency - a.recency)
    .slice(0, limit);
}
