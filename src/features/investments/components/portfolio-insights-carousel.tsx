import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { todaySaoPauloISO } from "@/domain/portfolio";
import { computePortfolioCarouselDrift } from "@/domain/portfolio/insights-carousel-drift";
import { evaluatePortfolioStructuralRisk } from "@/domain/portfolio/portfolio-risk-policy";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { usePortfolioAlertDismissals } from "@/hooks/use-portfolio-alert-dismissals";
import { openDividendReviewModal } from "@/services/dividend-review-modal";
import { pushToast } from "@/services/toast";
import {
  useApproveDividendsBatch,
  useAssetGovernanceInsights,
  useCorporateDividends,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useUpdatePortfolioAsset,
} from "@/state";
import type { PortfolioAsset } from "@/types";
import { AssetScoreEvaluationDialog } from "./asset-score-evaluation-dialog";
import { buildAllocationInsightItems } from "./insights-carousel/build-allocation-insight-items";
import { buildDividendInsightItems } from "./insights-carousel/build-dividend-insight-items";
import { buildGovernanceInsightItems } from "./insights-carousel/build-governance-insight-items";
import { buildStructuralRiskItems } from "./insights-carousel/build-structural-risk-items";

export interface PortfolioInsightsCarouselProps {
  className?: string;
}

