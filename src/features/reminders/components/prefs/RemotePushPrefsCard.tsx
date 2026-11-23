import { Badge, Switch } from "@/components/ui";

export interface RemotePushPrefsCardProps {
  remotePushEnabled: boolean;
  isNative?: boolean;
  webPushSupported: boolean;
  webPushConfigured: boolean;
  permissionDenied?: boolean;
  iosNeedsInstall?: boolean;
  isBusy?: boolean;
  onToggleRemotePush: (enabled: boolean) => void;
}

export function RemotePushPrefsCard({
  remotePushEnabled,
  isNative = false,
  webPushSupported,
  webPushConfigured,
  permissionDenied = false,
  iosNeedsInstall = false,
  isBusy = false,
  onToggleRemotePush,
}: RemotePushPrefsCardProps) {
  const canToggle = isNative
    ? !permissionDenied || remotePushEnabled
    : webPushSupported &&
      webPushConfigured &&
      !iosNeedsInstall &&
      (!permissionDenied || remotePushEnabled);

  const badgeVariant = remotePushEnabled && canToggle ? "default" : "muted";
  const badgeLabel = isNative
    ? permissionDenied
      ? "Bloqueado no aparelho"
      : remotePushEnabled
        ? "Ativado neste aparelho"
        : "Desativado"
    : iosNeedsInstall
      ? "Instalar na Tela Inicial"
      : !webPushSupported
        ? "Indisponível"
        : permissionDenied
          ? "Bloqueado no navegador"
          : !webPushConfigured
            ? "Em configuração"
            : remotePushEnabled
              ? "Ativado neste aparelho"
              : "Desativado";

  const description = isNative
    ? permissionDenied
      ? "As notificações do Axir estão bloqueadas no Android. Libere a permissão nas configurações do aparelho para ativar."
      : "Receba avisos importantes neste celular (Pix em rachas, respostas do suporte, avisos de assinatura e comunicados) mesmo com o app fechado."
    : iosNeedsInstall
      ? "No iPhone/iPad, toque em Compartilhar > Adicionar à Tela de Início e abra o Axir pelo ícone para liberar alertas mesmo com o app fechado."
      : !webPushSupported
        ? "Este navegador não oferece suporte a notificações em segundo plano. Com o app aberto, seus avisos continuam aparecendo normalmente."
        : permissionDenied
          ? "As notificações deste site estão bloqueadas no navegador. Libere a permissão no ícone de cadeado ao lado do endereço para ativar."
          : !webPushConfigured
            ? "O envio em segundo plano ainda está sendo finalizado no servidor. Com o app aberto, os avisos funcionam normalmente."
            : "Receba avisos importantes neste navegador (Pix em rachas, respostas do suporte e comunicados) mesmo com a aba fechada.";

  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Notificações Push Remotas
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
            checked={canToggle ? remotePushEnabled : false}
            disabled={!canToggle || isBusy}
            onCheckedChange={onToggleRemotePush}
            aria-label="Habilitar Notificações Push Remotas"
          />
        </div>
      </div>
    </div>
  );
}
