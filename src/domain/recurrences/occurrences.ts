/**
 * Geração de ocorrências de recorrência — Fase 32.
 *
 * Motor puro (D12): o cliente calcula as datas das ocorrências e as envia ao
 * RPC `materialize_recurrences` (Etapa 2), que valida invariantes e insere as
 * linhas faltantes de forma idempotente — a lógica de datas não é duplicada
 * em SQL.
 *
 * Frequências:
 *   • monthly/quarterly/yearly — `addMonthsClamped` (clamp do dia ao último
 *     dia do mês destino; o dia ancorado segue o mês destino subsequente);
 *   • weekly — soma 7 dias (mesmo dia da semana, UTC).
 *
 * Fim sempre definido: `endDate` (inclusivo) OU `occurrencesTotal` (1-based,
 * inclui a primeira ocorrência). Datas nunca antes de APP_START_DATE.
 */

import { addMonthsClamped, toISODate } from "@/domain/money";
import { addDaysISO } from "@/domain/debts";
import { APP_START_DATE } from "@/types/schema";
import type { RecurrenceFrequency, RecurrenceOccurrence, RecurrenceRule } from "./types";

/** Guarda defensiva contra regras malformadas com janelas longas demais. */
export const MAX_RECURRENCE_OCCURRENCES = 600;

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validação de calendário: rejeita datas inexistentes (ex.: 2026-13-01). */
function isValidISODate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function nextDate(current: string, frequency: RecurrenceFrequency): string {
  switch (frequency) {
    case "weekly":
      return addDaysISO(current, 7);
    case "monthly":
      return toISODate(addMonthsClamped(parseISO(current), 1));
    case "quarterly":
      return toISODate(addMonthsClamped(parseISO(current), 3));
    case "yearly":
      return toISODate(addMonthsClamped(parseISO(current), 12));
  }
}

/** Valida a regra e normaliza o limite (fim por data ou por contagem). */
function resolveLimits(rule: RecurrenceRule): { lastDate: string | null; maxCount: number | null } {
  if (!Number.isInteger(rule.valueCents) || rule.valueCents <= 0) {
    throw new Error("Valor da recorrência deve ser um inteiro positivo (centavos).");
  }
  if (!isValidISODate(rule.startDate)) {
    throw new Error("Data de início da recorrência inválida (use AAAA-MM-DD).");
  }
  if (rule.startDate < APP_START_DATE) {
    throw new Error("Data de início anterior à data de início do app (2026-01-01).");
  }

  const hasEndDate = rule.endDate != null && rule.endDate !== "";
  const hasCount = rule.occurrencesTotal != null;
  if (hasEndDate === hasCount) {
    throw new Error("Defina exatamente um limite: data de fim ou número de ocorrências.");
  }

  if (hasEndDate) {
    if (!isValidISODate(rule.endDate ?? "")) {
      throw new Error("Data de fim da recorrência inválida (use AAAA-MM-DD).");
    }
    if ((rule.endDate ?? "") < rule.startDate) {
      throw new Error("Data de fim anterior à data de início da recorrência.");
    }
    return { lastDate: rule.endDate, maxCount: null };
  }

  if (!Number.isInteger(rule.occurrencesTotal) || (rule.occurrencesTotal ?? 0) < 1) {
    throw new Error("Número de ocorrências deve ser um inteiro maior que zero.");
  }
  return { lastDate: null, maxCount: rule.occurrencesTotal };
}

/**
 * Constrói todas as ocorrências da regra, na ordem cronológica, com
 * `occurrenceNumber` 1-based. Id estável `${recurrenceId}:${date}`.
 */
export function buildRecurrenceOccurrences(rule: RecurrenceRule): RecurrenceOccurrence[] {
  const { lastDate, maxCount } = resolveLimits(rule);

  const occurrences: RecurrenceOccurrence[] = [];
  let cursor = rule.startDate;
  let number = 1;

  while (true) {
    const pastEnd = lastDate != null && cursor > lastDate;
    const pastCount = maxCount != null && number > maxCount;
    if (pastEnd || pastCount) break;

    occurrences.push({
      id: `${rule.id}:${cursor}`,
      recurrenceId: rule.id,
      date: cursor,
      occurrenceNumber: number,
      valueCents: rule.valueCents,
    });
    if (occurrences.length > MAX_RECURRENCE_OCCURRENCES) {
      throw new Error(
        `Recorrência excede o limite defensivo de ${MAX_RECURRENCE_OCCURRENCES} ocorrências; revise a data de fim ou o número de ocorrências.`,
      );
    }
    cursor = nextDate(cursor, rule.frequency);
    number += 1;
  }

  return occurrences;
}

/** Ocorrências da regra dentro de um mês (YYYY-MM) — materialização sob demanda. */
export function occurrencesForMonth(rule: RecurrenceRule, month: string): RecurrenceOccurrence[] {
  if (!MONTH_KEY_RE.test(month)) {
    throw new Error("Mês inválido — use o formato AAAA-MM.");
  }
  return buildRecurrenceOccurrences(rule).filter((occurrence) => occurrence.date.startsWith(`${month}-`));
}

/** Ocorrências da regra num período [start, end) — relatórios custom (≤ 366 dias). */
export function occurrencesForRange(
  rule: RecurrenceRule,
  start: string,
  end: string,
): RecurrenceOccurrence[] {
  if (!isValidISODate(start) || !isValidISODate(end)) {
    throw new Error("Período inválido — use datas AAAA-MM-DD.");
  }
  if (end <= start) {
    throw new Error("Período inválido — a data final deve ser posterior à inicial.");
  }
  return buildRecurrenceOccurrences(rule).filter(
    (occurrence) => occurrence.date >= start && occurrence.date < end,
  );
}
