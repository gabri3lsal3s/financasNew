/**
 * Radar de Assinaturas por Cartão de Crédito e Impacto na Fatura — ESPECIFICAÇÃO F22 / Fase 7.6.
 *
 * Mapeia assinaturas e despesas fixas recorrentes vinculadas ao cartão de crédito,
 * projetando o valor total previsto a ser debitado antes do fechamento da fatura em aberto
 * e emitindo alertas preventivos caso o montante supere o limite disponível restante.
 *
 * Motor 100% puro, sem dependências de UI ou Supabase.
 */

import { clampDay } from "@/domain/competence";
import { formatBRL, type RecurrenceOccurrence } from "./recurrences";
import { findMatchingServiceKey } from "./subscriptions";
import { normalizeText, stripTemporalSuffixes } from "./shared";

export interface CardForImpact {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  credit_limit?: number | null;
}

export interface CardSubscriptionImpactOptions {
  /** Data de referência local YYYY-MM-DD (default: data de hoje do sistema). */
  todayISO?: string;
  /** Limite disponível em centavos (se já computado a partir do saldo da fatura). */
  availableLimitCents?: number | null;
  /** Total de gastos já lançados na fatura aberta em centavos (usado se availableLimitCents não for informado). */
  currentInvoiceSpentCents?: number;
  /** Despesas já lançadas no cartão/fatura atual para supressão de duplicidades e canibalização por parcelamento. */
  existingCardExpenses?: readonly { description?: string | null; installmentGroupId?: string | null }[];
}

export interface ProjectedSubscriptionItem {
  key: string;
  name: string;
  amountCents: number;
  typicalDayOfMonth?: number;
  expectedDate?: string;
  daysUntilExpected?: number;
}

export interface CardSubscriptionImpact {
  cardId: string;
  cardName: string;
  closingDay: number;
  /** Data do próximo fechamento da fatura no ciclo em aberto (YYYY-MM-DD). */
  nextClosingDate: string;
  /** Dias restantes até o fechamento da fatura. */
  daysUntilClosing: number;
  /** Total em centavos de assinaturas previstas antes do fechamento. */
  totalProjectedCents: number;
  /** Quantidade de assinaturas previstas. */
  projectedCount: number;
  /** Itens individuais de assinaturas previstas. */
  items: ProjectedSubscriptionItem[];
  /** Limite total configurado do cartão em centavos, ou null se não cadastrado. */
  totalLimitCents: number | null;
  /** Limite disponível restante em centavos, ou null se sem limite total. */
  availableLimitCents: number | null;
  /** Sinaliza se o total projetado supera o limite disponível restante. */
  exceedsAvailableLimit: boolean;
  /** Valor que excede o limite disponível em centavos (0 se não exceder). */
  overflowCents: number;
  /** Mensagem editorial canônica: "Você possui R$ X em assinaturas previstas para este cartão antes do fechamento da fatura". */
  message: string;
  /** Alerta preventivo se o limite for superado. */
  warningMessage?: string;
}

/** Formata data YYYY-MM-DD a partir de componentes numéricos. */
function toISODateString(year: number, month1Based: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month1Based).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calcula a data de fechamento da fatura em aberto com base no closing_day do cartão e na data atual.
 * Se a data atual for anterior ou igual ao closing_day do mês, a fatura em aberto fecha neste mês.
 * Se for posterior, a fatura em aberto fecha no mês seguinte.
 */
export function getNextInvoiceClosingDate(closingDay: number, referenceDateISO: string): string {
  const year = parseInt(referenceDateISO.slice(0, 4), 10);
  const month = parseInt(referenceDateISO.slice(5, 7), 10); // 1..12
  const day = parseInt(referenceDateISO.slice(8, 10), 10); // 1..31

  let targetYear = year;
  let targetMonth = month;

  if (day >= closingDay) {
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }

  const clampedDay = clampDay(closingDay, targetYear, targetMonth - 1);
  return toISODateString(targetYear, targetMonth, clampedDay);
}

function extractServiceKey(description: string): string {
  const trimmed = description.trim();
  const matched = findMatchingServiceKey(trimmed);
  return matched ?? normalizeText(stripTemporalSuffixes(trimmed));
}

/**
 * Avalia se uma assinatura / recorrência tem cobrança prevista antes da data de fechamento da fatura.
 */
export function isSubscriptionDueBeforeClosing(
  occurrence: RecurrenceOccurrence,
  closingDateISO: string,
  referenceDateISO: string,
  cardClosingDay: number,
): boolean {
  // Se a recorrência estiver descontinuada/encerrada (lapsed), nunca projeta na fatura
  if (occurrence.lifecycle === "lapsed") {
    return false;
  }

  // Se possuir data estimada calculada pelo motor:
  if (occurrence.nextDueDate) {
    if (occurrence.nextDueDate >= referenceDateISO && occurrence.nextDueDate <= closingDateISO) {
      return true;
    }
    // Caso de conta pendente no mês (missingThisMonth) com dia típico anterior ao fechamento:
    if (occurrence.missingThisMonth) {
      const typicalDay = occurrence.typicalDayOfMonth ?? parseInt(occurrence.nextDueDate.slice(8, 10), 10);
      if (typicalDay <= cardClosingDay) {
        return true;
      }
    }
    return false;
  }

  // Fallback baseado no dia típico do mês
  if (occurrence.typicalDayOfMonth) {
    const todayDay = parseInt(referenceDateISO.slice(8, 10), 10);
    if (todayDay < cardClosingDay) {
      return occurrence.typicalDayOfMonth >= todayDay && occurrence.typicalDayOfMonth <= cardClosingDay;
    } else {
      return occurrence.typicalDayOfMonth >= todayDay || occurrence.typicalDayOfMonth <= cardClosingDay;
    }
  }

  return false;
}

