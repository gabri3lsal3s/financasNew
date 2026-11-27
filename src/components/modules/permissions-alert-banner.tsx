import { BellOff, ChevronRight, ShieldAlert } from "lucide-react";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { AlertCarouselCard } from "./alert-carousel-card";

export type PermissionAlertBannerType = "bank_listener" | "push_due" | "both";

export interface PermissionsAlertBannerProps {
  type: PermissionAlertBannerType;
  onAction: () => void;
  onDismiss?: () => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
  className?: string;
}

/**
 * Banner contextual para o carrossel de alertas da Home (DashboardAlertsCarousel).
 *
 * Notifica proativamente o usuário quando funcionalidades ativas (Assistente Bancário
 * ou Notificações de Contas) estão interrompidas por falta de permissão no Android.
 * Segue estritamente as Diretrizes Canônicas de UI (AGENTS.md §4 Regras 8, 13, 19 e 35).
 */
export function PermissionsAlertBanner({
  type,
  onAction,
  onDismiss,
  onSelectPreset,
  className,
}: PermissionsAlertBannerProps) {
  const isBank = type === "bank_listener";
  const isBoth = type === "both";
  const cardKey = isBank
    ? "device.permissions.bank_listener"
    : "device.permissions.push_due";
  const policy = resolveCarouselCardPolicy(cardKey);

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
    <AlertCarouselCard
      id={cardKey}
      tone="warning"
      role="region"
      ariaLabel="Alerta de Permissões Pendentes no Dispositivo"
      className={className}
      icon={
        isBank ? (
          <ShieldAlert className="size-4.5" />
        ) : (
          <BellOff className="size-4.5" />
        )
      }
      title={title}
      badge={{ label: badgeText, variant: "warning" }}
      description={description}
      primaryAction={{
        label: "Habilitar",
        onClick: onAction,
        variant: "outline",
        icon: <ChevronRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.();
              },
              label: "Não ativar agora (dispensar aviso)",
            }
          : undefined
      }
    />
  );
}
