import { Badge, Button, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface UnifiedDeviceAlertsPrefsCardProps {
  effectiveDeviceAlertsActive: boolean;
  pendingPermission?: boolean;
  postNotificationsGranted: boolean;
  permissionDenied?: boolean;
  iosNeedsInstall?: boolean;
  remindersEnabled?: boolean;
  isNative?: boolean;
  isBusy?: boolean;
  showTopDivider?: boolean;
  onToggleDeviceAlerts: (enabled: boolean) => void;
  onRequestPermission: () => void;
}

/**
 * Controle mestre unificado de notificações no dispositivo (vencimentos locais + push remoto em segundo plano).
 * Aplica Verdade de Estado: só exibe status ativo quando preferência e permissão do SO estão concedidas.
 */
export function UnifiedDeviceAlertsPrefsCard({
  effectiveDeviceAlertsActive,
  pendingPermission = false,
  postNotificationsGranted,
  permissionDenied = false,
  iosNeedsInstall = false,
  remindersEnabled = true,
  isNative = false,
  isBusy = false,
  showTopDivider = true,
  onToggleDeviceAlerts,
  onRequestPermission,
}: UnifiedDeviceAlertsPrefsCardProps) {
  const isWaitingPermission =
    !iosNeedsInstall &&
    !permissionDenied &&
    !effectiveDeviceAlertsActive &&
    pendingPermission &&
    !postNotificationsGranted;

  const badgeVariant = iosNeedsInstall
    ? "warning"
    : permissionDenied
      ? "warning"
      : effectiveDeviceAlertsActive
        ? "default"
        : isWaitingPermission
          ? "warning"
          : "muted";

  const badgeLabel = iosNeedsInstall
    ? "Instalar na Tela Inicial"
    : permissionDenied
      ? isNative
        ? "Bloqueado no Android"
        : "Bloqueado no navegador"
      : effectiveDeviceAlertsActive
        ? "Ativado neste aparelho"
        : isWaitingPermission
          ? "Permissão Pendente"
          : "Desativado";

  const description = iosNeedsInstall
    ? "No iPhone/iPad, toque em Compartilhar > Adicionar à Tela de Início e abra o Axir pelo ícone para liberar avisos neste aparelho."
    : permissionDenied
      ? isNative
        ? "As notificações do Axir estão bloqueadas no Android. Libere a permissão nas configurações do aparelho para ativar."
        : "As notificações deste site estão bloqueadas no navegador. Libere a permissão no ícone de cadeado ao lado do endereço para ativar."
      : isNative
        ? "Receba avisos de contas a vencer, faturas próximas, Pix em rachas e respostas do suporte neste celular mesmo com o app fechado."
        : "Receba avisos de contas a vencer, faturas próximas, Pix em rachas e respostas do suporte neste navegador, mesmo em segundo plano.";

  return (
    <div className={cn("space-y-3", showTopDivider && "pt-2 border-t border-border/80")}>
      <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Alertas neste Aparelho (Contas, Pix e Avisos)
              </span>
              <Badge variant={badgeVariant} size="xs">
                {badgeLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          <Switch
            checked={effectiveDeviceAlertsActive}
            disabled={iosNeedsInstall || permissionDenied || isBusy}
            onCheckedChange={onToggleDeviceAlerts}
            aria-label="Habilitar Alertas neste Aparelho"
          />
        </div>

        {effectiveDeviceAlertsActive && !remindersEnabled && (
          <div className="p-2.5 rounded-lg border border-border/80 bg-surface-raised/60 text-[11px] text-muted-foreground leading-relaxed">
            Os lembretes no aplicativo estão pausados. Reative{" "}
            <strong className="font-medium text-foreground">Lembretes no Aplicativo</strong> acima para voltar a disparar alertas de vencimento neste dispositivo.
          </div>
        )}

        {isWaitingPermission && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/5 gap-2.5">
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block">
                Permissão de notificações pendente
              </span>
              Você habilitou em outro aparelho ou ainda não autorizou este dispositivo. Libere a permissão no sistema para receber avisos aqui.
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
                onClick={() => onToggleDeviceAlerts(false)}
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
