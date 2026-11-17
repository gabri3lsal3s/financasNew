import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import {
  removeGroupTarget as removeGroupTargetRpc,
  savePortfolioHierarchyTargets as saveHierarchyTargetsRpc,
  setGroupTarget,
  type SaveHierarchyTargetsParams,
} from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { GroupTarget } from "@/types";

/**
 * Metas de alocação hierárquicas (Classes % + Setores % por Classe) — §3.11.1.
 * Metas individuais por ativo são derivadas exclusivamente pelas Notas (0–10) + Status.
 */

function mapGroupTarget(row: GroupTarget): GroupTarget {
  return {
    ...row,
    class_name: row.class_name ?? null,
    target_percentage: Number(row.target_percentage),
  };
}

/** Metas de grupo (classe ou setor escopado por classe). */
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

/** Upsert de meta de grupo (classe ou setor escopado por classe). */
export async function saveGroupTarget(
  groupType: "class" | "sector",
  name: string,
  target: number,
  className?: string,
): Promise<void> {
  await setGroupTarget(groupType, name, target, className);
}

/** Remove uma meta de grupo (classe ou setor escopado por classe). */
export async function removeGroupTarget(
  groupType: "class" | "sector",
  name: string,
  className?: string,
): Promise<void> {
  await removeGroupTargetRpc(groupType, name, className);
}

/** Salva atomicamente todas as metas de Classes % e Setores % por Classe. */
export async function saveHierarchyTargets(params: SaveHierarchyTargetsParams): Promise<boolean> {
  return saveHierarchyTargetsRpc(params);
}
