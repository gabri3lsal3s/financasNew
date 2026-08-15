/**
 * Exportação & restauração (F22) — integração remota.
 *
 * `fetchAllUserData` lê todas as tabelas do usuário sob RLS (o backup só
 * contém dados do próprio usuário). `restoreBackup` delega ao RPC transacional
 * `restore_backup` (migração 0010) — wipe + insert com IDs originais num único
 * passo atômico, forçando user_id = auth.uid() (defesa contra injeção).
 */

import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { BACKUP_TABLE_KEYS, buildBackupPayload } from "@/domain/export";
import type { BackupData, BackupPayload, BackupRow, RestoreSummary } from "@/domain/export";
import { AppError, classifyError } from "@/services/errors";

/** Busca todas as tabelas do usuário (paralelo; RLS filtra por owner). */
export async function fetchAllUserData(): Promise<BackupPayload> {
  const entries = await Promise.all(
    BACKUP_TABLE_KEYS.map(async (table) => {
      const { data, error } = await resolveQuery<BackupRow[]>(getSupabase().from(table).select("*"));
      if (error) {
        const classified = classifyError(error);
        throw new AppError(classified.kind, classified.message, error);
      }
      return [table, data ?? []] as const;
    }),
  );

  const data = Object.fromEntries(entries) as unknown as BackupData;
  return buildBackupPayload(data);
}

/** Restaura o backup via RPC transacional (substitui todos os dados do usuário). */
export async function restoreBackup(payload: BackupPayload): Promise<RestoreSummary> {
  const { data, error } = await resolveQuery<RestoreSummary>(
    getSupabase().rpc("restore_backup", { p_backup: payload }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ?? {};
}
