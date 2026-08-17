import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { materializeRecurrences } from "@/data/rpc";
import { occurrencesForMonth, occurrencesForRange } from "@/domain/recurrences";
import type { RecurrenceRule } from "@/domain/recurrences";
import { resolveBillCompetence } from "@/domain/competence";
import { AppError, classifyError } from "@/services/errors";
import type { CreditCard, Recurrence, RecurrenceKind } from "@/types";

/**
 * Recorrências (template) — integração remota (Fase 32).
 *
 * A materialização é SOB DEMANDA (decisão de produto 2026-08-17): ao listar um
 * mês/range, o cliente calcula as ocorrências com `domain/recurrences` (D12) e
 * chama o RPC `materialize_recurrences`, que insere as linhas faltantes de
 * forma idempotente e respeita `recurrence_skips`. A competência de fatura de
 * ocorrências no crédito é snapshot calculado aqui (closing day do cartão).
 */

function mapRecurrence(row: Recurrence): Recurrence {
  return { ...row, value: Number(row.value), report_weight: Number(row.report_weight) };
}

/** Regra de domínio a partir da linha do banco (moeda em centavos no motor). */
function toRule(row: Recurrence): RecurrenceRule {
  return {
    id: row.id,
    kind: row.kind,
    frequency: row.frequency,
    valueCents: Math.round(Number(row.value) * 100),
    startDate: row.start_date,
    endDate: row.end_date,
    occurrencesTotal: row.occurrences_total,
    reportWeight: Number(row.report_weight),
    isActive: row.is_active,
  };
}

async function fetchRecurrences(kind?: RecurrenceKind, activeOnly = false): Promise<Recurrence[]> {
  const builder = getSupabase().from("recurrences").select("*").order("created_at", { ascending: false });
  const query = kind !== undefined ? builder.eq("kind", kind) : builder;
  const finalQuery = activeOnly ? query.eq("is_active", true) : query;
  const { data, error } = await resolveQuery<Recurrence[]>(finalQuery);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapRecurrence);
}

/** Templates do usuário (fonte da verdade — usada na UI de gestão). */
export async function listRecurrences(kind?: RecurrenceKind): Promise<Recurrence[]> {
  return fetchRecurrences(kind);
}

async function closingDaysByCard(rules: Recurrence[]): Promise<Map<string, number>> {
  const cardIds = rules
    .filter((rule) => rule.kind === "expense" && rule.payment_method === "credit_card" && rule.card_id != null)
    .map((rule) => rule.card_id as string);
  if (cardIds.length === 0) return new Map();
  const { data, error } = await resolveQuery<CreditCard[]>(
    getSupabase().from("credit_cards").select("id, closing_day").in("id", cardIds),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return new Map((data ?? []).map((card) => [card.id, card.closing_day]));
}

/** Competência de fatura snapshot da ocorrência (crédito) — null nos demais casos. */
function competenceFor(row: Recurrence, date: string, closingDays: Map<string, number>): string | null {
  if (row.kind !== "expense" || row.payment_method !== "credit_card" || row.card_id == null) return null;
  const closingDay = closingDays.get(row.card_id);
  if (closingDay == null) return null;
  return resolveBillCompetence(new Date(`${date}T12:00:00`), closingDay);
}

/** Materializa as ocorrências de um mês (YYYY-MM) de um tipo (idempotente). */
export async function materializeRecurrencesForMonth(month: string, kind: RecurrenceKind): Promise<void> {
  const rules = await fetchRecurrences(kind, true);
  if (rules.length === 0) return;
  const closingDays = await closingDaysByCard(rules);
  const items = rules.flatMap((rule) =>
    occurrencesForMonth(toRule(rule), month).map((occurrence) => ({
      recurrenceId: occurrence.recurrenceId,
      date: occurrence.date,
      occurrenceNumber: occurrence.occurrenceNumber,
      value: occurrence.valueCents / 100,
      billCompetence: competenceFor(rule, occurrence.date, closingDays),
    })),
  );
  if (items.length === 0) return;
  await materializeRecurrences(items);
}

/** Materializa as ocorrências de um período [start, end) — relatórios custom. */
export async function materializeRecurrencesForRange(start: string, end: string, kind: RecurrenceKind): Promise<void> {
  const rules = await fetchRecurrences(kind, true);
  if (rules.length === 0) return;
  const closingDays = await closingDaysByCard(rules);
  const items = rules.flatMap((rule) =>
    occurrencesForRange(toRule(rule), start, end).map((occurrence) => ({
      recurrenceId: occurrence.recurrenceId,
      date: occurrence.date,
      occurrenceNumber: occurrence.occurrenceNumber,
      value: occurrence.valueCents / 100,
      billCompetence: competenceFor(rule, occurrence.date, closingDays),
    })),
  );
  if (items.length === 0) return;
  await materializeRecurrences(items);
}
