import { Badge, Button, Switch } from "@/components/ui";

export interface DueNotificationsPrefsCardProps {
  dueNotificationsActive: boolean;
  postNotificationsGranted: boolean;
  onToggleDueNotifications: (enabled: boolean) => void;
  onRequestPermission: () => void;
}

export function DueNotificationsPrefsCard({
  dueNotificationsActive,
  postNotificationsGranted,
  onToggleDueNotifications,
  onRequestPermission,
}: DueNotificationsPrefsCardProps) {
  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              Receba alertas do sistema operacional (Android ou navegador) no dia do vencimento de faturas e dívidas.
            </p>
          </div>
          <Switch
            checked={dueNotificationsActive}
            onCheckedChange={onToggleDueNotifications}
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
                onClick={() => onToggleDueNotifications(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Desativar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
