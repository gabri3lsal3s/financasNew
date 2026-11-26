import { getSupabase } from "@/data/client";
import { readAllPages, resolveQuery } from "@/data/query";
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
    is_internal_transfer: Boolean(row.is_internal_transfer),
    is_tax_deductible: Boolean(row.is_tax_deductible),
    scope: row.scope ?? "personal",
  };
}

export async function listExpensesByMonth(month: string): Promise<Expense[]> {
  // Fase 32 — recorrência formal: materializa as ocorrências do mês antes de
  // listar (idempotente; sob demanda, ver repositories/recurrences).
  await materializeRecurrencesForMonth(month, "expense");
  const range = monthRange(month);
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = getSupabase()
      .from("expenses")
      .select("*")
      .gte("date", range.start)
      .lt("date", range.end).order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, undefined);
  return data.map(mapExpense).sort((left, right) => right.date.localeCompare(left.date) || right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id));
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
  const createQuery = () => {
  let query = getSupabase()
    .from("expenses")
    .select("*")
    .gte("date", start)
    .lt("date", end);

  if (options?.signal) {
    query = query.abortSignal(options.signal);
  }


    return query;
  };
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = createQuery().order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, options?.signal);
  return data.map(mapExpense).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/** Todas as despesas do usuário (busca global §3.9). */
export async function listAllExpenses(): Promise<Expense[]> {
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = getSupabase().from("expenses").select("*").order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, undefined);
  return data.map(mapExpense).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
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
  const createQuery = () => {
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


    return query;
  };
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = createQuery().order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, undefined);
  return data.map(mapExpense).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

/** Todas as despesas de cartão (faturas na visão consolidada com janela padrão de 24 meses ou customizada). */
export async function listAllCardExpenses(options?: CardQueryOptions): Promise<Expense[]> {
  const createQuery = () => {
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


    return query;
  };
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = createQuery().order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, undefined);
  return data.map(mapExpense).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
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
  const effectiveInput: DbUpdate<Expense> =
    input.value !== undefined && input.base_amount === undefined
      ? { ...input, base_amount: input.value }
      : input;
  const { data, error } = await resolveQuery<Expense>(
    getSupabase().from("expenses").update(effectiveInput).eq("id", id).select().single(),
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
  const data = await readAllPages<Expense>((afterId, pageSize) => {
    let page = getSupabase()
      .from("expenses")
      .select("*")
      .eq("installment_group_id", groupId).order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Expense[]>(page);
  }, undefined);
  return data.map(mapExpense).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

