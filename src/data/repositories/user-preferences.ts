import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbUpdate, UserCustomSettings, UserPreferences } from "@/types";

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
    custom_settings: row.custom_settings ?? {},
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

export type ReminderPreferencesInput = {
  remindersEnabled?: boolean;
  reminderDaysBeforeDebt?: number;
  reminderDaysBeforeBill?: number;
};

/** Atualiza as preferências de lembretes e notificações (§3.10). */
export async function updateReminderPreferences(prefs: ReminderPreferencesInput): Promise<void> {
  const user_id = await currentUserId();
  const input: DbUpdate<UserPreferences> = {};
  if (prefs.remindersEnabled !== undefined) {
    input.reminders_enabled = prefs.remindersEnabled;
  }
  if (prefs.reminderDaysBeforeDebt !== undefined) {
    input.reminder_days_before_debt = prefs.reminderDaysBeforeDebt;
  }
  if (prefs.reminderDaysBeforeBill !== undefined) {
    input.reminder_days_before_bill = prefs.reminderDaysBeforeBill;
  }

  const { error } = await getSupabase().from("user_preferences").update(input).eq("user_id", user_id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/** Atualiza as configurações customizadas de interface e ergonomia salvas na nuvem (§3.10). */
export async function updateCustomSettings(patch: Partial<UserCustomSettings>): Promise<void> {
  const user_id = await currentUserId();
  // Busca o registro atual para merge seguro de JSON
  const current = await getUserPreferences();
  const mergedSettings: UserCustomSettings = {
    ...(current?.custom_settings ?? {}),
    ...patch,
    dashboardWidgets: {
      ...(current?.custom_settings?.dashboardWidgets ?? {}),
      ...(patch.dashboardWidgets ?? {}),
    },
    headerButtons: {
      ...(current?.custom_settings?.headerButtons ?? {}),
      ...(patch.headerButtons ?? {}),
    },
  };

  const input: DbUpdate<UserPreferences> = {
    custom_settings: mergedSettings,
  };

  const { error } = await getSupabase().from("user_preferences").update(input).eq("user_id", user_id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

