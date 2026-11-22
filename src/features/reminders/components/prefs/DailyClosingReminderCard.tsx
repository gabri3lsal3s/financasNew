import { Badge, Button, Select, Switch } from "@/components/ui";
import { DAILY_REMINDER_TIME_OPTIONS } from "../constants";

export interface DailyClosingReminderCardProps {
  dailyReminderActive: boolean;
  dailyReminderTime: string;
  postNotificationsGranted: boolean;
  isNative?: boolean;
  onToggleDailyReminder: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onRequestPermission: () => void;
}

export function DailyClosingReminderCard({
  dailyReminderActive,
  dailyReminderTime,
  postNotificationsGranted,
  isNative = true,
  onToggleDailyReminder,
  onTimeChange,
  onRequestPermission,
}: DailyClosingReminderCardProps) {
  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Lembrete de Fechamento Diário
              </span>
              <Badge
                variant={
                  !isNative || !dailyReminderActive
                    ? "muted"
                    : postNotificationsGranted
                      ? "default"
                      : "warning"
                }
                size="xs"
              >
                {!isNative
                  ? dailyReminderActive
                    ? "Sincronizado para App Android"
                    : "Disponível no App Android"
                  : !dailyReminderActive
                    ? "Desativado"
                    : postNotificationsGranted
                      ? "Ativado"
                      : "Permissão Pendente"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isNative
                ? "Receba um lembrete no horário configurado com botões rápidos para registrar gastos do dia."
                : "O alarme local recorrente dispara no aplicativo Android (navegadores Web não executam alarmes offline). Sua escolha aqui fica salva na nuvem."}
            </p>
          </div>
          <Switch
            checked={dailyReminderActive}
            onCheckedChange={onToggleDailyReminder}
            aria-label="Habilitar Lembrete de Fechamento Diário"
          />
        </div>

        {isNative && dailyReminderActive && !postNotificationsGranted && (
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
                onClick={onRequestPermission}
                className="border-warning/40 hover:bg-warning/10 text-foreground"
              >
                Autorizar no Sistema
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                sensoryIntent="toggle"
                onClick={() => onToggleDailyReminder(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Desativar
              </Button>
            </div>
          </div>
        )}
      </div>

      {dailyReminderActive && (
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2">
          <span className="text-xs font-semibold text-foreground">Horário do Lembrete</span>
          <Select
            value={dailyReminderTime}
            onValueChange={onTimeChange}
            options={DAILY_REMINDER_TIME_OPTIONS}
            ariaLabel="Selecione o horário para o lembrete diário"
          />
          <p className="text-[11px] text-muted-foreground">
            {isNative
              ? "O aplicativo emitirá a notificação programada todos os dias no horário selecionado."
              : "O aplicativo Android emitirá a notificação programada todos os dias no horário selecionado."}
          </p>
        </div>
      )}
    </div>
  );
}
