import { useNavigate } from "react-router";
import {
  AlertCircle,
  BookOpen,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { getTrialLifecycleMetadata } from "@/domain/subscription";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import {
  AlertCarouselCard,
  type AlertCarouselCardTone,
} from "../alert-carousel-card";

export interface TrialEndingBannerProps {
  daysRemaining: number;
  hasAutoRenew?: boolean;
  className?: string;
  onActivatePro?: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

/**
 * Banner contextual para o carrossel de alertas da Home (DashboardAlertsCarousel).
 *
 * Apresenta o status adaptativo ao longo de todo o ciclo de vida do período de teste Pro (Trial).
 */
export function TrialEndingBanner({
  daysRemaining,
  hasAutoRenew,
  className,
  onActivatePro,
  onDismiss,
  onSelectPreset,
}: TrialEndingBannerProps) {
  const navigate = useNavigate();

  const handleActivate = () => {
    if (onActivatePro) {
      onActivatePro();
    } else if (hasAutoRenew) {
      navigate("/configuracoes?tab=subscription");
    } else {
      navigate(buildCheckoutUrl({ plan: "annual" }));
    }
  };

  const meta = getTrialLifecycleMetadata(daysRemaining);
  const policy = resolveCarouselCardPolicy("billing.trial_ending", {
    trialDaysRemaining: daysRemaining,
  });

  const titleText = hasAutoRenew
    ? "Plano Pro Configurado"
    : daysRemaining === 0
      ? "Seu período de teste Pro encerra hoje"
      : daysRemaining === 1
        ? "Seu período de teste Pro encerra amanhã"
        : meta.title;

  const badgeText = hasAutoRenew
    ? "Cobrança Automática"
    : daysRemaining === 0
      ? "Último dia"
      : daysRemaining === 1
        ? "1 dia restante"
        : meta.badgeLabel;

  const descriptionText = hasAutoRenew
    ? "Sua assinatura Pro está garantida com cobrança automática no cartão cadastrado."
    : meta.description;

  let tone: AlertCarouselCardTone = "info";
  let IconComponent = Sparkles;

  if (hasAutoRenew) {
    tone = "positive";
    IconComponent = ShieldCheck;
  } else if (meta.stage === "awareness") {
    tone = "portfolio";
    IconComponent = TrendingUp;
  } else if (meta.stage === "warning") {
    tone = "warning";
    IconComponent = Clock;
  } else if (meta.stage === "imminent") {
    tone = "critical";
    IconComponent = AlertCircle;
  } else if (meta.stage === "expired") {
    tone = "warning";
    IconComponent = BookOpen;
  }

  return (
    <AlertCarouselCard
      id="billing.trial_ending"
      tone={tone}
      role="region"
      ariaLabel="Aviso do Período de Teste Pro"
      className={className}
      icon={<IconComponent className="size-4.5" />}
      title={titleText}
      badge={{
        label: badgeText,
        variant: hasAutoRenew ? "positive" : meta.badgeVariant,
      }}
      description={
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <ShieldCheck
            className="size-3.5 shrink-0 text-positive-strong"
            aria-hidden="true"
          />
          <span>{descriptionText}</span>
        </span>
      }
      descriptionText={descriptionText}
      primaryAction={{
        label: hasAutoRenew
          ? "Gerenciar Assinatura"
          : daysRemaining <= 7
            ? "Ativar Plano Pro"
            : meta.ctaText,
        onClick: handleActivate,
        variant: "default",
        icon: hasAutoRenew ? (
          <ShieldCheck className="size-3.5" aria-hidden="true" />
        ) : (
          <Sparkles className="size-3.5" aria-hidden="true" />
        ),
      }}
      dismissPolicy={
        (onSelectPreset || onDismiss) && policy.allowedPresets.length > 0
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar aviso do período de teste",
            }
          : undefined
      }
    />
  );
}
