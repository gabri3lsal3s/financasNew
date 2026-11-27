import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { mergePersistedAdvisorDismissals } from "@/domain/insights/smart-advisor-rules";
import {
  mergeCarouselDismissals,
  parseCarouselDismissalsMap,
} from "@/domain/notifications/hub";
import { AppError, classifyError } from "@/services/errors";
import type { AppMode, DbInsert, DbUpdate, UserCustomSettings, UserPreferences } from "@/types";

/**
 * Preferências do usuário (§3.10 / §3.11).
 */

export function mapPreferences(row: UserPreferences): UserPreferences {
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
const MAX_CAS_ATTEMPTS = 3;

/**
 * Mescla puramente o estado atual de `custom_settings` com um patch parcial,
 * preservando chaves aninhadas, `zeroGuilt`, `advisorDismissals` e `carouselDismissals`.
 */
export function mergeCustomSettings(
  current: UserCustomSettings | undefined,
  patch: Partial<UserCustomSettings>,
): UserCustomSettings {
  const currentCarousel = parseCarouselDismissalsMap(current?.carouselDismissals).records;
  const patchCarousel = parseCarouselDismissalsMap(patch.carouselDismissals).records;
  const hasCarousel =
    Object.keys(currentCarousel).length > 0 ||
    Object.keys(patchCarousel).length > 0 ||
    patch.carouselDismissals !== undefined;

  return {
    ...(current ?? {}),
    ...patch,
    dashboardWidgets: {
      ...(current?.dashboardWidgets ?? {}),
      ...(patch.dashboardWidgets ?? {}),
    },
    headerButtons: {
      ...(current?.headerButtons ?? {}),
      ...(patch.headerButtons ?? {}),
    },
    bankAssistant: {
      ...(current?.bankAssistant ?? {}),
      ...(patch.bankAssistant ?? {}),
    },
    deviceNotifications: {
      ...(current?.deviceNotifications ?? {}),
      ...(patch.deviceNotifications ?? {}),
      quietHours:
        patch.deviceNotifications?.quietHours !== undefined ||
        current?.deviceNotifications?.quietHours !== undefined
          ? {
              ...(current?.deviceNotifications?.quietHours ?? {}),
              ...(patch.deviceNotifications?.quietHours ?? {}),
            }
          : undefined,
      dismissedPermissionAlerts: {
        ...(current?.deviceNotifications?.dismissedPermissionAlerts ?? {}),
        ...(patch.deviceNotifications?.dismissedPermissionAlerts ?? {}),
      },
    },
    notificationCategories:
      patch.notificationCategories !== undefined ||
      current?.notificationCategories !== undefined
        ? {
            ...(current?.notificationCategories ?? {}),
            ...(patch.notificationCategories ?? {}),
          }
        : undefined,
    merchantLearning: {
      ...(current?.merchantLearning ?? {}),
      ...(patch.merchantLearning ?? {}),
    },
    cardDigitsMapping: {
      ...(current?.cardDigitsMapping ?? {}),
      ...(patch.cardDigitsMapping ?? {}),
    },
    bankCardMapping: {
      ...(current?.bankCardMapping ?? {}),
      ...(patch.bankCardMapping ?? {}),
    },
    emergencyFundConfig:
      patch.emergencyFundConfig !== undefined
        ? {
            ...(current?.emergencyFundConfig ?? {}),
            ...patch.emergencyFundConfig,
          }
        : current?.emergencyFundConfig,
    splitPreferences:
      patch.splitPreferences !== undefined
        ? {
            ...(current?.splitPreferences ?? {}),
            ...patch.splitPreferences,
          }
        : current?.splitPreferences,
    dashboardAlertDismissals:
      patch.dashboardAlertDismissals !== undefined
        ? {
            ...(current?.dashboardAlertDismissals ?? {}),
            ...patch.dashboardAlertDismissals,
            goals: {
              ...(current?.dashboardAlertDismissals?.goals ?? {}),
              ...(patch.dashboardAlertDismissals?.goals ?? {}),
            },
            cards: {
              ...(current?.dashboardAlertDismissals?.cards ?? {}),
              ...(patch.dashboardAlertDismissals?.cards ?? {}),
            },
          }
        : current?.dashboardAlertDismissals,
    portfolioAlertDismissals:
      patch.portfolioAlertDismissals !== undefined
        ? {
            ...(current?.portfolioAlertDismissals ?? {}),
            ...patch.portfolioAlertDismissals,
          }
        : current?.portfolioAlertDismissals,
    carouselDismissals: hasCarousel
      ? mergeCarouselDismissals(currentCarousel, patchCarousel)
      : current?.carouselDismissals,
    dividendAutomation:
      patch.dividendAutomation !== undefined
        ? {
            ...(current?.dividendAutomation ?? {}),
            ...patch.dividendAutomation,
          }
        : current?.dividendAutomation,
    advisorDismissals: mergePersistedAdvisorDismissals(
      current?.advisorDismissals,
      patch.advisorDismissals,
    ),
    advisorDecayMeta:
      patch.advisorDecayMeta !== undefined
        ? {
            ...(current?.advisorDecayMeta ?? {}),
            ...patch.advisorDecayMeta,
          }
        : current?.advisorDecayMeta,
  };
}

async function fetchUserPreferencesForUid(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await resolveQuery<UserPreferences>(
    getSupabase().from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapPreferences(data) : null;
}

/** Atualiza as configurações customizadas de interface e ergonomia salvas na nuvem (§3.10) com CAS otimista. */
export async function updateCustomSettings(patch: Partial<UserCustomSettings>): Promise<void> {
  const user_id = await currentUserId();
  const previous = customSettingsWriteQueue.get(user_id) ?? Promise.resolve();

  const task = previous
    .catch(() => undefined)
    .then(async () => {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const current = await fetchUserPreferencesForUid(user_id);

        if (!current) {
          const initialSettings: UserCustomSettings = {
            ...mergeCustomSettings(undefined, patch),
            _settingsRev: 1,
          };
          const { error: insertError } = await getSupabase()
            .from("user_preferences")
            .insert({
              user_id,
              custom_settings: initialSettings,
            } as unknown as DbInsert<UserPreferences>)
            .select("user_id");

          if (!insertError) {
            return;
          }
          const code = (insertError as { code?: string }).code;
          if (code === "23505") {
            continue;
          }
          const classified = classifyError(insertError);
          throw new AppError(classified.kind, classified.message, insertError);
        }

        const prevRev = current.custom_settings?._settingsRev;
        const hasValidPrevRev = typeof prevRev === "number" && Number.isFinite(prevRev);
        const nextRev = (hasValidPrevRev ? prevRev : 0) + 1;
        const mergedSettings: UserCustomSettings = {
          ...mergeCustomSettings(current.custom_settings, patch),
          _settingsRev: nextRev,
        };

        const baseUpdate = getSupabase()
          .from("user_preferences")
          .update({ custom_settings: mergedSettings } as unknown as DbUpdate<UserPreferences>)
          .eq("user_id", user_id);

        const conditioned = hasValidPrevRev
          ? baseUpdate.eq("custom_settings->>_settingsRev", String(prevRev))
          : baseUpdate.is("custom_settings->>_settingsRev", null);

        const { data, error } = await conditioned.select("user_id");
        if (error) {
          const classified = classifyError(error);
          throw new AppError(classified.kind, classified.message, error);
        }
        if (Array.isArray(data) && data.length > 0) {
          return;
        }
      }

      throw new AppError(
        "validation",
        "Suas preferências foram atualizadas em outro dispositivo. Tente novamente.",
      );
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

