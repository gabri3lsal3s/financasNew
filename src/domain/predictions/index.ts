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
  /** Timestamp ISO de criação (opcional — para calibragem contextual por horário do dia). */
  createdAt?: string;
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
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 1;
  return date.getDate();
}

/** Dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado). */
export function dayOfWeek(iso: string): number {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getDay();
}

/** Verifica se a data é fim de semana (sábado ou domingo). */
export function isWeekend(iso: string): boolean {
  const day = dayOfWeek(iso);
  return day === 0 || day === 6;
}

/**
 * Fator de afinidade com o ciclo semanal (dia útil vs fim de semana).
 * Se o hábito é predominantemente de dia útil e a data de referência é dia útil,
 * ou se é de fim de semana e a referência é fim de semana, retorna 1.0.
 * Se os ciclos forem opostos, retorna 0.85 (calibragem suave).
 */
export function weekdayFactor(entryDates: readonly string[], referenceDateISO?: string): number {
  if (!referenceDateISO || entryDates.length === 0) return 1;
  const refIsWeekend = isWeekend(referenceDateISO);
  let weekendCount = 0;
  for (const date of entryDates) {
    if (isWeekend(date)) weekendCount += 1;
  }
  const habitIsWeekend = weekendCount / entryDates.length >= 0.5;
  return habitIsWeekend === refIsWeekend ? 1 : 0.85;
}

/** Extrai a hora local (0–23) de um timestamp ISO. Retorna null se inválido. */
export function hourOfDay(iso?: string): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
}

/** Distância circular em horas (0–12). */
export function hourDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 24;
  return Math.min(diff, 24 - diff);
}

/** Palavras-chave semânticas associadas aos períodos do dia. */
const TIME_SLOT_KEYWORDS: Record<string, { start: number; end: number; keywords: string[] }> = {
  morning: {
    start: 6,
    end: 11,
    keywords: ["cafe", "padaria", "pao", "combustivel", "posto", "transporte", "metro", "uber", "onibus"],
  },
  lunch: {
    start: 11,
    end: 15,
    keywords: ["almoco", "restaurante", "quilo", "marmita", "refeicao", "buffet", "self service", "comida"],
  },
  afternoon: {
    start: 14,
    end: 18,
    keywords: ["lanche", "cafeteria", "farmacia", "drogaria"],
  },
  night: {
    start: 18,
    end: 24,
    keywords: ["jantar", "ifood", "delivery", "pizza", "bar", "cerveja", "hamburguer", "sushi", "cinema", "show", "pub"],
  },
};

/**
 * Fator horário suave (0.65–1.0):
 * 1. Avalia os horários históricos em que o hábito foi criado (`createdAt`).
 * 2. Aplica reforço semântico se a descrição casar com palavras-chave do período atual.
 * 3. Se não houver timestamps ou for perfil de lote neutro, mantém 1.0.
 */
export function timeOfDayFactor(
  entryTimestamps: readonly (string | undefined)[],
  currentHour: number | undefined,
  description: string,
): number {
  if (currentHour == null) return 1;

  const validHours = entryTimestamps
    .map(hourOfDay)
    .filter((h): h is number => h !== null);

  const normalizedDesc = normalizeText(description);

  // Checagem de reforço semântico
  for (const slot of Object.values(TIME_SLOT_KEYWORDS)) {
    const isCurrentInSlot = currentHour >= slot.start && currentHour <= slot.end;
    if (isCurrentInSlot && slot.keywords.some((kw) => normalizedDesc.includes(kw))) {
      return 1;
    }
  }

  if (validHours.length === 0) return 1;

  // Hora típica do hábito (mediana dos horários)
  const medianHour = Math.round(medianOf(validHours));
  const distance = hourDistance(currentHour, medianHour);

  if (distance <= 2) return 1;
  if (distance <= 4) return 0.85;
  return 0.65;
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

/** Calcula a mediana de um array de números (valores). */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Calcula a moda (elemento mais frequente) de um array. */
export function modeOf<T extends string | number>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  let maxCount = 0;
  let bestItem: T = items[0]!;
  for (const item of items) {
    const count = (counts.get(item) ?? 0) + 1;
    counts.set(item, count);
    if (count > maxCount) {
      maxCount = count;
      bestItem = item;
    }
  }
  return bestItem;
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
  /** Mês da transação (YYYY-MM) — suprime despesas periódicas mensais já lançadas no mês. */
  targetMonth?: string;
  /** Data de referência (YYYY-MM-DD) para afinidade de dia da semana. */
  referenceDate?: string;
  /** Hora atual do dispositivo (0–23) para calibragem horária suave. */
  currentHour?: number;
}

