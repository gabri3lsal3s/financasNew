import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { monthRange } from "@/lib/date";
import { materializeRecurrencesForMonth, materializeRecurrencesForRange } from "./recurrences";
import type { DbInsert, DbUpdate, Income } from "@/types";

/**
 * Rendas — integração remota. Conversão de borda: `value` (numeric) chega do
 * PostgREST como string e é convertido para number (contrato de domínio).
 */

function mapIncome(row: Income): Income {
  return { ...row, value: Number(row.value) };
}

export async function listIncomesByMonth(month: string): Promise<Income[]> {
  // Fase 32 — recorrência formal: materializa as ocorrências do mês antes de
  // listar (idempotente; sob demanda, ver repositories/recurrences).
  await materializeRecurrencesForMonth(month, "income");
  const range = monthRange(month);
  const { data, error } = await resolveQuery<Income[]>(
    getSupabase()
      .from("incomes")
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
  return (data ?? []).map(mapIncome);
}

/** Rendas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export async function listIncomesByRange(start: string, end: string): Promise<Income[]> {
  await materializeRecurrencesForRange(start, end, "income");
  const { data, error } = await resolveQuery<Income[]>(
    getSupabase()
      .from("incomes")
      .select("*")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: true }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapIncome);
}

/** Todas as rendas do usuário (busca global §3.9). */
export async function listAllIncomes(): Promise<Income[]> {
  const { data, error } = await resolveQuery<Income[]>(
    getSupabase().from("incomes").select("*").order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapIncome);
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
