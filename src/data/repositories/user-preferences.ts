import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { AppMode, DbInsert, DbUpdate, UserCustomSettings, UserPreferences } from "@/types";

/**
 * Preferências do usuário (§3.10 / §3.11).
 */

function mapPreferences(row: UserPreferences): UserPreferences {
  return {
    ...row,
    app_mode: row.app_mode ?? "investor",
    custom_settings: row.custom_settings ?? {},
  };
}

/** Preferências do usuário logado (ou null se ainda não criadas). */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  let user_id: string;
  try {
    user_id = await currentUserId();
  } catch {
    return null;
  }

  const { data, error } = await resolveQuery<UserPreferences>(
    getSupabase().from("user_preferences").select("*").eq("user_id", user_id).maybeSingle(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapPreferences(data) : null;
}

export type ReminderPreferencesInput = {
  remindersEnabled?: boolean;
  reminderDaysBeforeDebt?: number;
  reminderDaysBeforeBill?: number;
  weeklyDigestEnabled?: boolean;
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
  if (prefs.weeklyDigestEnabled !== undefined) {
    input.weekly_digest_enabled = prefs.weeklyDigestEnabled;
  }

  const { error } = await getSupabase().from("user_preferences").update(input).eq("user_id", user_id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/** Fila serializada por usuário para impedir lost updates em alterações concorrentes de custom_settings. */
const customSettingsWriteQueue = new Map<string, Promise<void>>();

/** Atualiza as configurações customizadas de interface e ergonomia salvas na nuvem (§3.10). */
export async function updateCustomSettings(patch: Partial<UserCustomSettings>): Promise<void> {
  const user_id = await currentUserId();
  const previous = customSettingsWriteQueue.get(user_id) ?? Promise.resolve();

  const task = previous
    .catch(() => undefined)
    .then(async () => {
      // Busca o registro atual dentro da fila serializada para merge seguro de JSON
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
        bankAssistant: {
          ...(current?.custom_settings?.bankAssistant ?? {}),
          ...(patch.bankAssistant ?? {}),
        },
        deviceNotifications: {
          ...(current?.custom_settings?.deviceNotifications ?? {}),
          ...(patch.deviceNotifications ?? {}),
          quietHours:
            patch.deviceNotifications?.quietHours !== undefined ||
            current?.custom_settings?.deviceNotifications?.quietHours !== undefined
              ? {
                  ...(current?.custom_settings?.deviceNotifications?.quietHours ?? {}),
                  ...(patch.deviceNotifications?.quietHours ?? {}),
                }
              : undefined,
          dismissedPermissionAlerts: {
            ...(current?.custom_settings?.deviceNotifications?.dismissedPermissionAlerts ?? {}),
            ...(patch.deviceNotifications?.dismissedPermissionAlerts ?? {}),
          },
        },
        notificationCategories:
          patch.notificationCategories !== undefined ||
          current?.custom_settings?.notificationCategories !== undefined
            ? {
                ...(current?.custom_settings?.notificationCategories ?? {}),
                ...(patch.notificationCategories ?? {}),
              }
            : undefined,
        merchantLearning: {
          ...(current?.custom_settings?.merchantLearning ?? {}),
          ...(patch.merchantLearning ?? {}),
        },
        cardDigitsMapping: {
          ...(current?.custom_settings?.cardDigitsMapping ?? {}),
          ...(patch.cardDigitsMapping ?? {}),
        },
        bankCardMapping: {
          ...(current?.custom_settings?.bankCardMapping ?? {}),
          ...(patch.bankCardMapping ?? {}),
        },
        emergencyFundConfig:
          patch.emergencyFundConfig !== undefined
            ? {
                ...(current?.custom_settings?.emergencyFundConfig ?? {}),
                ...patch.emergencyFundConfig,
              }
            : current?.custom_settings?.emergencyFundConfig,
        splitPreferences:
          patch.splitPreferences !== undefined
            ? {
                ...(current?.custom_settings?.splitPreferences ?? {}),
                ...patch.splitPreferences,
              }
            : current?.custom_settings?.splitPreferences,
        dashboardAlertDismissals:
          patch.dashboardAlertDismissals !== undefined
            ? {
                ...(current?.custom_settings?.dashboardAlertDismissals ?? {}),
                ...patch.dashboardAlertDismissals,
                goals: {
                  ...(current?.custom_settings?.dashboardAlertDismissals?.goals ?? {}),
                  ...(patch.dashboardAlertDismissals?.goals ?? {}),
                },
                cards: {
                  ...(current?.custom_settings?.dashboardAlertDismissals?.cards ?? {}),
                  ...(patch.dashboardAlertDismissals?.cards ?? {}),
                },
              }
            : current?.custom_settings?.dashboardAlertDismissals,
        portfolioAlertDismissals:
          patch.portfolioAlertDismissals !== undefined
            ? {
                ...(current?.custom_settings?.portfolioAlertDismissals ?? {}),
                ...patch.portfolioAlertDismissals,
              }
            : current?.custom_settings?.portfolioAlertDismissals,
        dividendAutomation:
          patch.dividendAutomation !== undefined
            ? {
                ...(current?.custom_settings?.dividendAutomation ?? {}),
                ...patch.dividendAutomation,
              }
            : current?.custom_settings?.dividendAutomation,
        advisorDismissals:
          patch.advisorDismissals !== undefined
            ? {
                ...(current?.custom_settings?.advisorDismissals ?? {}),
                ...patch.advisorDismissals,
              }
            : current?.custom_settings?.advisorDismissals,
      };

      const { error } = await getSupabase()
        .from("user_preferences")
        .upsert(
          {
            user_id,
            custom_settings: mergedSettings,
          } as unknown as DbInsert<UserPreferences>,
          { onConflict: "user_id" },
        );
      if (error) {
        const classified = classifyError(error);
        throw new AppError(classified.kind, classified.message, error);
      }
    });

  customSettingsWriteQueue.set(user_id, task);
  try {
    await task;
  } finally {
    if (customSettingsWriteQueue.get(user_id) === task) {
      customSettingsWriteQueue.delete(user_id);
    }
  }
}

/** Atualiza o perfil de visualização da aplicação (Modo Essencial vs Modo Investidor) (§Plano 07). */
export async function updateAppMode(appMode: AppMode): Promise<void> {
  const user_id = await currentUserId();
  const input: DbUpdate<UserPreferences> = {
    app_mode: appMode,
  };

  const { error } = await getSupabase().from("user_preferences").update(input).eq("user_id", user_id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

