import { Badge, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { REMINDER_DAYS_OPTIONS } from "../constants";

export interface InAppRemindersPrefsCardProps {
  remindersEnabled: boolean;
  billDaysBefore: number;
  debtDaysBefore: number;
  showCards: boolean;
  showDebts: boolean;
  onToggleReminders: (enabled: boolean) => void;
  onUpdateBillDays: (val: string) => void;
  onUpdateDebtDays: (val: string) => void;
}

export function InAppRemindersPrefsCard({
  remindersEnabled,
  billDaysBefore,
  debtDaysBefore,
  showCards,
  showDebts,
  onToggleReminders,
  onUpdateBillDays,
  onUpdateDebtDays,
}: InAppRemindersPrefsCardProps) {
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors",
          remindersEnabled ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              Lembretes no Aplicativo
            </span>
            <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
              {remindersEnabled ? "Ativado" : "Desativado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exibe avisos sobre faturas e dívidas no sino do cabeçalho e na central de lembretes.
          </p>
        </div>
        <Switch
          checked={remindersEnabled}
          onCheckedChange={onToggleReminders}
          aria-label="Habilitar Lembretes no Aplicativo"
        />
      </div>

      {remindersEnabled && (
        <div className="grid gap-3.5 pt-1 sm:grid-cols-2">
          {showCards && (
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
                  if (val !== "custom") onUpdateBillDays(val);
                }}
                options={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                    ? REMINDER_DAYS_OPTIONS
                    : [
                        ...REMINDER_DAYS_OPTIONS,
                        { value: "custom", label: `${billDaysBefore} dias (Personalizado)` },
                      ]
                }
                ariaLabel="Seletor de dias de antecedência para faturas"
              />
            </div>
          )}

          {showDebts && (
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
                  if (val !== "custom") onUpdateDebtDays(val);
                }}
                options={
                  REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                    ? REMINDER_DAYS_OPTIONS
                    : [
                        ...REMINDER_DAYS_OPTIONS,
                        { value: "custom", label: `${debtDaysBefore} dias (Personalizado)` },
                      ]
                }
                ariaLabel="Seletor de dias de antecedência para dívidas"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
