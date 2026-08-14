import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { setIncomeGoal } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { IncomeGoal } from "@/types";

/**
 * Metas de renda — integração remota (§3.5.3).
 * Upsert via RPC `set_income_goal` (auditado); remoção = delete direto.
 */

function mapGoal(row: IncomeGoal): IncomeGoal {
  return { ...row, expected: Number(row.expected) };
}

/** Todas as metas de renda do usuário. */
export async function listIncomeGoals(): Promise<IncomeGoal[]> {
  const { data, error } = await resolveQuery<IncomeGoal[]>(
    getSupabase().from("income_goals").select("*").order("month", { ascending: true }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapGoal);
}

/** Define (upsert) a meta de uma categoria de renda no mês — RPC auditado. */
export async function setGoal(categoryId: string, month: string, expected: number): Promise<void> {
  await setIncomeGoal(categoryId, month, expected);
}

/** Remove a meta de uma categoria no mês. */
export async function removeGoal(categoryId: string, month: string): Promise<void> {
  const { error } = await getSupabase()
    .from("income_goals")
    .delete()
    .eq("category_id", categoryId)
    .eq("month", month);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
