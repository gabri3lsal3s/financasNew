import { Badge, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { NotificationCategoryPreferences } from "@/types";
import { REMINDER_DAYS_OPTIONS } from "../constants";

export interface InAppRemindersPrefsCardProps {
  remindersEnabled: boolean;
  billDaysBefore: number;
  debtDaysBefore: number;
  categoryPreferences: Required<NotificationCategoryPreferences>;
  showCards: boolean;
  showDebts: boolean;
  showBudgets?: boolean;
  showFamilyOrTrips?: boolean;
  onToggleReminders: (enabled: boolean) => void;
  onUpdateBillDays: (val: string) => void;
  onUpdateDebtDays: (val: string) => void;
  onToggleCategory: (
    key: keyof NotificationCategoryPreferences,
    enabled: boolean,
  ) => void;
}

export function InAppRemindersPrefsCard({
  remindersEnabled,
  billDaysBefore,
  debtDaysBefore,
  categoryPreferences,
  showCards,
  showDebts,
  showBudgets = true,
  showFamilyOrTrips = true,
  onToggleReminders,
  onUpdateBillDays,
  onUpdateDebtDays,
  onToggleCategory,
}: InAppRemindersPrefsCardProps) {
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors",
          remindersEnabled
            ? "border-primary/40 bg-primary/5"
            : "border-border/80 bg-surface",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              Lembretes no Aplicativo
            </span>
            <Badge variant={remindersEnabled ? "default" : "muted"} size="xs">
              {remindersEnabled ? "Ativado" : "Desativado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exibe avisos sobre faturas, dívidas e pendências no sino do cabeçalho e na central de lembretes.
          </p>
        </div>
        <Switch
          checked={remindersEnabled}
          onCheckedChange={onToggleReminders}
          aria-label="Habilitar Lembretes no Aplicativo"
        />
      </div>

      {remindersEnabled && (
        <div className="space-y-3.5 pt-1">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {showCards && (
              <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5">
                <div>
                  <div className="font-semibold text-xs text-foreground">
                    Antecedência para Faturas de Cartão
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Momento do alerta antes do vencimento da fatura.
                  </p>
                </div>
                <Select
                  value={
                    REMINDER_DAYS_OPTIONS.some(
                      (o) => o.value === String(billDaysBefore),
                    )
                      ? String(billDaysBefore)
                      : "custom"
                  }
                  onValueChange={(val) => {
                    if (val !== "custom") onUpdateBillDays(val);
                  }}
                  options={
                    REMINDER_DAYS_OPTIONS.some(
                      (o) => o.value === String(billDaysBefore),
                    )
                      ? REMINDER_DAYS_OPTIONS
                      : [
                          ...REMINDER_DAYS_OPTIONS,
                          {
                            value: "custom",
                            label: `${billDaysBefore} dias (Personalizado)`,
                          },
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
                    REMINDER_DAYS_OPTIONS.some(
                      (o) => o.value === String(debtDaysBefore),
                    )
                      ? String(debtDaysBefore)
                      : "custom"
                  }
                  onValueChange={(val) => {
                    if (val !== "custom") onUpdateDebtDays(val);
                  }}
                  options={
                    REMINDER_DAYS_OPTIONS.some(
                      (o) => o.value === String(debtDaysBefore),
                    )
                      ? REMINDER_DAYS_OPTIONS
                      : [
                          ...REMINDER_DAYS_OPTIONS,
                          {
                            value: "custom",
                            label: `${debtDaysBefore} dias (Personalizado)`,
                          },
                        ]
                  }
                  ariaLabel="Seletor de dias de antecedência para dívidas"
                />
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
            <div>
              <div className="font-semibold text-xs text-foreground">
                Categorias exibidas na Central
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha quais tipos de aviso aparecem no sininho e em Lembretes.
              </p>
            </div>

            <div className="divide-y divide-border/70">
              {showCards && (
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        Fechamento de fatura de cartão
                      </span>
                      <Badge variant="muted" size="xs">
                        Opcional
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Aviso discreto quando a fatura fecha com saldo em aberto antes do vencimento.
                    </p>
                  </div>
                  <Switch
                    checked={categoryPreferences.billClosing}
                    onCheckedChange={(checked) =>
                      onToggleCategory("billClosing", checked)
                    }
                    aria-label="Habilitar alertas de fechamento de fatura"
                  />
                </div>
              )}

              {showDebts && (
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Rachas e contas a receber
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sinalizações de Pix em rachas e recebimentos previstos em modo informativo.
                    </p>
                  </div>
                  <Switch
                    checked={categoryPreferences.receivablesAndSplits}
                    onCheckedChange={(checked) =>
                      onToggleCategory("receivablesAndSplits", checked)
                    }
                    aria-label="Habilitar alertas de rachas e contas a receber"
                  />
                </div>
              )}

              {showBudgets && (
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Orçamentos excedidos e ritmo de gastos
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Resumo mensal consolidado quando limites por categoria ultrapassam 100%.
                    </p>
                  </div>
                  <Switch
                    checked={categoryPreferences.budgetsAndPace}
                    onCheckedChange={(checked) =>
                      onToggleCategory("budgetsAndPace", checked)
                    }
                    aria-label="Habilitar alertas de orçamentos e ritmo de gastos"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground block">
                    Sugestões do Assistente
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Despesas recorrentes, rendas previstas e dicas de alocação.
                  </p>
                </div>
                <Switch
                  checked={categoryPreferences.advisorInsights}
                  onCheckedChange={(checked) =>
                    onToggleCategory("advisorInsights", checked)
                  }
                  aria-label="Habilitar sugestões do Assistente na Central"
                />
              </div>

              {showFamilyOrTrips && (
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block">
                      Família e Viagens
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Convites familiares pendentes e acertos de viagens encerradas.
                    </p>
                  </div>
                  <Switch
                    checked={categoryPreferences.familyAndTrips}
                    onCheckedChange={(checked) =>
                      onToggleCategory("familyAndTrips", checked)
                    }
                    aria-label="Habilitar alertas de família e viagens"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
