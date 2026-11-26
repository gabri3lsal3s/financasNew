import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { readAllPages, resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { monthRange } from "@/lib/date";
import { materializeRecurrencesForMonth, materializeRecurrencesForRange } from "./recurrences";
import type { DbInsert, DbUpdate, Income } from "@/types";

/**
 * Rendas — integração remota. Conversão de borda: `value` (numeric) chega do
 * PostgREST como string e é convertido para number (contrato de domínio).
 */

const INCOME_COLUMNS =
  "id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, installments_total, installment_number, installment_group_id, recurrence_id, occurrence_number, statement_hash, imported_from_statement, is_family, family_id, scope, is_internal_transfer, transfer_pair_id, transfer_kind, tax_withheld, created_at";

function mapIncome(row: Income): Income {
  return {
    ...row,
    value: Number(row.value),
    tax_withheld: row.tax_withheld !== undefined && row.tax_withheld !== null ? Number(row.tax_withheld) : 0,
    report_weight: row.report_weight !== undefined && row.report_weight !== null ? Number(row.report_weight) : 1.0,
    is_family: Boolean(row.is_family),
    is_internal_transfer: Boolean(row.is_internal_transfer),
    scope: row.scope ?? "personal",
  };
}

export async function listIncomesByMonth(
  month: string,
  options?: { signal?: AbortSignal },
): Promise<Income[]> {
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  // Fase 32 — recorrência formal: materializa as ocorrências do mês antes de
  // listar (idempotente; sob demanda, ver repositories/recurrences).
  await materializeRecurrencesForMonth(month, "income");
  options?.signal?.throwIfAborted();
  const range = monthRange(month);
  const data = await readAllPages<Income>((afterId, pageSize) => {
    let page = getSupabase()
      .from("incomes")
      .select(INCOME_COLUMNS)
      .gte("date", range.start)
      .lt("date", range.end)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (options?.signal) page = page.abortSignal(options.signal);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Income[]>(page);
  }, options?.signal);
  return data.map(mapIncome).sort((left, right) => right.date.localeCompare(left.date) || right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id));
}

export interface RangeQueryOptions {
  signal?: AbortSignal;
}

/** Rendas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export async function listIncomesByRange(
  start: string,
  end: string,
  options?: RangeQueryOptions,
): Promise<Income[]> {
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  await materializeRecurrencesForRange(start, end, "income");
  const createQuery = () => {
  let query = getSupabase()
    .from("incomes")
    .select(INCOME_COLUMNS)
    .gte("date", start)
    .lt("date", end);

  if (options?.signal) {
    query = query.abortSignal(options.signal);
  }


    return query;
  };
  const data = await readAllPages<Income>((afterId, pageSize) => {
    let page = createQuery().order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Income[]>(page);
  }, options?.signal);
  return data.map(mapIncome).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/** Todas as rendas do usuário (busca global §3.9). */
export async function listAllIncomes(): Promise<Income[]> {
  const data = await readAllPages<Income>((afterId, pageSize) => {
    let page = getSupabase().from("incomes").select(INCOME_COLUMNS).order("id", { ascending: true }).limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<Income[]>(page);
  }, undefined);
  return data.map(mapIncome).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

/** Rendas automáticas ([REFUND], etc.) são somente-leitura — excluídas do CRUD. */
export async function createIncome(input: Omit<DbInsert<Income>, "user_id">): Promise<Income> {
  const user_id = await currentUserId();
  // Parcelamento/recorrência têm default no banco (Fase 32) — preenchidos aqui
  // para o contrato TS (avulsa = 1 parcela, sem grupo).
  const { data, error } = await resolveQuery<Income>(
    getSupabase()
      .from("incomes")
      .insert({
        ...input,
        user_id,
        installments_total: input.installments_total ?? 1,
        installment_number: input.installment_number ?? 1,
        installment_group_id: input.installment_group_id ?? null,
        recurrence_id: input.recurrence_id ?? null,
        occurrence_number: input.occurrence_number ?? null,
      })
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar renda.", null);
  }
  return mapIncome(data);
}

export async function updateIncome(id: string, input: DbUpdate<Income>): Promise<Income> {
  const { data, error } = await resolveQuery<Income>(
    getSupabase().from("incomes").update(input).eq("id", id).is("source_ref", null).select().single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Renda não encontrada para atualização.", null);
  }
  return mapIncome(data);
}

export async function deleteIncome(id: string): Promise<void> {
  // Rendas automáticas (source_ref) são somente-leitura (§3.1) — nunca excluídas.
  const { error } = await getSupabase().from("incomes").delete().eq("id", id).is("source_ref", null);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
