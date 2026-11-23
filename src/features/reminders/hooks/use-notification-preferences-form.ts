import { useEffect, useState } from "react";
import { isIOS, isStandaloneMode } from "@/app/pwa";
import {
  DEFAULT_QUIET_HOURS,
  parseTimeHHMM,
  type QuietHoursConfig,
} from "@/domain/notifications/schedule";
import { resolveNotificationCategoryPreferences } from "@/domain/notifications/hub";
import { getOptionalHook } from "@/hooks/use-notification-center";
import * as nativeServices from "@/services/native";
import {
  dispatchRemoteTestPush,
  getCurrentWebPushSubscription,
  getStoredFcmToken,
  getVapidPublicKey,
  getWebPushPermissionState,
  isWebPushSupported,
  registerNativeFcmPush,
  subscribeBrowserWebPush,
  unregisterNativeFcmPush,
  unsubscribeBrowserWebPush,
} from "@/services/push";
import { pushToast } from "@/services/toast";
import * as state from "@/state";
import type {
  NotificationCategoryPreferences,
  UserCustomSettings,
} from "@/types";

interface ReminderPreferencesPatch {
  remindersEnabled?: boolean;
  reminderDaysBeforeDebt?: number;
  reminderDaysBeforeBill?: number;
  weeklyDigestEnabled?: boolean;
}

interface WebPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

interface FcmTokenRegistrationInput {
  fcmToken: string;
  deviceLabel?: string | null;
}

function callOptionalNative<TResult>(
  key: string,
  fallback: () => TResult,
  ...args: unknown[]
): TResult {
  if (Reflect.ownKeys(nativeServices).includes(key)) {
    const candidate = (nativeServices as Record<string, unknown>)[key];
    if (typeof candidate === "function") {
      return (candidate as (...fnArgs: unknown[]) => TResult)(...args);
    }
  }
  return fallback();
}

