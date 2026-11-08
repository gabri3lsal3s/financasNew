import { useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Select,
  type SelectOption,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
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

export const DAILY_REMINDER_TIME_OPTIONS: SelectOption[] = [
  { value: "19:00", label: "19:00 (Início da noite)" },
  { value: "20:00", label: "20:00 (Padrão sugerido)" },
  { value: "21:00", label: "21:00" },
  { value: "22:00", label: "22:00 (Final da noite)" },
];

export const REMINDER_DAYS_OPTIONS: SelectOption[] = [
  { value: "0", label: "No dia do vencimento" },
  { value: "1", label: "1 dia antes" },
  { value: "2", label: "2 dias antes" },
  { value: "3", label: "3 dias antes (recomendado)" },
  { value: "5", label: "5 dias antes" },
  { value: "7", label: "7 dias antes (1 semana)" },
  { value: "10", label: "10 dias antes" },
  { value: "15", label: "15 dias antes" },
  { value: "30", label: "30 dias antes (1 mês)" },
];

export interface RemindersPreferencesFormProps {
  className?: string;
  isInsideModal?: boolean;
}

/**
 * Formulário compartilhado de preferências de lembretes e notificações.
 * Reaproveitado tanto no card de Configurações quanto no modal de Lembretes.
 */
export function RemindersPreferencesForm({
  className,
}: RemindersPreferencesFormProps) {
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
    triggerSensory("toggle");
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
    triggerSensory("toggle");
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
    triggerSensory("toggle");
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
      {/* 1. Lembretes no App */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleToggleReminders(!remindersEnabled)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggleReminders(!remindersEnabled);
          }
        }}
        className={cn(
          "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
          remindersEnabled
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
            : "border-border/80 bg-surface hover:bg-surface-hover",
        )}
      >
        <div className="pr-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              Lembretes no Aplicativo
            </span>
            <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
              {remindersEnabled ? "Ativado" : "Desativado"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Exibe avisos sobre faturas e dívidas no sino do cabeçalho e na central de lembretes.
          </div>
        </div>
        <Checkbox
          checked={remindersEnabled}
          onCheckedChange={handleToggleReminders}
          aria-label="Habilitar Lembretes no Aplicativo"
        />
      </div>

      {remindersEnabled && (
        <div className="grid gap-3.5 pt-1 sm:grid-cols-2">
          {/* Antecedência para Faturas */}
          {hasFeature("cards") && (
            <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5">
              <div>
                <div className="font-semibold text-xs text-foreground">
                  Antecedência para Faturas de Cartão
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Momento do alerta antes do fechamento/vencimento.
                </p>
              </div>

              <Select
                value={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                    ? String(billDaysBefore)
                    : "custom"
                }
                onValueChange={(val) => {
                  if (val !== "custom") {
                    handleUpdateBillDays(val);
                  }
                }}
                options={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                    ? REMINDER_DAYS_OPTIONS
                    : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${billDaysBefore} dias (Personalizado)` }]
                }
                ariaLabel="Seletor de dias de antecedência para faturas"
              />
            </div>
          )}

          {/* Antecedência para Dívidas */}
          {hasFeature("debts") && (
            <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5">
              <div>
                <div className="font-semibold text-xs text-foreground">
                  Antecedência para Dívidas
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Momento do alerta antes da data de quitação.
                </p>
              </div>

              <Select
                value={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                    ? String(debtDaysBefore)
                    : "custom"
                }
                onValueChange={(val) => {
                  if (val !== "custom") {
                    handleUpdateDebtDays(val);
                  }
                }}
                options={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                    ? REMINDER_DAYS_OPTIONS
                    : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${debtDaysBefore} dias (Personalizado)` }]
                }
                ariaLabel="Seletor de dias de antecedência para dívidas"
              />
            </div>
          )}
        </div>
      )}

      {/* 2. Notificações no Dispositivo (Push OS) */}
      <div className="pt-2 border-t border-border/80 space-y-3">
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="pr-4 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Notificações de Contas no Dispositivo
                </span>
                <Badge
                  variant={
                    !dueNotificationsActive
                      ? "muted"
                      : postNotificationsGranted
                        ? "positive"
                        : "warning"
                  }
                  size="xs"
                >
                  {!dueNotificationsActive
                    ? "Desativado"
                    : postNotificationsGranted
                      ? "Ativado"
                      : "Permissão Pendente"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Receba alertas do sistema operacional (Android ou navegador) no dia do vencimento de faturas e dívidas.
              </div>
            </div>
            <Checkbox
              checked={dueNotificationsActive}
              onCheckedChange={handleToggleDueNotifications}
              aria-label="Habilitar Notificações de Contas no Dispositivo"
            />
          </div>

          {dueNotificationsActive && !postNotificationsGranted && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/5 gap-2.5">
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground block">
                  Permissão de notificações pendente
                </span>
                O recurso está marcado como ativo, mas o sistema operacional bloqueou notificações para o app.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void requestPostNotifications()}
                  className="text-xs h-7 px-2.5 border-warning/40 hover:bg-warning/10 text-foreground cursor-pointer"
                >
                  Autorizar no Sistema
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleToggleDueNotifications(false)}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Desativar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Lembrete de Fechamento Diário */}
      <div className="pt-2 border-t border-border/80 space-y-3">
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="pr-4 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Lembrete de Fechamento Diário
                </span>
                <Badge
                  variant={
                    !dailyReminderActive
                      ? "muted"
                      : postNotificationsGranted
                        ? "positive"
                        : "warning"
                  }
                  size="xs"
                >
                  {!dailyReminderActive
                    ? "Desativado"
                    : postNotificationsGranted
                      ? "Ativado"
                      : "Permissão Pendente"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Receba um lembrete no horário configurado com botões rápidos para registrar gastos do dia.
              </div>
            </div>
            <Checkbox
              checked={dailyReminderActive}
              onCheckedChange={handleToggleDailyReminder}
              aria-label="Habilitar Lembrete de Fechamento Diário"
            />
          </div>

          {dailyReminderActive && !postNotificationsGranted && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/5 gap-2.5">
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground block">
                  Permissão de notificações pendente
                </span>
                O lembrete diário está agendado, mas o sistema está bloqueando a exibição.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void requestPostNotifications()}
                  className="text-xs h-7 px-2.5 border-warning/40 hover:bg-warning/10 text-foreground cursor-pointer"
                >
                  Autorizar no Sistema
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleToggleDailyReminder(false)}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Desativar
                </Button>
              </div>
            </div>
          )}
        </div>

        {dailyReminderActive && (
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2">
            <span className="text-xs font-semibold text-foreground">
              Horário do Lembrete
            </span>
            <Select
              value={dailyReminderTime}
              onValueChange={handleDailyReminderTimeChange}
              options={DAILY_REMINDER_TIME_OPTIONS}
              ariaLabel="Selecione o horário para o lembrete diário"
            />
            <p className="text-[11px] text-muted-foreground">
              O aplicativo emitirá a notificação programada todos os dias no horário selecionado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
