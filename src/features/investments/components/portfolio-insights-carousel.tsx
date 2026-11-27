import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BridgeAlertCard } from "@/components/modules";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { buildPortfolioCarouselBreakdown } from "@/domain/calculation-memory/builders/portfolio-carousel-breakdown";
import {
  evaluateCombinedContributionBridge,
  evaluateDebtVsInvestBridge,
  evaluateHomeCashGapForInvestments,
  evaluateHomeSurplusForInvestments,
  evaluateMonthlyContributionConsistencyBridge,
  selectCarouselSlots,
  type BridgeAlertEvaluation,
  type CarouselSlotCandidate,
} from "@/domain/notifications/hub";
import { todaySaoPauloISO } from "@/domain/portfolio";
import { computePortfolioCarouselDrift } from "@/domain/portfolio/insights-carousel-drift";
import {
  evaluatePortfolioStructuralRisk,
  resolvePortfolioRiskPolicy,
} from "@/domain/portfolio/portfolio-risk-policy";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { useCarouselDismissals } from "@/hooks/use-carousel-dismissals";
import { useSafeViewScope } from "@/hooks/use-safe-business-scope";
import { currentMonth } from "@/lib/date";
import { openDividendReviewModal } from "@/services/dividend-review-modal";
import { formatPercent } from "@/services/masks/percent";
import { pushToast } from "@/services/toast";
import { getActiveUserId } from "@/services/user-storage";
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
import { useDemoSession } from "@/state/demo-mode";
import { isQueryPending } from "@/state/query-readiness";
import {
  readWarmDebts,
  readWarmLoans,
  readWarmPortfolioContributions,
  usePassiveCarouselCache,
} from "@/state/selectors";
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
  const {
    dismissalsMap,
    invalidIds,
    isCardVisible,
    dismissCard,
    isLoading: isDismissalsLoading,
  } = useCarouselDismissals();
  const { isDemoActive } = useDemoSession();
  const { effectiveViewScope } = useSafeViewScope();
  const legacyPortfolioDismissals = useMemo(
    () => ({
      portfolioAlertDismissals:
        userPreferencesQuery?.data?.custom_settings?.portfolioAlertDismissals,
    }),
    [userPreferencesQuery?.data?.custom_settings?.portfolioAlertDismissals],
  );
  const checkCardVisible = (cardKey: string) =>
    isCardVisible(cardKey, { legacySources: legacyPortfolioDismissals });

  const autoCreditCash =
    userPreferencesQuery?.data?.custom_settings?.dividendAutomation?.autoCreditCash !== false;

  const [evaluationQueue, setEvaluationQueue] = useState<PortfolioAsset[]>([]);
  const [evaluationIndex, setEvaluationIndex] = useState(0);

  const openEvaluationQueue = (assetsQueue: PortfolioAsset[]) => {
    if (assetsQueue.length === 0) {
      navigate("/investments?tab=metas");
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

  const riskPolicy = useMemo(
    () =>
      resolvePortfolioRiskPolicy(
        userPreferencesQuery?.data?.custom_settings?.portfolioRiskPolicy,
      ),
    [userPreferencesQuery?.data?.custom_settings?.portfolioRiskPolicy],
  );

  const structuralAlerts = useMemo(
    () =>
      evaluatePortfolioStructuralRisk(
        assetsQuery?.data ?? [],
        riskPolicy,
        {
          fxRateUSD: usdRate,
          positionRows: position?.rows,
          cashBRL: position?.cashBRL,
        },
      ),
    [assetsQuery?.data, riskPolicy, usdRate, position?.rows, position?.cashBRL],
  );

  const competence = currentMonth();
  const todayStr = todaySaoPauloISO();
  const evidenceIdentity = useMemo(
    () => ({
      userId: getActiveUserId(),
      mode: isDemoActive ? ("demo" as const) : ("auth" as const),
      scope: effectiveViewScope,
      month: competence,
      asOf: todayStr,
    }),
    [isDemoActive, effectiveViewScope, competence, todayStr],
  );
  const {
    queryClient: passiveQueryClient,
    cacheVersion: passiveCacheVersion,
    evidence: homeEvidence,
  } = usePassiveCarouselCache(evidenceIdentity);
  const warmLoans = useMemo(() => {
    void passiveCacheVersion;
    return readWarmLoans(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);
  const warmDebts = useMemo(() => {
    void passiveCacheVersion;
    return readWarmDebts(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);
  const warmContributions = useMemo(() => {
    void passiveCacheVersion;
    return readWarmPortfolioContributions(passiveQueryClient);
  }, [passiveCacheVersion, passiveQueryClient]);

  const totalPortfolioCents = Math.round((position?.totalBRL ?? 0) * 100);
  const lowScoreSample = useMemo(() => {
    if (totalPortfolioCents <= 0) return undefined;
    const threshold = riskPolicy.lowScoreThreshold;
    const candidates = (assetsQuery?.data ?? [])
      .filter(
        (a) =>
          a.allocation_status !== "exit" &&
          a.score !== null &&
          a.score !== undefined &&
          a.score <= threshold,
      )
      .map((asset) => {
        const row = position?.rows?.find((r) => r.assetId === asset.id);
        const valCents = Math.round(
          (row?.valueBRL ?? asset.quantity * asset.average_price) * 100,
        );
        const weightPct = (valCents / totalPortfolioCents) * 100;
        return { asset, valCents, weightPct };
      })
      .sort((a, b) => b.weightPct - a.weightPct || a.asset.ticker.localeCompare(b.asset.ticker));
    const picked = candidates.find((c) => c.weightPct > 5) ?? candidates[0];
    if (!picked) return undefined;
    return buildPortfolioCarouselBreakdown({
      kind: "lowScore",
      ticker: picked.asset.ticker,
      score: picked.asset.score ?? 0,
      scoreLimit: threshold,
      valueCents: picked.valCents,
      totalCents: totalPortfolioCents,
      weightPct: picked.weightPct,
      weightLimitPct: 5,
    });
  }, [assetsQuery?.data, position?.rows, totalPortfolioCents, riskPolicy.lowScoreThreshold]);

  const discountSample = useMemo(() => {
    const candidates = (assetsQuery?.data ?? [])
      .filter(
        (a) =>
          a.allocation_status !== "exit" &&
          a.score !== null &&
          a.score !== undefined &&
          a.score >= 8 &&
          a.ceiling_price !== null &&
          a.ceiling_price !== undefined &&
          a.ceiling_price > 0,
      )
      .map((asset) => {
        const row = position?.rows?.find((r) => r.assetId === asset.id);
        const quote =
          row && !row.isEstimate && Number.isFinite(row.priceQuote) && row.priceQuote > 0
            ? row.priceQuote
            : null;
        const ceiling = asset.ceiling_price!;
        if (quote === null || quote >= ceiling) return null;
        const discountPct = ((ceiling - quote) / ceiling) * 100;
        return { asset, row, quote, ceiling, discountPct };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.discountPct - a.discountPct || a.asset.ticker.localeCompare(b.asset.ticker));
    const picked = candidates.find((c) => c.discountPct >= 15) ?? candidates[0];
    if (!picked) return undefined;
    return buildPortfolioCarouselBreakdown({
      kind: "discount",
      ticker: picked.asset.ticker,
      currency: picked.asset.currency === "USD" ? "USD" : "BRL",
      quote: picked.quote,
      ceiling: picked.ceiling,
      quoteSource: picked.row?.canonicalSource ?? picked.row?.source ?? "Cotação de mercado",
      score: picked.asset.score ?? 8,
      discountPct: picked.discountPct,
    });
  }, [assetsQuery?.data, position?.rows]);

  const brokerageCashCents = Math.round((position?.cashBRL ?? 0) * 100);
  const hasEligibleDeficitTarget =
    driftModel.allocationDrift.hasTargets &&
    driftModel.allocationDrift.underweightItems.length > 0;
  const eligibleClassName = driftModel.allocationDrift.underweightItems[0]?.name;

  const homeCashGapBridge = homeEvidence
    ? evaluateHomeCashGapForInvestments({
        isCurrentMonth: homeEvidence.isCurrentMonth,
        cashGapResult: homeEvidence.cashGapResult,
      })
    : null;

  const combinedContributionBridge = homeEvidence
    ? evaluateCombinedContributionBridge({
        asOf: todayStr,
        month: competence,
        isCurrentMonth: homeEvidence.isCurrentMonth,
        allocationIntent: homeEvidence.surplusCapacity.allocationIntent,
        suggestedAporteCents: homeEvidence.surplusCapacity.suggestedAporteCents,
        brokerageCashCents,
        minTicketCents: Math.round((riskPolicy.minTicketBRL ?? 100) * 100),
        hasEligibleDeficitTarget,
        eligibleClass: eligibleClassName,
        pendingDividendsCount: available.length,
        pendingDividendsBRLCents: Math.round(totalAvailableAmount * 100),
      })
    : null;

  const monthlyConsistencyBridge = homeEvidence
    ? evaluateMonthlyContributionConsistencyBridge({
        month: competence,
        isCurrentMonth: homeEvidence.isCurrentMonth,
        dayOfMonth: homeEvidence.dayOfMonth,
        daysInMonth: homeEvidence.daysInMonth,
        allocationIntent: homeEvidence.surplusCapacity.allocationIntent,
        suggestedAporteCents: homeEvidence.surplusCapacity.suggestedAporteCents,
        contributions: warmContributions,
        hasCombinedContributionBridge: Boolean(combinedContributionBridge),
      })
    : null;

  const debtVsInvestBridge = evaluateDebtVsInvestBridge({
    asOf: todayStr,
    debts: warmDebts,
    loans: warmLoans,
    allocationIntent: homeEvidence?.surplusCapacity.allocationIntent ?? "none",
    suggestedAporteCents: homeEvidence?.surplusCapacity.suggestedAporteCents ?? 0,
    brokerageCashCents,
  });

  const homeSurplusBridge = homeEvidence
    ? evaluateHomeSurplusForInvestments({
        isCurrentMonth: homeEvidence.isCurrentMonth,
        allocationIntent: homeEvidence.surplusCapacity.allocationIntent,
        suggestedAporteCents: homeEvidence.surplusCapacity.suggestedAporteCents,
        hasCashGapCritical: Boolean(homeCashGapBridge),
        hasCombinedContributionBridge: Boolean(combinedContributionBridge),
      })
    : null;

  const structuralItemsRaw = buildStructuralRiskItems({
    alerts: structuralAlerts,
    isCardVisible: checkCardVisible,
    onSelectPreset: dismissCard,
    onNavigate: (to) => navigate(to),
    className,
  }).filter((item): item is DashboardAlertItem => Boolean(item && item.content));

  const dividendItemsRaw = buildDividendInsightItems({
    availableCount: available.length,
    projectedCount: monthlyForecast ? monthlyForecast.count : projected.length,
    totalAvailableAmount,
    totalProjectedAmount: monthlyForecast ? monthlyForecast.totalBRL : totalProjectedAmount,
    availableItems: available.map((d, idx) => ({
      key: d.eventId ?? `${d.ticker}:${idx}`,
      ticker: d.ticker,
      currency: d.currency,
      quantityOnComDate: d.quantityOnComDate,
      grossRate: d.rate,
      netRate: d.netRate,
      taxPct: d.taxRatePct ?? (d.currency === "USD" ? 30 : d.type === "JCP" ? 15 : 0),
      taxSource: d.isTypeUncertain ? "Estimado" : "Oficial",
      paymentDate: d.paymentDate,
      nativeNetCents: Math.round(d.totalAmount * 100),
      netBRLCents: Math.round(
        d.totalAmount * (d.currency === "USD" ? usdRate : 1) * 100,
      ),
      included: d.totalAmount > 0,
    })),
    projectedItems: projected.map((d, idx) => ({
      key: d.eventId ?? `${d.ticker}:proj:${idx}`,
      ticker: d.ticker,
      currency: d.currency,
      quantityOnComDate: d.quantityOnComDate,
      grossRate: d.rate,
      netRate: d.netRate,
      taxPct: d.taxRatePct ?? (d.currency === "USD" ? 30 : d.type === "JCP" ? 15 : 0),
      taxSource: d.isTypeUncertain ? "Estimado" : "Oficial",
      paymentDate: d.paymentDate,
      nativeNetCents: Math.round(d.totalAmount * 100),
      netBRLCents: Math.round(
        d.totalAmount * (d.currency === "USD" ? usdRate : 1) * 100,
      ),
      included: d.totalAmount > 0,
    })),
    usdRate,
    competence,
    hasUncertainTax,
    autoCreditCash,
    isApproving: confirmMutation.isPending,
    isAvailableDismissed: !checkCardVisible("portfolio.dividends_available"),
    isProjectedDismissed: !checkCardVisible("portfolio.dividends_projected"),
    onApproveAll: () => void handleApproveAll(),
    onOpenDetails: () =>
      openDividendReviewModal({ initialTab: "review", competence }),
    onSelectPreset: dismissCard,
    className,
  }).filter((item): item is DashboardAlertItem => Boolean(item && item.content));

  const governanceItemsRaw = buildGovernanceInsightItems({
    overdueReviewsCount: gov.overdueReviewsCount ?? 0,
    upcomingReviewsCount: gov.upcomingReviewsCount ?? 0,
    unscoredAssetsCount: gov.unscoredAssetsCount ?? 0,
    quarantinedCount: gov.quarantinedCount ?? 0,
    discountOpportunitiesCount: gov.discountOpportunitiesCount ?? 0,
    lowScoreRiskCount: gov.lowScoreRiskCount ?? 0,
    lowScoreBreakdown: lowScoreSample,
    discountBreakdown: discountSample,
    overdueAssets: gov.overdueAssets ?? [],
    upcomingReviewAssets: gov.upcomingReviewAssets ?? [],
    unscoredAssets: gov.unscoredAssets ?? [],
    consolidatedReviewAlert: gov.consolidatedReviewAlert,
    consolidatedUpcomingAlert: gov.consolidatedUpcomingAlert,
    consolidatedUnscoredAlert: gov.consolidatedUnscoredAlert,
    isUpdatingAsset: updateAssetMutation.isPending,
    isCardVisible: checkCardVisible,
    onSelectPreset: dismissCard,
    onQuickConfirmScore: (asset) => void handleQuickConfirmScore(asset),
    onOpenEvaluationQueue: openEvaluationQueue,
    onNavigate: (to) => navigate(to),
    className,
  }).filter((item): item is DashboardAlertItem => Boolean(item && item.content));

  const allocationItemsRaw = buildAllocationInsightItems({
    driftModel,
    cashBRL: position?.cashBRL ?? 0,
    isCardVisible: checkCardVisible,
    onSelectPreset: dismissCard,
    onNavigate: (to) => navigate(to),
    className,
  }).filter((item): item is DashboardAlertItem => Boolean(item && item.content));

  interface PortfolioSlotCandidate extends CarouselSlotCandidate {
    content: DashboardAlertItem["content"];
  }

  const bridgeCandidates: PortfolioSlotCandidate[] = (
    [
      homeCashGapBridge,
      combinedContributionBridge,
      debtVsInvestBridge,
      monthlyConsistencyBridge,
      homeSurplusBridge,
    ] as (BridgeAlertEvaluation | null)[]
  )
    .filter((ev): ev is BridgeAlertEvaluation => Boolean(ev))
    .filter((ev) => checkCardVisible(ev.canonicalId))
    .map((ev) => ({
      id: ev.canonicalId,
      canonicalId: ev.canonicalId,
      priority: ev.priority,
      severity: ev.severity,
      cycleRelevance: ev.cycleRelevance,
      channels: ev.channels,
      entityRefs: ev.entityRefs,
      suppressCanonicalIds: ev.suppressCanonicalIds,
      content: (
        <BridgeAlertCard
          evaluation={ev}
          onNavigate={(to) => navigate(to)}
          onSelectPreset={dismissCard}
          className={className}
        />
      ),
    }));

  const nativeCandidates: PortfolioSlotCandidate[] = [
    ...structuralItemsRaw.map((item) => ({
      id: item.id,
      canonicalId: item.id,
      priority: item.priority,
      channels: ["investments_carousel"] as const,
      isStructuralRisk: true,
      content: item.content,
    })),
    ...dividendItemsRaw.map((item) => ({
      id: item.id,
      canonicalId: item.id,
      priority: item.priority,
      channels: ["investments_carousel"] as const,
      content: item.content,
    })),
    ...governanceItemsRaw.map((item) => ({
      id: item.id,
      canonicalId: item.id,
      priority: item.priority,
      channels: ["investments_carousel"] as const,
      content: item.content,
    })),
    ...allocationItemsRaw.map((item) => ({
      id: item.id,
      canonicalId: item.id,
      priority: item.priority,
      channels: ["investments_carousel"] as const,
      content: item.content,
    })),
  ];

  const items: DashboardAlertItem[] = selectCarouselSlots({
    channel: "investments_carousel",
    items: [...bridgeCandidates, ...nativeCandidates],
    carouselDismissals: dismissalsMap,
    invalidIds,
    legacySources: legacyPortfolioDismissals,
    maxSlots: 5,
    maxStructuralRisks: 2,
  }).visibleItems.map(({ id, priority, content }) => ({
    id,
    priority,
    content,
  }));

  const activeItems = items;
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

  return (
    <>
      <DashboardAlertsCarousel
        items={items}
        maxItems={5}
        isLoading={isCarouselLoading}
        presenceHintKey="portfolio_insights"
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
