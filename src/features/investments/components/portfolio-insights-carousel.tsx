import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { todaySaoPauloISO } from "@/domain/portfolio";
import { computePortfolioCarouselDrift } from "@/domain/portfolio/insights-carousel-drift";
import { evaluatePortfolioStructuralRisk } from "@/domain/portfolio/portfolio-risk-policy";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { useCarouselPresenceHint } from "@/hooks/use-carousel-presence-hint";
import { usePortfolioAlertDismissals } from "@/hooks/use-portfolio-alert-dismissals";
import { openDividendReviewModal } from "@/services/dividend-review-modal";
import { formatPercent } from "@/services/masks/percent";
import { pushToast } from "@/services/toast";
import {
  useAssetGovernanceInsights,
  useConfirmUserDividendEvents,
  useCorporateDividends,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useUpdatePortfolioAsset,
  useUserPreferences,
} from "@/state";
import { isQueryPending } from "@/state/query-readiness";
import type {
  ConfirmDividendEventItem,
  CorporateDividendType,
  PortfolioAsset,
} from "@/types";
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
    monthlyForecast,
    isLoading: isDividendsLoading,
  } = useCorporateDividends();


  const gov = useAssetGovernanceInsights();
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const classTargetsQuery = useGroupTargets("class");
  const confirmMutation = useConfirmUserDividendEvents();
  const userPreferencesQuery = useUserPreferences();
  const updateAssetMutation = useUpdatePortfolioAsset();
  const { dismissAlert, isAlertDismissed, isLoading: isDismissalsLoading } =
    usePortfolioAlertDismissals();

  const autoCreditCash =
    userPreferencesQuery?.data?.custom_settings?.dividendAutomation?.autoCreditCash !== false;

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

  const usdRate =
    position?.usdRate && position.usdRate > 0
      ? position.usdRate
      : (position?.rows?.find((r) => r.currency === "USD")?.usdRate ?? FALLBACK_USD_RATE);

  const handleApproveAll = async () => {
    if (confirmMutation.isPending) return;
    if (
      available.length === 0 ||
      hasUncertainTax ||
      available.some((d) => !d.paymentDate)
    ) {
      openDividendReviewModal({ initialTab: "review" });
      return;
    }

    const items: ConfirmDividendEventItem[] = available
      .filter((d) => d.totalAmount > 0 && Boolean(d.paymentDate))
      .map((d) => {
        const taxPct =
          d.taxRatePct !== undefined
            ? d.taxRatePct
            : d.currency === "USD"
              ? 30
              : d.type === "JCP"
                ? 15
                : 0;
        return {
          event_id: d.eventId ?? null,
          corporate_dividend_id: d.isManual ? null : d.corporateDividendId,
          asset_id: d.assetId,
          ticker: d.ticker,
          type: (d.type as CorporateDividendType) || "DIVIDENDO",
          com_date: d.comDate,
          date: d.paymentDate ?? todaySaoPauloISO(),
          amount: Math.round(d.totalAmount * 100) / 100,
          tax_rate_pct: taxPct,
          quantity_on_com_date: Math.max(0, d.quantityOnComDate),
          gross_rate: d.rate,
          net_rate: d.netRate,
          currency: d.currency,
          fx_rate: d.currency === "USD" ? usdRate : null,
          notes: d.isManual
            ? (d.notes?.trim() || `Provento manual (${d.type})`)
            : `Provento automático (${d.type}${taxPct > 0 ? ` · ${formatPercent(taxPct)}% IR` : ""})`,
        };
      });

    if (items.length === 0) {
      openDividendReviewModal({ initialTab: "review" });
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        items,
        sync_cash: autoCreditCash,
      });
    } catch {
      // O hook já exibe toast de erro
    }
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

  const structuralAlerts = useMemo(
    () =>
      evaluatePortfolioStructuralRisk(
        assetsQuery?.data ?? [],
        null,
        {
          fxRateUSD: usdRate,
          positionRows: position?.rows,
          cashBRL: position?.cashBRL,
        },
      ),
    [assetsQuery?.data, usdRate, position?.rows, position?.cashBRL],
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
      projectedCount: monthlyForecast ? monthlyForecast.count : projected.length,
      totalAvailableAmount,
      totalProjectedAmount: monthlyForecast ? monthlyForecast.totalBRL : totalProjectedAmount,
      hasUncertainTax,
      autoCreditCash,
      isApproving: confirmMutation.isPending,
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
  const isPortfolioEmpty = Boolean(
    assetsQuery?.isSuccess && (assetsQuery?.data?.length ?? 0) === 0,
  );
  const isCoreLoading =
    gov.isLoading ||
    Boolean(position?.isLoading) ||
    isQueryPending(assetsQuery) ||
    isQueryPending(classTargetsQuery) ||
    isDismissalsLoading;
  const isCarouselLoading =
    !isPortfolioEmpty && (isCoreLoading || (isDividendsLoading && activeItems.length === 0));
  const [wasReadyOnMount] = useState(() => !isCarouselLoading);
  const { shouldShowSkeleton } = useCarouselPresenceHint("portfolio_insights", {
    isLoading: isCarouselLoading,
    hasItems: activeItems.length > 0,
  });

  if (isCarouselLoading) {
    if (!shouldShowSkeleton) {
      return null;
    }
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando insights da carteira"
        className="w-full min-h-[104px] sm:min-h-[84px] rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs animate-pulse flex items-center gap-3.5"
      >
        <div className="size-9 shrink-0 rounded-xl bg-muted" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 w-40 max-w-full rounded bg-muted" />
          <div className="h-3 w-72 max-w-full rounded bg-muted/70" />
        </div>
      </div>
    );
  }

  if (activeItems.length === 0) {
    return null;
  }

  return (
    <>
      <DashboardAlertsCarousel
        items={items}
        maxItems={5}
        className={className}
        animateOnMount={!wasReadyOnMount}
      />

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