export function useNotificationPreferencesForm() {
  const useUserAccessSafe = getOptionalHook<{
    hasFeature: (key: string) => boolean;
  }>(state, "useUserAccess", () => ({
    hasFeature: () => true,
  }));
  const useUserPreferencesSafe = getOptionalHook(state, "useUserPreferences", () => ({
    data: null as {
      reminders_enabled?: boolean;
      reminder_days_before_bill?: number;
      reminder_days_before_debt?: number;
      weekly_digest_enabled?: boolean;
      custom_settings?: {
        deviceNotifications?: {
          dueNotificationsEnabled?: boolean;
          dailyReminderEnabled?: boolean;
          dailyReminderTime?: string;
          remotePushEnabled?: boolean;
          quietHours?: Partial<QuietHoursConfig>;
        };
        notificationCategories?: NotificationCategoryPreferences;
      };
    } | null,
  }));
  const useUpdateReminderPreferencesSafe = getOptionalHook<{
    mutate: (input: ReminderPreferencesPatch) => void;
    isPending: boolean;
  }>(
    state,
    "useUpdateReminderPreferences",
    () => ({
      mutate: () => {},
      isPending: false,
    }),
  );
  const useUpdateCustomSettingsSafe = getOptionalHook<{
    mutate: (input: Partial<UserCustomSettings>) => void;
    isPending: boolean;
  }>(
    state,
    "useUpdateCustomSettings",
    () => ({
      mutate: () => {},
      isPending: false,
    }),
  );
  const useEnableWebPushMutationSafe = getOptionalHook<{
    mutateAsync: (input: WebPushSubscriptionInput) => Promise<unknown>;
    isPending: boolean;
  }>(
    state,
    "useEnableWebPushSubscription",
    () => ({
      mutateAsync: async () => undefined,
      isPending: false,
    }),
  );
  const useDisableWebPushMutationSafe = getOptionalHook<{
    mutateAsync: (endpoint?: string | null) => Promise<unknown>;
    isPending: boolean;
  }>(
    state,
    "useDisableWebPushSubscription",
    () => ({
      mutateAsync: async () => undefined,
      isPending: false,
    }),
  );
  const useRegisterFcmTokenSafe = getOptionalHook<{
    mutateAsync: (input: FcmTokenRegistrationInput) => Promise<unknown>;
    isPending: boolean;
  }>(
    state,
    "useRegisterFcmToken",
    () => ({
      mutateAsync: async () => undefined,
      isPending: false,
    }),
  );
  const useDisableFcmTokenSafe = getOptionalHook<{
    mutateAsync: (fcmToken?: string | null) => Promise<unknown>;
    isPending: boolean;
  }>(
    state,
    "useDisableFcmToken",
    () => ({
      mutateAsync: async () => undefined,
      isPending: false,
    }),
  );

  const { hasFeature } = useUserAccessSafe();
  const preferencesQuery = useUserPreferencesSafe();
  const updateReminderPreferencesMutation = useUpdateReminderPreferencesSafe();
  const updateCustomSettingsMutation = useUpdateCustomSettingsSafe();
  const enableWebPushMutation = useEnableWebPushMutationSafe();
  const disableWebPushMutation = useDisableWebPushMutationSafe();
  const registerFcmTokenMutation = useRegisterFcmTokenSafe();
  const disableFcmTokenMutation = useDisableFcmTokenSafe();

  const permissionsStatus = nativeServices.usePermissionsStatus();
  const { postNotificationsGranted, requestPostNotifications } = permissionsStatus;
  const isNative = nativeServices.isNativePlatform();
  const webPushSupported = !isNative && isWebPushSupported();
  const webPushConfigured = Boolean(getVapidPublicKey());
  const iosNeedsInstall = !isNative && isIOS() && !isStandaloneMode();
  const webPermissionDenied = !isNative && getWebPushPermissionState() === "denied";

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;
  const weeklyDigestEnabled = Boolean(preferencesQuery.data?.weekly_digest_enabled);
  const cloudDeviceNotifs = preferencesQuery.data?.custom_settings?.deviceNotifications;
  const categoryPreferences = resolveNotificationCategoryPreferences(
    preferencesQuery.data?.custom_settings?.notificationCategories,
  );

  const [localDailyReminderActive, setLocalDailyReminderActive] = useState<boolean | null>(null);
  const [localDailyReminderTime, setLocalDailyReminderTime] = useState<string | null>(null);
  const [localDueNotificationsActive, setLocalDueNotificationsActive] = useState<boolean | null>(null);
  const [localRemotePushEnabled, setLocalRemotePushEnabled] = useState<boolean | null>(null);
  const [browserSubscriptionActive, setBrowserSubscriptionActive] = useState<boolean | null>(null);
  const [nativePermissionDenied, setNativePermissionDenied] = useState(false);
  const [localQuietHours, setLocalQuietHours] = useState<QuietHoursConfig | null>(null);
  const [remotePushBusy, setRemotePushBusy] = useState(false);
  const [testNotificationPending, setTestNotificationPending] = useState(false);

  useEffect(() => {
    if (isNative || !webPushSupported) return;
    let cancelled = false;
    void getCurrentWebPushSubscription().then((sub) => {
      if (cancelled) return;
      const permOk = getWebPushPermissionState() === "granted";
      setBrowserSubscriptionActive(Boolean(sub?.endpoint && permOk));
    });
    return () => {
      cancelled = true;
    };
  }, [isNative, webPushSupported, postNotificationsGranted]);

  const dueNotificationsActive =
    localDueNotificationsActive ??
    cloudDeviceNotifs?.dueNotificationsEnabled ??
    nativeServices.isDueNotificationsEnabled();

  const dailyReminderActive =
    localDailyReminderActive ??
    cloudDeviceNotifs?.dailyReminderEnabled ??
    nativeServices.isDailyReminderEnabled();

  const dailyReminderTime =
    localDailyReminderTime ??
    cloudDeviceNotifs?.dailyReminderTime ??
    nativeServices.getDailyReminderTime();

  const hasActiveNativeToken =
    isNative && Boolean(getStoredFcmToken()) && postNotificationsGranted;

  // Reflete inscrição ativa neste aparelho (token FCM nativo ou PushSubscription Web + permissão concedida)
  const remotePushEnabled = isNative
    ? localRemotePushEnabled !== null
      ? localRemotePushEnabled
      : hasActiveNativeToken ||
        (cloudDeviceNotifs?.remotePushEnabled === true && Boolean(getStoredFcmToken()))
    : localRemotePushEnabled !== null
      ? localRemotePushEnabled
      : browserSubscriptionActive === true;

  const localStoredQuietHours = callOptionalNative("getQuietHoursConfig", () => DEFAULT_QUIET_HOURS);
  const quietHours: QuietHoursConfig = localQuietHours ?? {
    enabled: cloudDeviceNotifs?.quietHours?.enabled ?? localStoredQuietHours.enabled,
    start: cloudDeviceNotifs?.quietHours?.start ?? localStoredQuietHours.start,
    end: cloudDeviceNotifs?.quietHours?.end ?? localStoredQuietHours.end,
  };

  const notifyDevicePrefsChanged = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("axir:device-notification-prefs-changed"));
    }
  };

  const handleRequestDevicePermission = async (): Promise<boolean> => {
    if (!isNative && getWebPushPermissionState() === "denied") {
      pushToast({
        title: "Notificações bloqueadas no navegador",
        description:
          "Clique no ícone de cadeado ou configurações ao lado do endereço do site e permita as notificações.",
        variant: "warning",
      });
      return false;
    }
    const granted = await requestPostNotifications();
    if (!granted) {
      pushToast({
        title: "Permissão não concedida",
        description:
          "Se bloqueado anteriormente, autorize as notificações nas configurações do navegador ou do aparelho.",
        variant: "warning",
      });
    }
    return granted;
  };

  const handleToggleReminders = (enabled: boolean) => {
    updateReminderPreferencesMutation.mutate({ remindersEnabled: enabled });
    if (!enabled) {
      void callOptionalNative("clearAllDueNotifications", () => Promise.resolve());
    }
  };

  const handleUpdateBillDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeBill: num });
    }
  };

  const handleUpdateDebtDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updateReminderPreferencesMutation.mutate({ reminderDaysBeforeDebt: num });
    }
  };

  const handleToggleCategory = (
    key: keyof NotificationCategoryPreferences,
    enabled: boolean,
  ) => {
    updateCustomSettingsMutation.mutate({
      notificationCategories: { [key]: enabled },
    });
  };

  const handleToggleDueNotifications = async (enabled: boolean) => {
    nativeServices.setDueNotificationsEnabled(enabled);
    setLocalDueNotificationsActive(enabled);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dueNotificationsEnabled: enabled },
    });
    notifyDevicePrefsChanged();

    if (enabled) {
      const granted = await requestPostNotifications();
      if (!granted) {
        pushToast({
          title: "Permissão pendente no dispositivo",
          description:
            "Libere as notificações no navegador ou nas configurações do celular para receber alertas de contas.",
          variant: "warning",
        });
      } else {
        pushToast({
          title: "Notificações de contas ativadas",
          description:
            "Você receberá alertas no dispositivo sobre faturas e dívidas próximas do vencimento.",
          variant: "success",
        });
      }
    } else {
      await callOptionalNative("clearAllDueNotifications", () => Promise.resolve());
      pushToast({
        title: "Notificações de contas desativadas",
        variant: "default",
      });
    }
  };

  const handleToggleDailyReminder = async (enabled: boolean) => {
    nativeServices.setDailyReminderEnabled(enabled);
    setLocalDailyReminderActive(enabled);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dailyReminderEnabled: enabled },
    });

    if (enabled) {
      if (!isNative) {
        pushToast({
          title: "Preferência salva na nuvem",
          description: `O lembrete diário às ${dailyReminderTime} será agendado ao acessar no App Android.`,
          variant: "default",
        });
        return;
      }

      const granted = await requestPostNotifications();
      if (!granted) {
        pushToast({
          title: "Permissão pendente no celular",
          description:
            "Habilite as notificações nas configurações do Android para que o lembrete diário toque no horário.",
          variant: "warning",
        });
        return;
      }
      const parsedTime = parseTimeHHMM(dailyReminderTime, 20, 0);
      const scheduled = await nativeServices.scheduleDailyReminder({
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        requestPermission: false,
      });
      if (scheduled) {
        pushToast({
          title: "Lembrete diário ativado",
          description: `Você receberá uma notificação com atalhos todos os dias às ${dailyReminderTime}.`,
          variant: "success",
        });
      }
    } else {
      await nativeServices.cancelDailyReminder();
      pushToast({
        title: "Lembrete diário desativado",
        variant: "default",
      });
    }
  };

  const handleDailyReminderTimeChange = async (time: string) => {
    nativeServices.setDailyReminderTime(time);
    setLocalDailyReminderTime(time);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dailyReminderTime: time },
    });

    if (dailyReminderActive) {
      if (!isNative) {
        pushToast({
          title: "Horário salvo na nuvem",
          description: `Horário ${time} sincronizado para o App Android.`,
          variant: "default",
        });
        return;
      }
      const parsedTime = parseTimeHHMM(time, 20, 0);
      await nativeServices.scheduleDailyReminder({
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        requestPermission: false,
      });
      pushToast({
        title: "Horário atualizado",
        description: `Lembrete diário reprogramado para as ${time}.`,
        variant: "default",
      });
    }
  };

  const handleUpdateQuietHours = (patch: Partial<QuietHoursConfig>) => {
    const saved = callOptionalNative(
      "setQuietHoursConfig",
      () => ({ ...quietHours, ...patch }),
      patch,
    );
    setLocalQuietHours(saved);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { quietHours: saved },
    });
    notifyDevicePrefsChanged();
  };

  const handleToggleNativeRemotePush = async (enabled: boolean) => {
    if (enabled) {
      const result = await registerNativeFcmPush({ requestPermission: true });
      if (!result.ok) {
        if (result.reason === "permission_denied") {
          setNativePermissionDenied(true);
        }
        pushToast({
          title: "Não foi possível ativar os alertas em segundo plano",
          description: result.message,
          variant: "warning",
        });
        return;
      }

      setNativePermissionDenied(false);
      try {
        await registerFcmTokenMutation.mutateAsync({
          fcmToken: result.token,
          deviceLabel: "Android App",
        });
      } catch {
        await unregisterNativeFcmPush();
        setLocalRemotePushEnabled(false);
        pushToast({
          title: "Erro ao salvar ativação",
          description: "Não foi possível registrar este celular no servidor. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      callOptionalNative("setRemotePushEnabled", () => undefined, true);
      setLocalRemotePushEnabled(true);
      updateCustomSettingsMutation.mutate({
        deviceNotifications: { remotePushEnabled: true },
      });
      pushToast({
        title: "Alertas em segundo plano ativados",
        description: "Você receberá avisos importantes neste celular mesmo com o app fechado.",
        variant: "success",
      });
      return;
    }

    const { token } = await unregisterNativeFcmPush();
    if (token) {
      try {
        await disableFcmTokenMutation.mutateAsync(token);
      } catch {
        // Não impede atualização do estado local após remoção no dispositivo
      }
    }
    callOptionalNative("setRemotePushEnabled", () => undefined, false);
    setLocalRemotePushEnabled(false);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { remotePushEnabled: false },
    });
    pushToast({
      title: "Alertas em segundo plano desativados neste aparelho",
      variant: "default",
    });
  };

  const handleToggleRemotePush = async (enabled: boolean) => {
    if (remotePushBusy) return;
    setRemotePushBusy(true);
    try {
      if (isNative) {
        await handleToggleNativeRemotePush(enabled);
        return;
      }

      if (enabled) {
        const result = await subscribeBrowserWebPush();
        if (!result.ok) {
          pushToast({
            title: "Não foi possível ativar os alertas em segundo plano",
            description: result.message,
            variant: "warning",
          });
          return;
        }
        try {
          await enableWebPushMutation.mutateAsync({
            endpoint: result.subscription.endpoint,
            p256dh: result.subscription.p256dh,
            auth: result.subscription.auth,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
        } catch {
          await unsubscribeBrowserWebPush();
          setLocalRemotePushEnabled(false);
          setBrowserSubscriptionActive(false);
          pushToast({
            title: "Erro ao salvar ativação",
            description: "Não foi possível registrar este navegador no servidor. Tente novamente.",
            variant: "destructive",
          });
          return;
        }
        callOptionalNative("setRemotePushEnabled", () => undefined, true);
        setLocalRemotePushEnabled(true);
        setBrowserSubscriptionActive(true);
        updateCustomSettingsMutation.mutate({
          deviceNotifications: { remotePushEnabled: true },
        });
        pushToast({
          title: "Alertas em segundo plano ativados",
          description: "Você receberá avisos importantes neste navegador mesmo com a aba fechada.",
          variant: "success",
        });
      } else {
        const { endpoint } = await unsubscribeBrowserWebPush();
        if (endpoint) {
          try {
            await disableWebPushMutation.mutateAsync(endpoint);
          } catch {
            // Não impede atualização do estado local após remoção no navegador
          }
        }
        callOptionalNative("setRemotePushEnabled", () => undefined, false);
        setLocalRemotePushEnabled(false);
        setBrowserSubscriptionActive(false);
        updateCustomSettingsMutation.mutate({
          deviceNotifications: { remotePushEnabled: false },
        });
        pushToast({
          title: "Alertas em segundo plano desativados neste aparelho",
          variant: "default",
        });
      }
    } finally {
      setRemotePushBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (testNotificationPending) return;
    setTestNotificationPending(true);
    try {
      if (!postNotificationsGranted) {
        const granted = await handleRequestDevicePermission();
        if (!granted) {
          return;
        }
      }

      const deliveredLocal = await callOptionalNative(
        "dispatchLocalOrWebNotification",
        () => Promise.resolve(false),
        {
          id: 2099,
          title: "Notificação de teste do Axir",
          body: "Seus alertas neste dispositivo estão ativos e funcionando corretamente.",
          url: "/configuracoes?tab=notifications",
          tag: "axir_test_notification",
        },
      );

      let deliveredRemote = false;
      if (remotePushEnabled) {
        deliveredRemote = await dispatchRemoteTestPush();
      }

      if (deliveredLocal || deliveredRemote) {
        pushToast({
          title: "Notificação de teste enviada",
          description: deliveredRemote
            ? "Teste local e envio remoto em segundo plano confirmados para este aparelho."
            : "Confira a barra de notificações do seu dispositivo.",
          variant: "success",
        });
      } else {
        pushToast({
          title: "Não foi possível exibir no sistema",
          description:
            "Verifique se o navegador ou sistema operacional permite notificações para o Axir.",
          variant: "warning",
        });
      }
    } finally {
      setTestNotificationPending(false);
    }
  };

  const handleToggleWeeklyDigest = (enabled: boolean) => {
    updateReminderPreferencesMutation.mutate({ weeklyDigestEnabled: enabled });
  };

  return {
    isNative,
    hasFeature,
    postNotificationsGranted,
    requestPostNotifications: handleRequestDevicePermission,
    remindersEnabled,
    billDaysBefore,
    debtDaysBefore,
    categoryPreferences,
    dueNotificationsActive,
    dailyReminderActive,
    dailyReminderTime,
    remotePushEnabled,
    webPushSupported,
    webPushConfigured,
    iosNeedsInstall,
    webPermissionDenied,
    nativePermissionDenied: nativePermissionDenied && !postNotificationsGranted,
    remotePushBusy,
    quietHours,
    testNotificationPending,
    weeklyDigestEnabled,
    isWeeklyDigestPending: updateReminderPreferencesMutation.isPending,
    handleToggleReminders,
    handleUpdateBillDays,
    handleUpdateDebtDays,
    handleToggleCategory,
    handleToggleDueNotifications,
    handleToggleDailyReminder,
    handleDailyReminderTimeChange,
    handleUpdateQuietHours,
    handleToggleRemotePush,
    handleSendTestNotification,
    handleToggleWeeklyDigest,
  };
}
