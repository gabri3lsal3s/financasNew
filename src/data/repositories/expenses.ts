import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { monthRange } from "@/lib/date";
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
  };
}

export async function listExpensesByMonth(month: string): Promise<Expense[]> {
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

/** Despesas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export async function listExpensesByRange(start: string, end: string): Promise<Expense[]> {
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase()
      .from("expenses")
      .select("*")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: true }),
  );
  if (error) {
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

/** Despesas de um cartão (todas as competências — derivação de fatura). */
export async function listExpensesByCard(cardId: string): Promise<Expense[]> {
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase()
      .from("expenses")
      .select("*")
      .eq("card_id", cardId)
      .order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapExpense);
}

/** Todas as despesas de cartão (faturas em aberto na visão consolidada). */
export async function listAllCardExpenses(): Promise<Expense[]> {
  const { data, error } = await resolveQuery<Expense[]>(
    getSupabase().from("expenses").select("*").not("card_id", "is", null).order("date", { ascending: false }),
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