export function PortfolioInsightsCarousel({ className }: PortfolioInsightsCarouselProps) {
  const navigate = useNavigate();
  const {
    available,
    projected,
    totalAvailableAmount,
    totalProjectedAmount,
    isLoading: isDividendsLoading,
  } = useCorporateDividends();

  const gov = useAssetGovernanceInsights();
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const classTargetsQuery = useGroupTargets("class");
  const approveMutation = useApproveDividendsBatch();
  const updateAssetMutation = useUpdatePortfolioAsset();
  const { dismissAlert, isAlertDismissed } = usePortfolioAlertDismissals();

  const [evaluationQueue, setEvaluationQueue] = useState<PortfolioAsset[]>([]);
  const [evaluationIndex, setEvaluationIndex] = useState(0);

  const openEvaluationQueue = (assetsQueue: PortfolioAsset[]) => {
    if (assetsQueue.length === 0) {
      navigate("/investments?tab=rebalancear&view=metas&subtab=assets");
      return;
    }
    setEvaluationQueue(assetsQueue);
    setEvaluationIndex(0);
  };

  const currentEvaluatedAsset = evaluationQueue[evaluationIndex] ?? null;
  const hasNextInQueue = evaluationIndex + 1 < evaluationQueue.length;
  const hasUncertainTax = useMemo(
    () => available.some((d) => Boolean(d.isTypeUncertain)),
    [available],
  );

  const handleApproveAll = async () => {
    if (available.length === 0 || hasUncertainTax) {
      openDividendReviewModal({ initialTab: "review" });
      return;
    }
    const items = available.map((d) => ({
      asset_id: d.assetId,
      ticker: d.ticker,
      date: d.paymentDate ?? todaySaoPauloISO(),
      amount: d.totalAmount,
      notes: `Provento automático (${d.type}) apurado na B3`,
      corporate_dividend_id: d.corporateDividendId,
      ...(d.currency === "USD" ? { currency: "USD" as const } : {}),
    }));

    await approveMutation.mutateAsync({ dividends: items, sync_cash: true });
  };

  const handleQuickConfirmScore = async (asset: PortfolioAsset) => {
    try {
      await updateAssetMutation.mutateAsync({
        id: asset.id,
        patch: { last_reviewed_at: new Date().toISOString() },
      });
      pushToast({
        title: "Nota confirmada",
        description: `Revisão de ${asset.ticker} renovada mantendo a nota ${asset.score}/10.`,
        variant: "success",
      });
    } catch {
      // O hook já exibe toast de erro
    }
  };

  const driftModel = useMemo(
    () =>
      computePortfolioCarouselDrift({
        classTargets: classTargetsQuery?.data ?? [],
        rows: position?.rows ?? [],
        totalBRL: position?.totalBRL ?? 0,
        cashBRL: position?.cashBRL ?? 0,
      }),
    [classTargetsQuery?.data, position?.rows, position?.totalBRL, position?.cashBRL],
  );

  const usdRate = useMemo(
    () => position?.rows?.find((r) => r.currency === "USD")?.usdRate ?? FALLBACK_USD_RATE,
    [position?.rows],
  );

  const structuralAlerts = useMemo(
    () =>
      evaluatePortfolioStructuralRisk(
        assetsQuery?.data ?? [],
        null,
        { fxRateUSD: usdRate },
      ),
    [assetsQuery?.data, usdRate],
  );

  const items: (DashboardAlertItem | false)[] = [
    ...buildStructuralRiskItems({
      alerts: structuralAlerts,
      isAlertDismissed,
      dismissAlert,
      onNavigate: (to) => navigate(to),
      className,
    }),
    ...buildDividendInsightItems({
      availableCount: available.length,
      projectedCount: projected.length,
      totalAvailableAmount,
      totalProjectedAmount,
      hasUncertainTax,
      isApproving: approveMutation.isPending,
      isAvailableDismissed: isAlertDismissed("available-dividends-alert"),
      isProjectedDismissed: isAlertDismissed("projected-dividends-alert"),
      onApproveAll: () => void handleApproveAll(),
      onOpenDetails: () => openDividendReviewModal({ initialTab: "review" }),
      onDismissAvailable: (days) => dismissAlert("available-dividends-alert", days),
      onDismissProjected: (days) => dismissAlert("projected-dividends-alert", days),
      className,
    }),
    ...buildGovernanceInsightItems({
      overdueReviewsCount: gov.overdueReviewsCount ?? 0,
      upcomingReviewsCount: gov.upcomingReviewsCount ?? 0,
      unscoredAssetsCount: gov.unscoredAssetsCount ?? 0,
      quarantinedCount: gov.quarantinedCount ?? 0,
      discountOpportunitiesCount: gov.discountOpportunitiesCount ?? 0,
      lowScoreRiskCount: gov.lowScoreRiskCount ?? 0,
      overdueAssets: gov.overdueAssets ?? [],
      upcomingReviewAssets: gov.upcomingReviewAssets ?? [],
      unscoredAssets: gov.unscoredAssets ?? [],
      consolidatedReviewAlert: gov.consolidatedReviewAlert,
      consolidatedUpcomingAlert: gov.consolidatedUpcomingAlert,
      consolidatedUnscoredAlert: gov.consolidatedUnscoredAlert,
      isUpdatingAsset: updateAssetMutation.isPending,
      isAlertDismissed,
      dismissAlert,
      onQuickConfirmScore: (asset) => void handleQuickConfirmScore(asset),
      onOpenEvaluationQueue: openEvaluationQueue,
      onNavigate: (to) => navigate(to),
      className,
    }),
    ...buildAllocationInsightItems({
      driftModel,
      cashBRL: position?.cashBRL ?? 0,
      isAlertDismissed,
      dismissAlert,
      onNavigate: (to) => navigate(to),
      className,
    }),
  ];

  const activeItems = items.filter(Boolean);
  if ((isDividendsLoading && gov.isLoading) || activeItems.length === 0) {
    return null;
  }

  return (
    <>
      <DashboardAlertsCarousel items={items} maxItems={5} className={className} />

      <AssetScoreEvaluationDialog
        open={Boolean(currentEvaluatedAsset)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEvaluationQueue([]);
            setEvaluationIndex(0);
          }
        }}
        asset={currentEvaluatedAsset}
        queueProgress={
          evaluationQueue.length > 1
            ? { current: evaluationIndex + 1, total: evaluationQueue.length }
            : undefined
        }
        onSavedAndNext={
          hasNextInQueue
            ? () => setEvaluationIndex((prev) => prev + 1)
            : undefined
        }
      />
    </>
  );
}
