import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbUpdate, UserPreferences } from "@/types";

/**
 * Preferências do usuário — travas setoriais (§3.11.1/§3.11.3.5).
 * `max_sector_acoes` / `max_sector_fiis` limitam a exposição por setor.
 */

export type SectorCaps = {
  maxSectorAcoes: number | null;
  maxSectorFiis: number | null;
};

function mapPreferences(row: UserPreferences): UserPreferences {
  return {
    ...row,
    max_sector_acoes: row.max_sector_acoes === null ? null : Number(row.max_sector_acoes),
    max_sector_fiis: row.max_sector_fiis === null ? null : Number(row.max_sector_fiis),
  };
}

/** Preferências do usuário logado (ou null se ainda não criadas). */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<UserPreferences>(
    getSupabase().from("user_preferences").select("*").eq("user_id", user_id).maybeSingle(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapPreferences(data) : null;
}

/** Atualiza as travas setoriais (max_sector_acoes / max_sector_fiis). */
export async function updateSectorCaps(caps: SectorCaps): Promise<void> {
  const user_id = await currentUserId();
  const input: DbUpdate<UserPreferences> = {
    max_sector_acoes: caps.maxSectorAcoes,
    max_sector_fiis: caps.maxSectorFiis,
  };
  const { error } = await getSupabase().from("user_preferences").update(input).eq("user_id", user_id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
