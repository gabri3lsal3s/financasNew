import { useState } from "react";
import {
  useUserPreferences,
  useUpdateReminderPreferences,
  useUpdateCustomSettings,
  useUserAccess,
} from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  isDailyReminderEnabled,
  setDailyReminderEnabled,
  isDueNotificationsEnabled,
  setDueNotificationsEnabled,
  getDailyReminderTime,
  setDailyReminderTime,
  scheduleDailyReminder,
  cancelDailyReminder,
  usePermissionsStatus,
} from "@/services/native";
import { DailyClosingReminderCard } from "./prefs/DailyClosingReminderCard";
import { DueNotificationsPrefsCard } from "./prefs/DueNotificationsPrefsCard";
import { InAppRemindersPrefsCard } from "./prefs/InAppRemindersPrefsCard";

export interface RemindersPreferencesFormProps {
  className?: string;
}

/**
 * Formulário compartilhado de preferências de lembretes e notificações.
 * Reaproveitado tanto no card de Configurações quanto no modal de Lembretes.
 */
export function RemindersPreferencesForm({ className }: RemindersPreferencesFormProps) {
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateReminderPreferencesMutation = useUpdateReminderPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const { postNotificationsGranted, requestPostNotifications } = usePermissionsStatus();

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;
  const cloudDeviceNotifs = preferencesQuery.data?.custom_settings?.deviceNotifications;

  const [localDailyReminderActive, setLocalDailyReminderActive] = useState<boolean | null>(null);
  const [localDailyReminderTime, setLocalDailyReminderTime] = useState<string | null>(null);
  const [localDueNotificationsActive, setLocalDueNotificationsActive] = useState<boolean | null>(null);

  const dueNotificationsActive =
    localDueNotificationsActive ??
    cloudDeviceNotifs?.dueNotificationsEnabled ??
    isDueNotificationsEnabled();

  const dailyReminderActive =
    localDailyReminderActive ??
    cloudDeviceNotifs?.dailyReminderEnabled ??
    isDailyReminderEnabled();

  const dailyReminderTime =
    localDailyReminderTime ??
    cloudDeviceNotifs?.dailyReminderTime ??
    getDailyReminderTime();

  const handleToggleReminders = (enabled: boolean) => {
    updateReminderPreferencesMutation.mutate({ remindersEnabled: enabled });
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

  const handleToggleDueNotifications = async (enabled: boolean) => {
    setDueNotificationsEnabled(enabled);
    setLocalDueNotificationsActive(enabled);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dueNotificationsEnabled: enabled },
    });

    if (enabled) {
      const granted = await requestPostNotifications();
      if (!granted) {
        pushToast({
          title: "Permissão pendente no sistema",
          description:
            "Habilite as notificações no navegador ou nas configurações do seu celular para receber alertas de contas.",
          variant: "warning",
        });
      } else {
        pushToast({
          title: "Notificações de contas ativadas",
          description: "Você receberá alertas no dispositivo sobre faturas e dívidas próximas do vencimento.",
          variant: "success",
        });
      }
    } else {
      pushToast({
        title: "Notificações de contas desativadas",
        variant: "default",
      });
    }
  };

  const handleToggleDailyReminder = async (enabled: boolean) => {
    setDailyReminderEnabled(enabled);
    setLocalDailyReminderActive(enabled);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dailyReminderEnabled: enabled },
    });

    if (enabled) {
      const granted = await requestPostNotifications();
      if (!granted) {
        pushToast({
          title: "Permissão pendente no sistema",
          description: "Habilite as notificações nas configurações do seu celular para que o lembrete seja entregue.",
          variant: "warning",
        });
      }
      const [h, m] = dailyReminderTime.split(":").map(Number);
      const scheduled = await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      if (scheduled) {
        pushToast({
          title: "Lembrete diário ativado",
          description: `Você receberá uma notificação com botões rápidos todos os dias às ${dailyReminderTime}.`,
          variant: "success",
        });
      }
    } else {
      await cancelDailyReminder();
      pushToast({
        title: "Lembrete diário desativado",
        variant: "default",
      });
    }
  };

  const handleDailyReminderTimeChange = async (time: string) => {
    setDailyReminderTime(time);
    setLocalDailyReminderTime(time);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: { dailyReminderTime: time },
    });

    if (dailyReminderActive) {
      const [h, m] = time.split(":").map(Number);
      await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      pushToast({
        title: "Horário atualizado",
        description: `Lembrete diário reprogramado para as ${time}.`,
        variant: "default",
      });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <InAppRemindersPrefsCard
        remindersEnabled={remindersEnabled}
        billDaysBefore={billDaysBefore}
        debtDaysBefore={debtDaysBefore}
        showCards={hasFeature("cards")}
        showDebts={hasFeature("debts")}
        onToggleReminders={handleToggleReminders}
        onUpdateBillDays={handleUpdateBillDays}
        onUpdateDebtDays={handleUpdateDebtDays}
      />

      <DueNotificationsPrefsCard
        dueNotificationsActive={dueNotificationsActive}
        postNotificationsGranted={postNotificationsGranted}
        onToggleDueNotifications={(enabled) => void handleToggleDueNotifications(enabled)}
        onRequestPermission={() => void requestPostNotifications()}
      />

      <DailyClosingReminderCard
        dailyReminderActive={dailyReminderActive}
        dailyReminderTime={dailyReminderTime}
        postNotificationsGranted={postNotificationsGranted}
        onToggleDailyReminder={(enabled) => void handleToggleDailyReminder(enabled)}
        onTimeChange={(time) => void handleDailyReminderTimeChange(time)}
        onRequestPermission={() => void requestPostNotifications()}
      />
    </div>
  );
}
