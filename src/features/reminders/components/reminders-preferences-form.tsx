import { BellRing } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useNotificationPreferencesForm } from "../hooks/use-notification-preferences-form";
import { DailyClosingReminderCard } from "./prefs/DailyClosingReminderCard";
import { InAppRemindersPrefsCard } from "./prefs/InAppRemindersPrefsCard";
import { QuietHoursPrefsCard } from "./prefs/QuietHoursPrefsCard";
import { UnifiedDeviceAlertsPrefsCard } from "./prefs/UnifiedDeviceAlertsPrefsCard";

export interface RemindersPreferencesFormProps {
  className?: string;
  sections?: "all" | "in-app" | "device";
}

/**
 * Formulário compartilhado de preferências de lembretes e notificações.
 * Reaproveitado tanto nos cards de Configurações quanto no modal rápido de Lembretes.
 */
export function RemindersPreferencesForm({
  className,
  sections = "all",
}: RemindersPreferencesFormProps) {
  const form = useNotificationPreferencesForm();
  const showInApp = sections === "all" || sections === "in-app";
  const showDevice = sections === "all" || sections === "device";

  return (
    <div className={cn("space-y-4", className)}>
      {showInApp ? (
        <InAppRemindersPrefsCard
          remindersEnabled={form.remindersEnabled}
          billDaysBefore={form.billDaysBefore}
          debtDaysBefore={form.debtDaysBefore}
          categoryPreferences={form.categoryPreferences}
          showCards={form.hasFeature("cards")}
          showDebts={form.hasFeature("debts")}
          showBudgets={form.hasFeature("budgets")}
          showFamilyOrTrips={
            form.hasFeature("family_mode") || form.hasFeature("trips")
          }
          onToggleReminders={form.handleToggleReminders}
          onUpdateBillDays={form.handleUpdateBillDays}
          onUpdateDebtDays={form.handleUpdateDebtDays}
          onToggleCategory={form.handleToggleCategory}
        />
      ) : null}

      {showDevice ? (
        <>
          <UnifiedDeviceAlertsPrefsCard
            effectiveDeviceAlertsActive={form.effectiveDeviceAlertsActive}
            pendingPermission={form.deviceAlertsPendingPermission}
            postNotificationsGranted={form.postNotificationsGranted}
            permissionDenied={form.devicePermissionDenied}
            iosNeedsInstall={form.iosNeedsInstall}
            remindersEnabled={form.remindersEnabled}
            isNative={form.isNative}
            isBusy={form.remotePushBusy}
            showTopDivider={showInApp}
            onToggleDeviceAlerts={(enabled) =>
              void form.handleToggleUnifiedDeviceAlerts(enabled)
            }
            onRequestPermission={() => void form.handleToggleUnifiedDeviceAlerts(true)}
          />

          {form.isNative ? (
            <DailyClosingReminderCard
              dailyReminderActive={form.dailyReminderActive}
              pendingPermission={form.dailyReminderPendingPermission}
              dailyReminderTime={form.dailyReminderTime}
              postNotificationsGranted={form.postNotificationsGranted}
              isNative={form.isNative}
              onToggleDailyReminder={(enabled) =>
                void form.handleToggleDailyReminder(enabled)
              }
              onTimeChange={(time) => void form.handleDailyReminderTimeChange(time)}
              onRequestPermission={() => void form.handleToggleDailyReminder(true)}
            />
          ) : null}

          {form.hasActiveDeviceAlert ? (
            <>
              <QuietHoursPrefsCard
                quietHours={form.quietHours}
                onUpdateQuietHours={form.handleUpdateQuietHours}
              />

              <div className="pt-2 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block">
                    Validar entrega neste dispositivo
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Dispara uma notificação de teste para conferir som, banner e permissões neste aparelho.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent="action"
                  disabled={form.testNotificationPending}
                  onClick={() => void form.handleSendTestNotification()}
                  className="gap-1.5 shrink-0"
                >
                  <BellRing className="size-3.5" aria-hidden="true" />
                  Enviar notificação de teste
                </Button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
