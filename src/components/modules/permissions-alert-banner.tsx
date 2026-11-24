import { BellOff, ChevronRight, ShieldAlert, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type PermissionAlertBannerType = "bank_listener" | "push_due" | "both";

export interface PermissionsAlertBannerProps {
  type: PermissionAlertBannerType;
  onAction: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Banner contextual para o carrossel de alertas da Home (DashboardAlertsCarousel).
 *
 * Notifica proativamente o usuário quando funcionalidades ativas (Assistente Bancário
 * ou Notificações de Contas) estão interrompidas por falta de permissão no Android.
 * Segue estritamente as Diretrizes Canônicas de UI (AGENTS.md §4 Regras 8, 13 e 19).
 */
export function PermissionsAlertBanner({
  type,
  onAction,
  onDismiss,
  className,
}: PermissionsAlertBannerProps) {
  const isBank = type === "bank_listener";
  const isBoth = type === "both";

  const title = isBoth
    ? "Permissões de Notificação e Banco Pendentes"
    : isBank
      ? "Acesso a Notificações Bancárias Bloqueado"
      : "Alertas no Dispositivo Desativados";

  const description = isBoth
    ? "O assistente de compras e os avisos de contas precisam de autorização no Android para rodar."
    : isBank
      ? "O leitor passivo precisa de autorização no sistema para capturar compras de cartão e Pix."
      : "Habilite as notificações no Android para ser avisado sobre faturas e dívidas a vencer.";

  const badgeText = isBoth
    ? "2 Pendências"
    : isBank
      ? "Assistente Bancário"
      : "Avisos de Contas";

  return (
    <div
      role="region"
      aria-label="Alerta de Permissões Pendentes no Dispositivo"
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/10 via-surface to-surface p-3.5 sm:p-4 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 pr-6 sm:pr-0 flex-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 border border-warning/20 text-warning-strong">
          {isBank ? (
            <ShieldAlert className="size-4.5" aria-hidden="true" />
          ) : (
            <BellOff className="size-4.5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {title}
            </h2>
            <Badge variant="warning" size="xs">
              {badgeText}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onAction}
          className="w-full sm:w-auto h-8 gap-1 text-xs font-medium cursor-pointer border-warning/40 hover:bg-warning/10 text-foreground"
        >
          <span>Habilitar</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        <div className="absolute top-3 right-3 sm:static">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="relative size-7 sm:size-8 shrink-0 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
            aria-label="Não ativar agora (dispensar aviso)"
            title="Não ativar agora"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
