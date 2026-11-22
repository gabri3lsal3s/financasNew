import { Badge, Button, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface DueNotificationsPrefsCardProps {
  dueNotificationsActive: boolean;
  postNotificationsGranted: boolean;
  remindersEnabled?: boolean;
  isNative?: boolean;
  showTopDivider?: boolean;
  onToggleDueNotifications: (enabled: boolean) => void;
  onRequestPermission: () => void;
}

export function DueNotificationsPrefsCard({
  dueNotificationsActive,
  postNotificationsGranted,
  remindersEnabled = true,
  isNative = true,
  showTopDivider = true,
  onToggleDueNotifications,
  onRequestPermission,
}: DueNotificationsPrefsCardProps) {
  return (
    <div className={cn("space-y-3", showTopDivider && "pt-2 border-t border-border/80")}>
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
                      ? "default"
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
              {isNative
                ? "Agende alertas locais no Android com até 7 dias de antecedência, respeitando seu Horário Silencioso."
                : "Receba avisos locais no navegador enquanto o aplicativo estiver aberto para contas a pagar e faturas próximas."}
            </p>
          </div>
          <Switch
            checked={dueNotificationsActive}
            onCheckedChange={onToggleDueNotifications}
            aria-label="Habilitar Notificações de Contas no Dispositivo"
          />
        </div>

        {dueNotificationsActive && !remindersEnabled && (
          <div className="p-2.5 rounded-lg border border-border/80 bg-surface-raised/60 text-[11px] text-muted-foreground leading-relaxed">
            Os lembretes no aplicativo estão pausados. Reative{" "}
            <strong className="font-medium text-foreground">Lembretes no Aplicativo</strong> acima para voltar a disparar alertas de vencimento neste dispositivo.
          </div>
        )}

        {dueNotificationsActive && !postNotificationsGranted && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/5 gap-2.5">
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block">
                Permissão de notificações pendente
              </span>
              O recurso está marcado como ativo, mas o sistema ainda precisa da sua autorização para exibir avisos.
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
