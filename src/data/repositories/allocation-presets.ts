/**
 * Repositório de Cenários & Pré-definições de Metas (Presets de Alocação) — §F39.
 *
 * Operações CRUD com isolamento por usuário (RLS).
 */

import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { AllocationPreset, DbInsert, DbUpdate } from "@/types";
import type { PresetSnapshotInput } from "@/domain/portfolio/presets";

function mapPreset(row: Record<string, unknown>): AllocationPreset {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    asset_targets: Array.isArray(row.asset_targets) ? row.asset_targets : [],
    class_targets: Array.isArray(row.class_targets) ? row.class_targets : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Lista todos os cenários salvos do usuário ordenados por data de criação. */
export async function listAllocationPresets(): Promise<AllocationPreset[]> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("allocation_presets")
      .select("*")
      .order("created_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).map(mapPreset);
}

/** Cria um novo cenário de alocação de metas. */
export async function createAllocationPreset(input: PresetSnapshotInput): Promise<AllocationPreset> {
  const { data: authData } = await getSupabase().auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    throw new AppError("session-expired", "Usuário não autenticado");
  }

  const insertPayload: DbInsert<AllocationPreset> = {
    user_id: userId,
    name: input.name,
    description: input.description ?? null,
    asset_targets: input.asset_targets,
    class_targets: input.class_targets,
  };

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("allocation_presets")
      .insert(insertPayload)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return mapPreset(data!);
}

/** Atualiza um cenário existente. */
export async function updateAllocationPreset(
  id: string,
  input: Partial<PresetSnapshotInput>,
): Promise<AllocationPreset> {
  const updatePayload: DbUpdate<AllocationPreset> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.asset_targets !== undefined) updatePayload.asset_targets = input.asset_targets;
  if (input.class_targets !== undefined) updatePayload.class_targets = input.class_targets;

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("allocation_presets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return mapPreset(data!);
}

/** Exclui um cenário. */
export async function deleteAllocationPreset(id: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase().from("allocation_presets").delete().eq("id", id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
