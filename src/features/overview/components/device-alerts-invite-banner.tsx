import { BellRing, ChevronRight } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export interface DeviceAlertsInviteBannerProps {
  onConfigure: () => void;
  onDismiss?: () => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

/**
 * Convite discreto (Just-in-Time) no carrossel da Home após o primeiro cadastro de cartão, dívida ou racha.
 * Segue AGENTS.md §4 Regra 13 (Nível 2), Regra 19 e Regra 35.
 */
export function DeviceAlertsInviteBanner({
  onConfigure,
  onDismiss,
  onSelectPreset,
}: DeviceAlertsInviteBannerProps) {
  const policy = resolveCarouselCardPolicy("device.alerts_invite");

  return (
    <AlertCarouselCard
      id="device.alerts_invite"
      tone="info"
      role="region"
      ariaLabel="Convite para configurar alertas no dispositivo"
      icon={<BellRing className="size-4.5" />}
      title="Receba alertas de vencimentos e Pix"
      badge={{ label: "Opcional", variant: "muted" }}
      description="Ative avisos neste aparelho para acompanhar suas faturas, contas a pagar e pagamentos sinalizados."
      primaryAction={{
        label: "Configurar alertas",
        onClick: onConfigure,
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
              label: "Dispensar convite de alertas",
            }
          : undefined
      }
    />
  );
}
