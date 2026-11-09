import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { currentMonth, monthRange, shiftMonth } from "@/lib/date";
import { materializeRecurrencesForMonth, materializeRecurrencesForRange } from "./recurrences";
import type { DbUpdate, Expense } from "@/types";

/**
 * Despesas — integração remota. Conversão de borda: campos numeric chegam do
 * PostgREST como string e são convertidos para number (contrato de domínio).
 */

function mapExpense(row: Expense): Expense {
  return {
    ...row,
    value: Number(row.value),
    report_weight: Number(row.report_weight),
    base_amount: Number(row.base_amount),
    is_family: Boolean(row.is_family),
  };
}

export async function listExpensesByMonth(month: string): Promise<Expense[]> {
  // Fase 32 — recorrência formal: materializa as ocorrências do mês antes de
  // listar (idempotente; sob demanda, ver repositories/recurrences).
  await materializeRecurrencesForMonth(month, "expense");
  const range = monthRange(month);
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase()
      .from("expenses")
      .select("*")
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

export interface RangeQueryOptions {
  signal?: AbortSignal;
}

/** Despesas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export async function listExpensesByRange(
  start: string,
  end: string,
  options?: RangeQueryOptions,
): Promise<Expense[]> {
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  await materializeRecurrencesForRange(start, end, "expense");
  let query = getSupabase()
    .from("expenses")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: true });

  if (options?.signal) {
    query = query.abortSignal(options.signal);
  }

  const { data, error } = await resolveQuery<Expense[]>(query);
  if (error) {
    if (options?.signal?.aborted || error.message?.includes("AbortError")) {
      throw new DOMException("The user aborted a request.", "AbortError");
    }
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

/** Todas as despesas do usuário (busca global §3.9). */
export async function listAllExpenses(): Promise<Expense[]> {
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase().from("expenses").select("*").order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

/** Janela temporal padrão para consultas de cartão (24 meses retroativos para cobertura de parcelamentos estendidos). */
export const DEFAULT_CARD_WINDOW_MONTHS = 24;

export interface CardQueryOptions {
  /**
   * Mês inicial (YYYY-MM) do corte temporal.
   * Se omitido (undefined), adota o padrão de 24 meses retroativos.
   * Se for null, desativa o corte temporal e executa a busca irrestrita em todo o histórico.
   */
  sinceMonth?: string | null;
}

/** Despesas de um cartão (derivação de fatura com janela padrão de 24 meses ou customizada). */
export async function listExpensesByCard(cardId: string, options?: CardQueryOptions): Promise<Expense[]> {
  let query = getSupabase()
    .from("expenses")
    .select("*")
    .eq("card_id", cardId);

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    const sinceDate = `${resolvedSinceMonth}-01`;
    query = query.or(`bill_competence.gte.${resolvedSinceMonth},date.gte.${sinceDate}`);
  }

  const { data, error } = await resolveQuery<Expense[]>(
    query.order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

/** Todas as despesas de cartão (faturas na visão consolidada com janela padrão de 24 meses ou customizada). */
export async function listAllCardExpenses(options?: CardQueryOptions): Promise<Expense[]> {
  let query = getSupabase()
    .from("expenses")
    .select("*")
    .not("card_id", "is", null);

  const resolvedSinceMonth =
    options?.sinceMonth === undefined
      ? shiftMonth(currentMonth(), -DEFAULT_CARD_WINDOW_MONTHS)
      : options.sinceMonth;

  if (resolvedSinceMonth) {
    const sinceDate = `${resolvedSinceMonth}-01`;
    query = query.or(`bill_competence.gte.${resolvedSinceMonth},date.gte.${sinceDate}`);
  }

  const { data, error } = await resolveQuery<Expense[]>(
    query.order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

/** Despesa por id (usado no detalhe). */
export async function getExpense(id: string): Promise<Expense | null> {
  const { data, error } = await resolveQuery<Expense | null>(getSupabase().from("expenses").select("*").eq("id", id).maybeSingle());
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapExpense(data) : null;
}

export async function updateExpense(id: string, input: DbUpdate<Expense>): Promise<Expense> {
  const { data, error } = await resolveQuery<Expense>(
    getSupabase().from("expenses").update(input).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Despesa não encontrada para atualização.", null);
  }
  return mapExpense(data);
}

/** Despesas pertencentes a um grupo de parcelas ordenadas por número da parcela. */
export async function listExpensesByInstallmentGroup(groupId: string): Promise<Expense[]> {
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase()
      .from("expenses")
      .select("*")
      .eq("installment_group_id", groupId)
      .order("installment_number", { ascending: true }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

