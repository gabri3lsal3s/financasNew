import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
  type SelectOption,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import {
  useUserPreferences,
  useUpdateReminderPreferences,
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
  checkNotificationPermissions,
  requestNotificationPermissions,
} from "@/services/native";

const DAILY_REMINDER_TIME_OPTIONS: SelectOption[] = [
  { value: "19:00", label: "19:00 (Início da noite)" },
  { value: "20:00", label: "20:00 (Padrão sugerido)" },
  { value: "21:00", label: "21:00" },
  { value: "22:00", label: "22:00 (Final da noite)" },
];

const REMINDER_DAYS_OPTIONS: SelectOption[] = [
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

export function RemindersCard() {
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updateReminderPreferencesMutation = useUpdateReminderPreferences();

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;

  const [dailyReminderActive, setDailyReminderActive] = useState(() => isDailyReminderEnabled());
  const [dailyReminderTime, setDailyReminderTimeState] = useState(() => getDailyReminderTime());
  const [dueNotificationsActive, setDueNotificationsActive] = useState(() => isDueNotificationsEnabled());
  const [devicePermissionGranted, setDevicePermissionGranted] = useState(false);

  useEffect(() => {
    void checkNotificationPermissions().then((res) => {
      setDevicePermissionGranted(res.granted);
    });
  }, []);

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
    if (enabled) {
      const perm = await requestNotificationPermissions();
      setDevicePermissionGranted(perm.granted);
      if (!perm.granted) {
        pushToast({
          title: "Permissão de notificação necessária",
          description:
            "Habilite as notificações no navegador ou nas configurações do seu celular para receber alertas de contas.",
          variant: "destructive",
        });
        return;
      }
      setDueNotificationsEnabled(true);
      setDueNotificationsActive(true);
      pushToast({
        title: "Notificações de contas ativadas",
        description: "Você receberá alertas no dispositivo sobre faturas e dívidas próximas do vencimento.",
        variant: "success",
      });
    } else {
      setDueNotificationsEnabled(false);
      setDueNotificationsActive(false);
      pushToast({
        title: "Notificações de contas desativadas",
        variant: "default",
      });
    }
  };

  const handleToggleDailyReminder = async (enabled: boolean) => {
    if (enabled) {
      const perm = await requestNotificationPermissions();
      if (!perm.granted) {
        pushToast({
          title: "Permissão de notificação necessária",
          description: "Habilite as notificações nas configurações do seu celular para receber o lembrete.",
          variant: "destructive",
        });
        return;
      }
      const [h, m] = dailyReminderTime.split(":").map(Number);
      const scheduled = await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      if (scheduled) {
        setDailyReminderEnabled(true);
        setDailyReminderActive(true);
        pushToast({
          title: "Lembrete diário ativado",
          description: `Você receberá uma notificação com botões rápidos todos os dias às ${dailyReminderTime}.`,
          variant: "success",
        });
      } else {
        pushToast({
          title: "Falha ao agendar",
          description: "Não foi possível agendar o lembrete diário no dispositivo.",
          variant: "destructive",
        });
      }
    } else {
      await cancelDailyReminder();
      setDailyReminderEnabled(false);
      setDailyReminderActive(false);
      pushToast({
        title: "Lembrete diário desativado",
        variant: "default",
      });
    }
  };

  const handleDailyReminderTimeChange = async (time: string) => {
    setDailyReminderTimeState(time);
    setDailyReminderTime(time);
    if (dailyReminderActive) {
      const [h, m] = time.split(":").map(Number);
      await scheduleDailyReminder({ hour: h || 20, minute: m || 0 });
      pushToast({
        title: "Horário atualizado",
        description: `Lembrete diário reagendado para às ${time}.`,
        variant: "success",
      });
    }
  };

  if (!hasFeature("reminders")) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2 min-w-0">
            <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Lembretes &amp; Notificações</span>
          </span>
          <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
            {remindersEnabled ? "Ativado" : "Desativado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <div className="font-semibold text-sm text-foreground">
              Habilitar Lembretes Automáticos
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Notifica sobre faturas de cartão e dívidas próximas do vencimento no sino do cabeçalho.
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

        {/* Notificações no Dispositivo para Contas a Vencer */}
        <div className="pt-3.5 border-t border-border/80 space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
            <div className="pr-4 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Notificações de Contas no Dispositivo
                </span>
                <Badge variant={devicePermissionGranted ? "positive" : "muted"} size="xs">
                  {devicePermissionGranted ? "Permitido" : "Não autorizado"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Emite alertas no celular ou navegador quando houver faturas ou dívidas vencendo hoje ou atrasadas.
              </div>
            </div>
            <Checkbox
              checked={dueNotificationsActive}
              onCheckedChange={handleToggleDueNotifications}
              aria-label="Habilitar Notificações de Contas no Dispositivo"
            />
          </div>
        </div>

        {/* Lembrete de Fechamento Diário */}
        <div className="pt-3.5 border-t border-border/80 space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
            <div className="pr-4 space-y-0.5">
              <div className="font-semibold text-sm text-foreground">
                Lembrete de Fechamento Diário
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Receba uma notificação no dispositivo com ações rápidas para registrar despesas e receitas do dia.
              </div>
            </div>
            <Checkbox
              checked={dailyReminderActive}
              onCheckedChange={handleToggleDailyReminder}
              aria-label="Habilitar Lembrete de Fechamento Diário"
            />
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
      </CardContent>
    </Card>
  );
}