/**
 * Deriva os lançamentos habituais do histórico: agrupa por descrição
 * normalizada + categoria e ranqueia por relevância ponderada:
 *
 *   score = frequência × fatorTemporal(dia do mês ±5–±10) × recência
 *
 * Consolida transações com diferentes formas de pagamento selecionando o
 * método predominante (moda). Sugere o valor típico pela mediana histórica.
 * Suprime despesas periódicas mensais (cadência ≤ 1.25×/mês) que já foram
 * lançadas no mês alvo (`targetMonth`). Retorna top N (padrão 3).
 */
export function buildHabitualEntries(
  history: readonly PredictionEntry[],
  kind: "expense" | "income",
  options: HabitualEntryOptions = {},
): HabitualEntry[] {
  const { limit = 3, referenceDay, todayISO, targetMonth, referenceDate, currentHour } = options;
  const filtered = history.filter((entry) => entry.kind === kind && entry.description.trim() !== "");

  // Agrupamento primário: descrição normalizada + categoria.
  const groups = new Map<string, { entries: PredictionEntry[]; latest: PredictionEntry }>();
  for (const entry of filtered) {
    const key = `${normalizeText(entry.description)}|${entry.categoryId}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { entries: [entry], latest: entry });
      continue;
    }
    group.entries.push(entry);
    if (entry.date > group.latest.date) {
      group.latest = entry;
    }
  }

  const eligibleGroups: Array<{
    description: string;
    categoryId: string;
    categoryName: string;
    paymentMethod: string | null;
    cardId: string | null;
    receiveType: string | null;
    value: number;
    frequency: number;
    score: number;
    latestDate: string;
  }> = [];

  for (const group of groups.values()) {
    const totalCount = group.entries.length;
    const distinctMonths = new Set(group.entries.map((e) => e.date.slice(0, 7)));
    const monthlyCadence = distinctMonths.size > 0 ? totalCount / distinctMonths.size : 1;

    // Supressão de contas mensais únicas já cumpridas no mês alvo:
    // Se a despesa ocorre ~1 vez por mês no histórico e já foi registrada neste mês,
    // ela não precisa ocupar um dos 3 slots de atalho.
    if (targetMonth && monthlyCadence <= 1.25) {
      const alreadyLoggedThisMonth = group.entries.some((e) => e.date.startsWith(targetMonth));
      if (alreadyLoggedThisMonth) {
        continue;
      }
    }

    // Valor representativo pela mediana dos lançamentos do grupo.
    const values = group.entries.map((e) => e.value);
    const typicalValue = medianOf(values);

    // Forma de pagamento predominante (moda do histórico do hábito).
    const paymentMethods = group.entries
      .map((e) => e.paymentMethod)
      .filter((m): m is string => m != null && m !== "");
    const bestPaymentMethod = modeOf(paymentMethods) ?? group.latest.paymentMethod;

    // Cartão predominante.
    const cardIds = group.entries
      .filter((e) => e.paymentMethod === "credit_card" && e.cardId != null)
      .map((e) => e.cardId as string);
    const bestCardId = modeOf(cardIds) ?? group.latest.cardId;

    // Tipo de recebimento predominante.
    const receiveTypes = group.entries
      .map((e) => e.receiveType)
      .filter((r): r is string => r != null && r !== "");
    const bestReceiveType = modeOf(receiveTypes) ?? group.latest.receiveType;

    // Score ponderado contextual 5D:
    // Volume × Janela Dia do Mês × Afinidade Dia da Semana × Afinidade Horária × Recência
    const temporal = referenceDay != null ? monthWindowFactor(dayOfMonth(group.latest.date), referenceDay) : 1;
    const recency = todayISO ? recencyFactor(group.latest.date, todayISO) : 1;
    const weekday = referenceDate ? weekdayFactor(group.entries.map((e) => e.date), referenceDate) : 1;
    const timeOfDay = currentHour != null
      ? timeOfDayFactor(
          group.entries.map((e) => e.createdAt),
          currentHour,
          group.latest.description,
        )
      : 1;

    const score = totalCount * temporal * weekday * timeOfDay * recency;

    eligibleGroups.push({
      description: group.latest.description,
      categoryId: group.latest.categoryId,
      categoryName: group.latest.categoryName,
      paymentMethod: bestPaymentMethod,
      cardId: bestCardId,
      receiveType: bestReceiveType,
      value: typicalValue > 0 ? typicalValue : group.latest.value,
      frequency: totalCount,
      score,
      latestDate: group.latest.date,
    });
  }

  return eligibleGroups
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.latestDate < b.latestDate ? 1 : -1;
    })
    .slice(0, limit)
    .map((item) => ({
      kind,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      paymentMethod: item.paymentMethod,
      cardId: item.cardId,
      receiveType: item.receiveType,
      value: item.value,
      frequency: item.frequency,
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
