/**
 * Repositório de Checkpoints de Saldo em Caixa Real — FASE 49.
 *
 * Operações com isolamento de usuário via RLS e gateway padronizado de erros.
 */

import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { CashCheckpoint, DbInsert } from "@/types";

function mapCheckpoint(row: Record<string, unknown>): CashCheckpoint {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    date: String(row.date),
    balance_cents: Number(row.balance_cents),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
  };
}

/** Lista os checkpoints de saldo do usuário (mais recentes primeiro). */
export async function listCashCheckpoints(): Promise<CashCheckpoint[]> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("cash_checkpoints")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).map(mapCheckpoint);
}

/** Obtém o último checkpoint de saldo cadastrado (ou null se não houver). */
export async function getLatestCashCheckpoint(): Promise<CashCheckpoint | null> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("cash_checkpoints")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  const first = data?.[0];
  return first ? mapCheckpoint(first) : null;
}

export interface CreateCashCheckpointInput {
  date: string; // YYYY-MM-DD
  balance_cents: number;
  notes?: string | null;
}

/** Cria um novo checkpoint de saldo âncora ("Bater com o banco"). */
export async function createCashCheckpoint(input: CreateCashCheckpointInput): Promise<CashCheckpoint> {
  const user_id = await currentUserId();

  const insertPayload: DbInsert<CashCheckpoint> = {
    user_id,
    date: input.date,
    balance_cents: Math.round(input.balance_cents),
    notes: input.notes ?? null,
  };

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("cash_checkpoints")
      .insert(insertPayload)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar checkpoint de saldo.", null);
  }

  return mapCheckpoint(data);
}

/** Exclui um checkpoint específico. */
export async function deleteCashCheckpoint(id: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("cash_checkpoints")
      .delete()
      .eq("id", id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
