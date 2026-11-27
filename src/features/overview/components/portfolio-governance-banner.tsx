import { ChevronRight, ShieldAlert } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export interface PortfolioGovernanceBannerProps {
  overdueReviewsCount: number;
  onReview: () => void;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

/**
 * Banner de alerta do carrossel para teses de carteira com revisão vencida.
 */
export function PortfolioGovernanceBanner({
  overdueReviewsCount,
  onReview,
  onDismiss,
  onSelectPreset,
}: PortfolioGovernanceBannerProps) {
  const policy = resolveCarouselCardPolicy("portfolio.governance_review");

  return (
    <AlertCarouselCard
      id="portfolio.governance_review"
      tone="warning"
      role="region"
      ariaLabel="Aviso de revisão de teses da carteira"
      icon={<ShieldAlert className="size-4.5" />}
      title="Revisão de Teses de Carteira"
      badge={{
        label: `${overdueReviewsCount} ${overdueReviewsCount === 1 ? "ativo pendente" : "ativos pendentes"}`,
        variant: "warning",
      }}
      description={
        overdueReviewsCount === 1
          ? "1 ativo da sua carteira passou do prazo de revisão da sua carteira."
          : `${overdueReviewsCount} ativos da sua carteira passaram do prazo de revisão da sua carteira.`
      }
      primaryAction={{
        label: "Revisar Teses",
        onClick: onReview,
        variant: "outline",
        icon: <ChevronRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar aviso de revisão de teses",
            }
          : undefined
      }
    />
  );
}
