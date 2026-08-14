import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, DbUpdate, Debt } from "@/types";

/**
 * Dívidas / contas a pagar e receber — integração remota.
 * Escritas simples (1 registro) usam CRUD direto; a QUITAÇÃO é sempre via
 * RPC transacional (`pay_debt` / `receive_debt` / `settle_integrated_receivable`)
 * porque cria lançamento (despesa/renda) na mesma transação (D1).
 */

function mapDebt(row: Debt): Debt {
  return { ...row, amount: Number(row.amount) };
}

/** Todas as dívidas do usuário — ordenadas por vencimento (ESPECIFICAÇÃO §3.4). */
export async function listDebts(): Promise<Debt[]> {
  const { data, error } = await resolveQuery<Debt[]>(
    getSupabase().from("debts").select("*").order("due_date", { ascending: true }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapDebt);
}

export type CreateDebtInput = Omit<DbInsert<Debt>, "user_id" | "paid_at" | "expense_id" | "installment_group_id">;

/** Campos de quitação/vínculo têm default no banco (NULL) — a UI só informa o essencial. */
export async function createDebt(input: CreateDebtInput): Promise<Debt> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<Debt>(
    getSupabase()
      .from("debts")
      .insert({ ...input, user_id, paid_at: null, expense_id: null, installment_group_id: null })
      .select()
      .single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar dívida.", null);
  }
  return mapDebt(data);
}

export async function updateDebt(id: string, input: DbUpdate<Debt>): Promise<Debt> {
  const { data, error } = await resolveQuery<Debt>(
    getSupabase().from("debts").update(input).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Dívida não encontrada para atualização.", null);
  }
  return mapDebt(data);
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await getSupabase().from("debts").delete().eq("id", id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
