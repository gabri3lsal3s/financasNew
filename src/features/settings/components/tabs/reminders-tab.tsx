import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Checkbox,
  Select,
  NumberStepperInput,
  type SelectOption,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { useUserPreferences, useUpdateReminderPreferences, useUserAccess } from "@/state";
import { cn } from "@/lib/utils";

const REMINDER_DAYS_OPTIONS: SelectOption[] = [
  { value: "0", label: "No vencimento" },
  { value: "1", label: "1 dia antes" },
  { value: "2", label: "2 dias antes" },
  { value: "3", label: "3 dias antes (padrão)" },
  { value: "5", label: "5 dias antes" },
  { value: "7", label: "7 dias antes" },
  { value: "10", label: "10 dias antes" },
  { value: "15", label: "15 dias antes" },
  { value: "30", label: "30 dias antes" },
];

export function RemindersTab() {
  const { hasFeature } = useUserAccess();
  const preferencesQuery = useUserPreferences();
  const updatePreferencesMutation = useUpdateReminderPreferences();

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;

  const handleToggleReminders = (enabled: boolean) => {
    triggerSensory("toggle");
    updatePreferencesMutation.mutate({ remindersEnabled: enabled });
  };

  const handleUpdateBillDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updatePreferencesMutation.mutate({ reminderDaysBeforeBill: num });
    }
  };

  const handleUpdateDebtDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updatePreferencesMutation.mutate({ reminderDaysBeforeDebt: num });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="min-w-0">Lembretes & Notificações Automáticas</span>
            <Badge variant={remindersEnabled ? "positive" : "muted"} className="shrink-0">
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
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground">
                Habilitar Lembretes no Aplicativo
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Calcula e exibe alertas de faturas de cartão e dívidas no sininho do header e na central de lembretes.
              </div>
            </div>
            <Checkbox
              checked={remindersEnabled}
              onCheckedChange={handleToggleReminders}
              aria-label="Habilitar Lembretes no Aplicativo"
            />
          </div>

          {remindersEnabled && (
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              {/* Card: Antecedência para Faturas */}
              {hasFeature("cards") && (
                <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                  <div>
                    <div className="font-semibold text-sm text-foreground">
                      Antecedência para Faturas de Cartão
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Momento em que a fatura em aberto entra no radar de atenção antes do vencimento.
                    </p>
                  </div>

                  <div className="space-y-3">
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-muted-foreground shrink-0">Ajuste fino (dias):</span>
                      <div className="w-full sm:w-40">
                        <NumberStepperInput
                          value={billDaysBefore}
                          onValueChange={handleUpdateBillDays}
                          min={0}
                          max={30}
                          step={1}
                          ariaLabel="Dias de antecedência para faturas"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Card: Antecedência para Dívidas */}
              {hasFeature("debts") && (
                <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                  <div>
                    <div className="font-semibold text-sm text-foreground">
                      Antecedência para Dívidas
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prazo de antecedência para alertar sobre parcelas e empréstimos pendentes.
                    </p>
                  </div>

                  <div className="space-y-3">
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-muted-foreground shrink-0">Ajuste fino (dias):</span>
                      <div className="w-full sm:w-40">
                        <NumberStepperInput
                          value={debtDaysBefore}
                          onValueChange={handleUpdateDebtDays}
                          min={0}
                          max={30}
                          step={1}
                          ariaLabel="Dias de antecedência para dívidas"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