/**
 * Calcula o impacto das assinaturas previstas na fatura em aberto de um cartão de crédito.
 */
export function calculateCardSubscriptionImpact(
  card: CardForImpact,
  occurrences: readonly RecurrenceOccurrence[],
  options: CardSubscriptionImpactOptions = {},
): CardSubscriptionImpact {
  const todayISO = options.todayISO ?? new Date().toISOString().slice(0, 10);
  const nextClosingDate = getNextInvoiceClosingDate(card.closing_day, todayISO);

  const todayTime = new Date(`${todayISO}T00:00:00Z`).getTime();
  const closingTime = new Date(`${nextClosingDate}T00:00:00Z`).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilClosing = Math.max(0, Math.round((closingTime - todayTime) / msPerDay));

  // Filtra ocorrências associadas a este cartão (subscriptions e recurring) que não estejam descontinuadas
  const cardOccurrences = occurrences.filter(
    (o) => (o.cardId === card.id || (o.paymentMethod === "credit_card" && o.cardId === card.id)) &&
      (o.level === "subscription" || o.level === "recurring") &&
      o.lifecycle !== "lapsed",
  );

  // Mapeia serviços já faturados/lançados na fatura aberta (ex.: parcelamentos ou compras avulsas já existentes)
  const billedServiceKeys = new Set<string>();
  if (options.existingCardExpenses && options.existingCardExpenses.length > 0) {
    for (const exp of options.existingCardExpenses) {
      const raw = (exp.description ?? "").trim();
      if (raw) {
        billedServiceKeys.add(extractServiceKey(raw));
      }
    }
  }

  const items: ProjectedSubscriptionItem[] = [];
  let totalProjectedCents = 0;

  for (const occ of cardOccurrences) {
    // Se este serviço já foi faturado nesta fatura (ex.: parcela 8/12 da Vivo Easy já lançada),
    // suprime a projeção fantasma para evitar cobrança duplicada.
    const occKey = occ.key.replace(/^(sub|recurring):/, "");
    const occNameKey = extractServiceKey(occ.name);
    if (billedServiceKeys.has(occKey) || billedServiceKeys.has(occNameKey)) {
      continue;
    }

    if (isSubscriptionDueBeforeClosing(occ, nextClosingDate, todayISO, card.closing_day)) {
      const amountCents = occ.averageCents;
      totalProjectedCents += amountCents;

      items.push({
        key: occ.key,
        name: occ.name,
        amountCents,
        typicalDayOfMonth: occ.typicalDayOfMonth,
        expectedDate: occ.nextDueDate,
        daysUntilExpected: occ.daysUntilNextDue,
      });
    }
  }

  // Ordena itens cronologicamente ou por maior valor
  items.sort((a, b) => b.amountCents - a.amountCents);

  // Análise de limite
  const totalLimitCents =
    card.credit_limit != null && card.credit_limit > 0 ? Math.round(card.credit_limit * 100) : null;

  let availableLimitCents: number | null = null;
  if (totalLimitCents !== null) {
    if (options.availableLimitCents !== undefined && options.availableLimitCents !== null) {
      availableLimitCents = Math.max(0, options.availableLimitCents);
    } else {
      const spent = options.currentInvoiceSpentCents ?? 0;
      availableLimitCents = Math.max(0, totalLimitCents - spent);
    }
  }

  const exceedsAvailableLimit =
    availableLimitCents !== null && totalProjectedCents > availableLimitCents;

  const overflowCents = exceedsAvailableLimit && availableLimitCents !== null
    ? totalProjectedCents - availableLimitCents
    : 0;

  const formattedAmount = formatBRL(totalProjectedCents);
  const message = `Você possui ${formattedAmount} em assinaturas previstas para este cartão antes do fechamento da fatura`;

  let warningMessage: string | undefined;
  if (exceedsAvailableLimit && availableLimitCents !== null) {
    const formattedLimit = formatBRL(availableLimitCents);
    const formattedOverflow = formatBRL(overflowCents);
    warningMessage = `Atenção: o total de assinaturas projetadas (${formattedAmount}) supera o limite disponível de ${formattedLimit} em ${formattedOverflow}.`;
  }

  return {
    cardId: card.id,
    cardName: card.name,
    closingDay: card.closing_day,
    nextClosingDate,
    daysUntilClosing,
    totalProjectedCents,
    projectedCount: items.length,
    items,
    totalLimitCents,
    availableLimitCents,
    exceedsAvailableLimit,
    overflowCents,
    message,
    warningMessage,
  };
}

/**
 * Calcula o impacto de assinaturas para todos os cartões cadastrados.
 */
export function calculateAllCardsSubscriptionImpact(
  cards: readonly CardForImpact[],
  occurrences: readonly RecurrenceOccurrence[],
  options: CardSubscriptionImpactOptions = {},
): CardSubscriptionImpact[] {
  return cards.map((card) => calculateCardSubscriptionImpact(card, occurrences, options));
}
