import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { deleteCreditCardRpc, updateCreditCardRpc } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { CreditCard, DbInsert } from "@/types";

/**
 * Cartões de crédito — integração remota.
 * Escritas simples (1 registro) usam CRUD direto; alteração de regras e
 * exclusão vão por RPC porque são auditadas (ESPECIFICAÇÃO §1.5/D2).
 */

function mapCreditCard(row: CreditCard): CreditCard {
  return { ...row, credit_limit: row.credit_limit === null ? null : Number(row.credit_limit) };
}

/** Todos os cartões (ativos e inativos) — ordenados por nome. */
export async function listCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await resolveQuery<CreditCard[]>(
    getSupabase().from("credit_cards").select("*").order("name"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapCreditCard);
}

/** Apenas cartões ativos (para seleção em formulários). */
export async function listActiveCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await resolveQuery<CreditCard[]>(
    getSupabase().from("credit_cards").select("*").eq("is_active", true).order("name"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapCreditCard);
}

export async function createCreditCard(input: Omit<DbInsert<CreditCard>, "user_id">): Promise<CreditCard> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<CreditCard>(
    getSupabase().from("credit_cards").insert({ ...input, user_id }).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar cartão.", null);
  }
  return mapCreditCard(data);
}

/** Campos editáveis de um cartão (formulário de criação/edição). */
export interface CreditCardForm {
  name: string;
  brand: string | null;
  credit_limit: number | null;
  closing_day: number;
  due_day: number;
  color: string | null;
  is_active: boolean;
}

/** Alteração de regras do cartão — RPC auditado (D2). */
export async function updateCreditCard(id: string, input: CreditCardForm): Promise<void> {
  await updateCreditCardRpc({
    cardId: id,
    name: input.name,
    brand: input.brand,
    creditLimit: input.credit_limit,
    closingDay: input.closing_day,
    dueDay: input.due_day,
    color: input.color,
    isActive: input.is_active,
  });
}

/** Exclusão definitiva — RPC auditado; bloqueado por FK se houver histórico. */
export async function deleteCreditCard(id: string): Promise<void> {
  await deleteCreditCardRpc(id);
}
