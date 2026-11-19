import { CalendarClock, Check, Clock, Loader2, Sparkles } from "lucide-react";
import type { DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { formatTickerListSummary, type GovernanceInsight } from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";
import { buildGovernanceRiskItems } from "./build-governance-risk-items";
import { InsightSlide } from "./insight-slide";

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
  isAlertDismissed: (alertId: string, fingerprint: string) => boolean;
  dismissAlert: (alertId: string, days: 7 | 30, fingerprint: string) => void;
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

  const singleOverdueAsset = overdueAssets.length === 1 ? overdueAssets[0] : null;
  const canQuickConfirmOverdue = Boolean(singleOverdueAsset && singleOverdueAsset.score != null);

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
      !isAlertDismissed("overdue-reviews-alert", overdueFp) && {
        id: "overdue-reviews-alert",
        priority: 3,
        content: (
          <InsightSlide
            tone="warning"
            icon={<Clock className="size-4.5" />}
            title="Revisão de Teses Pendente"
            badgeText={`${overdueReviewsCount} ${overdueReviewsCount === 1 ? "ativo" : "ativos"}`}
            badgeVariant="warning"
            description={
              overdueTickersText
                ? overdueAssets.length === 1
                  ? `Prazo expirado em ${overdueTickersText}. Reavalie a nota e critérios.`
                  : `Prazo expirado em ${overdueTickersText}. Reavalie notas e critérios.`
                : consolidatedReviewAlert?.description ??
                  "Existem teses com prazo de revisão expirado. Reavalie suas notas."
            }
            onDismiss={(days) => dismissAlert("overdue-reviews-alert", days, overdueFp)}
            className={className}
            actions={
              <>
                {canQuickConfirmOverdue && singleOverdueAsset ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUpdatingAsset}
                    onClick={() => onQuickConfirmScore(singleOverdueAsset)}
                    className="gap-1"
                  >
                    {isUpdatingAsset ? (
                      <Loader2 className="size-3.5 animate-spin mr-1" aria-hidden="true" />
                    ) : (
                      <Check className="size-3.5" aria-hidden="true" />
                    )}
                    Manter nota ({singleOverdueAsset.score})
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenEvaluationQueue(overdueAssets)}
                >
                  {overdueAssets.length > 0 ? "Reavaliar Agora" : "Revisar Metas"}
                </Button>
              </>
            }
          />
        ),
      },

    upcomingReviewsCount > 0 &&
      !isAlertDismissed("upcoming-reviews-alert", upcomingFp) && {
        id: "upcoming-reviews-alert",
        priority: 4,
        content: (
          <InsightSlide
            tone="primary"
            icon={<CalendarClock className="size-4.5" />}
            title="Reavaliação Próxima do Prazo"
            badgeText={`${upcomingReviewsCount} ${upcomingReviewsCount === 1 ? "ativo" : "ativos"}`}
            badgeVariant="muted"
            description={
              upcomingTickersText
                ? (consolidatedUpcomingAlert?.daysUntilReview ?? 30) === 0
                  ? `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence hoje" : "vencem hoje"}.`
                  : (consolidatedUpcomingAlert?.daysUntilReview ?? 30) === 1
                    ? `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence amanhã" : "vencem em 1 dia"}.`
                    : `${upcomingTickersText} ${upcomingReviewsCount === 1 ? "vence" : "vencem"} em até ${consolidatedUpcomingAlert?.daysUntilReview ?? 30} dias.`
                : "Alguns ativos estão próximos da data de reavaliação periódica."
            }
            onDismiss={(days) => dismissAlert("upcoming-reviews-alert", days, upcomingFp)}
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenEvaluationQueue(upcomingReviewAssets)}
              >
                Antecipar Revisão
              </Button>
            }
          />
        ),
      },

    unscoredAssetsCount > 0 &&
      !isAlertDismissed("unscored-assets-alert", unscoredFp) && {
        id: "unscored-assets-alert",
        priority: 6,
        content: (
          <InsightSlide
            tone="portfolio"
            icon={<Sparkles className="size-4.5" />}
            title="Ativos sem Nota Definida"
            badgeText={`${unscoredAssetsCount} ${unscoredAssetsCount === 1 ? "ativo" : "ativos"}`}
            description={
              unscoredTickersText
                ? unscoredAssetsCount === 1
                  ? `Defina a nota de ${unscoredTickersText} para incluí-lo no rebalanceamento.`
                  : `Defina as notas de ${unscoredTickersText} para incluí-los no rebalanceamento.`
                : "Avalie os ativos recém-cadastrados para calibrar os aportes."
            }
            onDismiss={(days) => dismissAlert("unscored-assets-alert", days, unscoredFp)}
            className={className}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenEvaluationQueue(unscoredAssets)}
              >
                Avaliar Agora
              </Button>
            }
          />
        ),
      },

    ...buildGovernanceRiskItems({
      lowScoreRiskCount,
      quarantinedCount,
      discountOpportunitiesCount,
      isAlertDismissed,
      dismissAlert,
      onNavigate,
      className,
    }),
  ];
}
