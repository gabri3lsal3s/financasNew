import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { removeGroupTarget as removeGroupTargetRpc, setAllocationTargets, setGroupTarget } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { AllocationTarget, GroupTarget } from "@/types";

/**
 * Metas de alocação — integração remota (§3.11.1).
 * Edição em lote via RPC `set_allocation_targets` (transacional — valida a
 * soma final ≤ 100% após o lote; o trigger por linha não cobre o lote).
 */

export interface AllocationTargetInput {
  assetId: string;
  /** 0–100. */
  target: number;
}

function mapTarget(row: AllocationTarget): AllocationTarget {
  return { ...row, target_percentage: Number(row.target_percentage) };
}

function mapGroupTarget(row: GroupTarget): GroupTarget {
  return { ...row, target_percentage: Number(row.target_percentage) };
}

/** Todas as metas por ativo do usuário. */
export async function listAllocationTargets(): Promise<AllocationTarget[]> {
  const { data, error } = await resolveQuery<AllocationTarget[]>(
    getSupabase().from("allocation_targets").select("*"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapTarget);
}

/**
 * Substitui o conjunto de metas por ativo em UMA transação (RPC D1):
 * valida a soma final ≤ 100% — excedeu, nada é salvo.
 */
export async function saveAllocationTargets(targets: AllocationTargetInput[]): Promise<void> {
  await setAllocationTargets(
    targets.map((t) => ({ assetId: t.assetId, target: t.target })),
  );
}

/** Metas de grupo (classe ou setor). */
export async function listGroupTargets(groupType: "class" | "sector"): Promise<GroupTarget[]> {
  const { data, error } = await resolveQuery<GroupTarget[]>(
    getSupabase().from(groupType === "class" ? "class_targets" : "sector_targets").select("*"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapGroupTarget);
}

/** Upsert de meta de grupo (classe ou setor). */
export async function saveGroupTarget(
  groupType: "class" | "sector",
  name: string,
  target: number,
): Promise<void> {
  await setGroupTarget(groupType, name, target);
}

/** Remove uma meta de grupo. */
export async function removeGroupTarget(groupType: "class" | "sector", name: string): Promise<void> {
  await removeGroupTargetRpc(groupType, name);
}
