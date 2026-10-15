import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { setBudgetLimit } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { Budget } from "@/types";

/**
 * Orçamentos — integração remota.
 * Upsert do limite via RPC `set_budget_limit` (auditado); \"limpar o campo
 * remove o limite\" (ESPECIFICAÇÃO §3.5.2) = delete direto (escrita simples).
 */

function mapBudget(row: Budget): Budget {
  return { ...row, limit: Number(row.limit) };
}

/** Todos os orçamentos do usuário (necessários para a herança de limite). */
export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await resolveQuery<Budget[]>(
    getSupabase().from("budgets").select("*").order("month", { ascending: true }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapBudget);
}

/** Define (upsert) o limite de uma categoria no mês — RPC auditado. */
export async function setBudget(categoryId: string, month: string, limit: number): Promise<void> {
  await setBudgetLimit(categoryId, month, limit);
}

/** Remove o limite de uma categoria no mês (limpar campo). */
export async function removeBudget(categoryId: string, month: string): Promise<void> {
  const { error } = await getSupabase().from("budgets").delete().eq("category_id", categoryId).eq("month", month);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export interface SetBatchBudgetEntry {
  categoryId: string;
  limit: number;
}

/** Define múltiplos limites de categorias no mês via RPC transacional, com fallback resiliente. */
export async function setBatchBudgets(
  month: string,
  entries: readonly SetBatchBudgetEntry[],
): Promise<void> {
  try {
    const { setBatchBudgetLimits } = await import("@/data/rpc");
    await setBatchBudgetLimits(month, entries);
  } catch (err: unknown) {
    const isRpcMissing =
      (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "PGRST202") ||
      String(err).includes("set_batch_budget_limits");
    if (isRpcMissing) {
      await Promise.all(
        entries.map((entry) =>
          entry.limit > 0 ? setBudget(entry.categoryId, month, entry.limit) : removeBudget(entry.categoryId, month),
        ),
      );
    } else {
      throw err;
    }
  }
}

