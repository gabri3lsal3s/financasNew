import type { ReactNode } from "react";
import {
  AlertTriangle,
  CreditCard,
  FileWarning,
  HandCoins,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  resolveCarouselCardPolicy,
  type BridgeAlertEvaluation,
  type CarouselDismissPreset,
  type NotificationIconName,
} from "@/domain/notifications/hub";
import {
  AlertCarouselCard,
  type AlertCarouselCardAction,
  type AlertCarouselCardTone,
} from "./alert-carousel-card";

export interface BridgeAlertCardProps {
  evaluation: BridgeAlertEvaluation;
  onNavigate: (to: string) => void;
  secondaryAction?: AlertCarouselCardAction;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  className?: string;
}

function resolveBridgeIcon(iconName: NotificationIconName): ReactNode {
  switch (iconName) {
    case "alert-triangle":
      return <AlertTriangle className="size-4.5" />;
    case "credit-card":
      return <CreditCard className="size-4.5" />;
    case "file-warning":
      return <FileWarning className="size-4.5" />;
    case "hand-coins":
      return <HandCoins className="size-4.5" />;
    case "megaphone":
      return <Megaphone className="size-4.5" />;
    case "message-square":
      return <MessageSquare className="size-4.5" />;
    case "shield-alert":
      return <ShieldAlert className="size-4.5" />;
    case "sparkles":
      return <Sparkles className="size-4.5" />;
    case "users":
      return <Users className="size-4.5" />;
    case "wallet":
      return <Wallet className="size-4.5" />;
    case "trending-up":
    default:
      return <TrendingUp className="size-4.5" />;
  }
}

function resolveCardTone(tone: BridgeAlertEvaluation["tone"]): AlertCarouselCardTone {
  return tone === "muted" ? "info" : tone;
}

/**
 * Renderizador presentacional único para pontes e sinais direcionais da Onda 2
 * compartilhado entre Home e Investimentos (AGENTS.md §4 DRY).
 */
export function BridgeAlertCard({
  evaluation,
  onNavigate,
  secondaryAction,
  onSelectPreset,
  className,
}: BridgeAlertCardProps) {
  const policy = resolveCarouselCardPolicy(evaluation.canonicalId);

  return (
    <AlertCarouselCard
      id={evaluation.canonicalId}
      tone={resolveCardTone(evaluation.tone)}
      icon={resolveBridgeIcon(evaluation.iconName)}
      title={evaluation.title}
      description={evaluation.description}
      descriptionText={evaluation.description}
      badge={{
        label: evaluation.badgeLabel,
        variant: evaluation.hubNotification.badgeVariant,
      }}
      primaryAction={{
        label: evaluation.ctaLabel,
        onClick: () => onNavigate(evaluation.targetRoute),
      }}
      secondaryAction={secondaryAction}
      calculationBreakdown={evaluation.breakdown}
      dismissPolicy={
        onSelectPreset && policy.allowedPresets.length > 0
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => onSelectPreset(evaluation.canonicalId, preset),
              label: policy.displayName,
            }
          : undefined
      }
      className={className}
    />
  );
}
