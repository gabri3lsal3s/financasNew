import { CalendarClock, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { formatTickerListSummary, type GovernanceInsight } from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";
import { buildGovernanceRiskItems } from "./build-governance-risk-items";

export interface BuildGovernanceInsightItemsParams {
  overdueReviewsCount: number;
  upcomingReviewsCount: number;
  unscoredAssetsCount: number;
  quarantinedCount: number;
  discountOpportunitiesCount: number;
  lowScoreRiskCount: number;
  overdueAssets: PortfolioAsset[];
  upcomingReviewAssets: PortfolioAsset[];
  unscoredAssets: PortfolioAsset[];
  consolidatedReviewAlert: GovernanceInsight | null | undefined;
  consolidatedUpcomingAlert: GovernanceInsight | null | undefined;
  consolidatedUnscoredAlert: GovernanceInsight | null | undefined;
  isUpdatingAsset: boolean;
  isCardVisible?: (cardKey: string) => boolean;
  onSelectPreset?: (cardKey: string, preset: CarouselDismissPreset) => void;
  isAlertDismissed?: (alertId: string, fingerprint: string) => boolean;
  dismissAlert?: (alertId: string, days: 7 | 30, fingerprint: string) => void;
  onQuickConfirmScore: (asset: PortfolioAsset) => void;
  onOpenEvaluationQueue: (assets: PortfolioAsset[]) => void;
  onNavigate: (to: string) => void;
  className?: string;
}

export function buildGovernanceInsightItems({
  overdueReviewsCount,
  upcomingReviewsCount,
  unscoredAssetsCount,
  quarantinedCount,
  discountOpportunitiesCount,
  lowScoreRiskCount,
  overdueAssets,
  upcomingReviewAssets,
  unscoredAssets,
  consolidatedReviewAlert,
  consolidatedUpcomingAlert,
  consolidatedUnscoredAlert,
  isUpdatingAsset,
  isCardVisible,
  onSelectPreset,
  isAlertDismissed,
  dismissAlert,
  onQuickConfirmScore,
  onOpenEvaluationQueue,
  onNavigate,
  className,
}: BuildGovernanceInsightItemsParams): (DashboardAlertItem | false)[] {
  const overdueFp = (consolidatedReviewAlert?.tickers ?? []).join(",");
  const upcomingFp = `${(consolidatedUpcomingAlert?.tickers ?? []).join(",")}:${consolidatedUpcomingAlert?.daysUntilReview ?? ""}`;
  const unscoredFp = (consolidatedUnscoredAlert?.tickers ?? []).join(",");

  const isOverdueVisible =
    (isCardVisible ? isCardVisible("portfolio.governance_review") : true) &&
    !(isAlertDismissed?.("overdue-reviews-alert", overdueFp) ?? false);
  const isUpcomingVisible =
    (isCardVisible ? isCardVisible("portfolio.governance_upcoming") : true) &&
    !(isAlertDismissed?.("upcoming-reviews-alert", upcomingFp) ?? false);
  const isUnscoredVisible =
    (isCardVisible ? isCardVisible("portfolio.unscored_assets") : true) &&
    !(isAlertDismissed?.("unscored-assets-alert", unscoredFp) ?? false);

  const overduePolicy = resolveCarouselCardPolicy("portfolio.governance_review");
  const upcomingPolicy = resolveCarouselCardPolicy("portfolio.governance_upcoming");
  const unscoredPolicy = resolveCarouselCardPolicy("portfolio.unscored_assets");

  const singleOverdueAsset = overdueAssets.length === 1 ? overdueAssets[0] : null;
  const canQuickConfirmOverdue = Boolean(
    singleOverdueAsset && singleOverdueAsset.score != null,
  );

  const overdueTickersText = formatTickerListSummary(
    consolidatedReviewAlert?.tickers ?? overdueAssets.map((a) => a.ticker),
  );
  const upcomingTickersText = formatTickerListSummary(
    consolidatedUpcomingAlert?.tickers ?? upcomingReviewAssets.map((a) => a.ticker),
  );
  const unscoredTickersText = formatTickerListSummary(
    consolidatedUnscoredAlert?.tickers ?? unscoredAssets.map((a) => a.ticker),
  );

  return [
    overdueReviewsCount > 0 &&
      isOverdueVisible && {
        id: "portfolio.governance_review",
        priority: 3,
        content: (
          <AlertCarouselCard
            id="portfolio.governance_review"
            tone="warning"
            icon={<Clock className="size-4.5" />}
            title="Revisão de Teses Pendente"
            badge={{
              label: `${overdueReviewsCount} ${overdueReviewsCount === 1 ? "ativo" : "ativos"}`,
              variant: "warning",
            }}
            description={
              overdueTickersText
                ? overdueAssets.length === 1
                  ? `Prazo expirado em ${overdueTickersText}. Reavalie a nota e critérios.`
                  : `Prazo expirado em ${overdueTickersText}. Reavalie notas e critérios.`
                : consolidatedReviewAlert?.description ??
                  "Existem teses com prazo de revisão expirado. Reavalie suas notas."
            }
            className={className}
            secondaryAction={
              canQuickConfirmOverdue && singleOverdueAsset
                ? {
                    label: `Manter nota (${singleOverdueAsset.score})`,
                    onClick: () => onQuickConfirmScore(singleOverdueAsset),
                    variant: "ghost",
                    disabled: isUpdatingAsset,
                    loading: isUpdatingAsset,
                    icon: isUpdatingAsset ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="size-3.5" aria-hidden="true" />
                    ),
                  }
                : undefined
            }
            primaryAction={{
              label: overdueAssets.length > 0 ? "Reavaliar Agora" : "Revisar Metas",
              onClick: () => onOpenEvaluationQueue(overdueAssets),
              variant: "outline",
            }}
            dismissPolicy={{
              allowedPresets: overduePolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.governance_review", preset);
                } else {
                  dismissAlert?.(
                    "overdue-reviews-alert",
                    preset === "7d" ? 7 : 30,
                    overdueFp,
                  );
                }
              },
            }}
          />
        ),
      },

    upcomingReviewsCount > 0 &&
      isUpcomingVisible && {
        id: "portfolio.governance_upcoming",
        priority: 4,
        content: (
          <AlertCarouselCard
            id="portfolio.governance_upcoming"
            tone="info"
            icon={<CalendarClock className="size-4.5" />}
            title="Reavaliação Próxima do Prazo"
            badge={{
              label: `${upcomingReviewsCount} ${upcomingReviewsCount === 1 ? "ativo" : "ativos"}`,
              variant: "muted",
            }}
            description={
              upcomingTickersText
                ? (consolidatedUpcomingAlert?.daysUntilReview ?? 30) === 0
                  ? `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence hoje" : "vencem hoje"}.`
                  : (consolidatedUpcomingAlert?.daysUntilReview ?? 30) === 1
                    ? `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence amanhã" : "vencem em 1 dia"}.`
                    : `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence" : "vencem"} em até ${consolidatedUpcomingAlert?.daysUntilReview ?? 30} dias.`
                : "Alguns ativos estão próximos da data de reavaliação periódica."
            }
            className={className}
            primaryAction={{
              label: "Antecipar Revisão",
              onClick: () => onOpenEvaluationQueue(upcomingReviewAssets),
              variant: "outline",
            }}
            dismissPolicy={{
              allowedPresets: upcomingPolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.governance_upcoming", preset);
                } else {
                  dismissAlert?.(
                    "upcoming-reviews-alert",
                    preset === "7d" ? 7 : 30,
                    upcomingFp,
                  );
                }
              },
            }}
          />
        ),
      },

    unscoredAssetsCount > 0 &&
      isUnscoredVisible && {
        id: "portfolio.unscored_assets",
        priority: 6,
        content: (
          <AlertCarouselCard
            id="portfolio.unscored_assets"
            tone="portfolio"
            icon={<Sparkles className="size-4.5" />}
            title="Ativos sem Nota Definida"
            badge={{
              label: `${unscoredAssetsCount} ${unscoredAssetsCount === 1 ? "ativo" : "ativos"}`,
              variant: "portfolio",
            }}
            description={
              unscoredTickersText
                ? unscoredAssetsCount === 1
                  ? `Defina a nota de ${unscoredTickersText} para incluí-lo no rebalanceamento.`
                  : `Defina as notas de ${unscoredTickersText} para incluí-los no rebalanceamento.`
                : "Avalie os ativos recém-cadastrados para calibrar os aportes."
            }
            className={className}
            primaryAction={{
              label: "Avaliar Agora",
              onClick: () => onOpenEvaluationQueue(unscoredAssets),
              variant: "outline",
            }}
            dismissPolicy={{
              allowedPresets: unscoredPolicy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) {
                  onSelectPreset("portfolio.unscored_assets", preset);
                } else {
                  dismissAlert?.(
                    "unscored-assets-alert",
                    preset === "7d" ? 7 : 30,
                    unscoredFp,
                  );
                }
              },
            }}
          />
        ),
      },

    ...buildGovernanceRiskItems({
      lowScoreRiskCount,
      quarantinedCount,
      discountOpportunitiesCount,
      isCardVisible,
      onSelectPreset,
      isAlertDismissed,
      dismissAlert,
      onNavigate,
      className,
    }),
  ];
}
