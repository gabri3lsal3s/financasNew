import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { AdminTelegramSettings, DbInsert } from "@/types";

export interface UpdateTelegramSettingsInput {
  notify_support?: boolean;
  notify_git?: boolean;
  notify_deploys?: boolean;
  notify_analytics?: boolean;
  notify_new_users?: boolean;
  silent_mode?: boolean;
}

const DEFAULT_SETTINGS: AdminTelegramSettings = {
  id: "global",
  notify_support: true,
  notify_git: true,
  notify_deploys: true,
  notify_analytics: false,
  notify_new_users: true,
  silent_mode: false,
  updated_at: new Date().toISOString(),
  updated_by: null,
};

/**
 * Consulta as preferências do bot Telegram do painel administrativo.
 */
export async function getAdminTelegramSettings(): Promise<AdminTelegramSettings> {
  const { data, error } = await resolveQuery<AdminTelegramSettings>(
    getSupabase()
      .from("admin_telegram_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? DEFAULT_SETTINGS;
}

/**
 * Atualiza as preferências do bot Telegram. Requer permissão de admin via RLS.
 */
export async function updateAdminTelegramSettings(
  input: UpdateTelegramSettingsInput,
): Promise<AdminTelegramSettings> {
  const current = await getAdminTelegramSettings();
  const fullRecord: AdminTelegramSettings = {
    ...current,
    ...input,
    id: "global",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await resolveQuery<AdminTelegramSettings>(
    getSupabase()
      .from("admin_telegram_settings")
      .upsert(fullRecord as DbInsert<AdminTelegramSettings>)
      .select()
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}
