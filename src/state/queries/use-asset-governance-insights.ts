import { useMemo } from "react";
import { usePortfolioAssets } from "./use-portfolio";
import { usePortfolioPosition } from "./use-portfolio-position";
import {
  generateAssetGovernanceInsights,
  isCashAssetClass,
  type GovernanceAssetInput,
  type GovernanceInsight,
  type GovernanceInsightsResult,
} from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";

export interface UseAssetGovernanceInsightsResult {
  insights: GovernanceInsight[];
  summary: GovernanceInsightsResult["summary"];
  consolidatedReviewAlert: GovernanceInsight | null;
  consolidatedUpcomingAlert: GovernanceInsight | null;
  consolidatedUnscoredAlert: GovernanceInsight | null;
  overdueReviewsCount: number;
  upcomingReviewsCount: number;
  unscoredAssetsCount: number;
  quarantinedCount: number;
  discountOpportunitiesCount: number;
  lowScoreRiskCount: number;
  overdueAssets: PortfolioAsset[];
  upcomingReviewAssets: PortfolioAsset[];
  unscoredAssets: PortfolioAsset[];
  isLoading: boolean;
  refetch: () => void;
}

export function useAssetGovernanceInsights(): UseAssetGovernanceInsightsResult {
  const assetsQuery = usePortfolioAssets();
  const { rows: positionRows, totalBRL: totalPortfolioBRL, isLoading: isPositionLoading, refetch: refetchPosition } = usePortfolioPosition();

  const { result, overdueAssets, upcomingReviewAssets, unscoredAssets } = useMemo(() => {
    const allAssets = assetsQuery.data ?? [];
    const assets = allAssets.filter((a) => !isCashAssetClass(a.asset_class));

    if (assets.length === 0) {
      return {
        result: {
          insights: [],
          summary: {
            overdueCount: 0,
            upcomingReviewCount: 0,
            unscoredCount: 0,
            quarantineCount: 0,
            opportunityCount: 0,
            lowScoreRiskCount: 0,
            totalInsights: 0,
          },
          consolidatedReviewAlert: null,
          consolidatedUpcomingAlert: null,
          consolidatedUnscoredAlert: null,
        } satisfies GovernanceInsightsResult,
        overdueAssets: [] as PortfolioAsset[],
        upcomingReviewAssets: [] as PortfolioAsset[],
        unscoredAssets: [] as PortfolioAsset[],
      };
    }

    const rowMap = new Map<string, (typeof positionRows)[number]>();
    for (const row of positionRows) {
      rowMap.set(row.assetId, row);
    }

    const assetMap = new Map<string, PortfolioAsset>();
    for (const asset of assets) {
      assetMap.set(asset.id, asset);
    }

    const inputs: GovernanceAssetInput[] = assets.map((asset) => {
      const row = rowMap.get(asset.id);
      return {
        id: asset.id,
        ticker: asset.ticker,
        assetClass: asset.asset_class,
        sector: asset.sector,
        currentValueBRL: row?.valueBRL ?? 0,
        currentPrice: row?.priceBRL ?? 0,
        averageCost: row?.averageCostBRL ?? 0,
        ceilingPrice: asset.ceiling_price ?? null,
        score: asset.score ?? null,
        allocation_status: asset.allocation_status ?? "active",
        last_reviewed_at: asset.last_reviewed_at ?? null,
        review_frequency_months: asset.review_frequency_months ?? 6,
        thesis_summary: asset.thesis_summary ?? null,
      };
    });

    const computed = generateAssetGovernanceInsights({
      assets: inputs,
      totalPortfolioBRL,
      referenceDate: new Date(),
    });

    const mapIdsToAssets = (ids?: string[]) =>
      (ids ?? [])
        .map((id) => assetMap.get(id))
        .filter((a): a is PortfolioAsset => Boolean(a));

    return {
      result: computed,
      overdueAssets: mapIdsToAssets(computed.consolidatedReviewAlert?.assetIds),
      upcomingReviewAssets: mapIdsToAssets(computed.consolidatedUpcomingAlert?.assetIds),
      unscoredAssets: mapIdsToAssets(computed.consolidatedUnscoredAlert?.assetIds),
    };
  }, [assetsQuery.data, positionRows, totalPortfolioBRL]);

  return {
    insights: result.insights,
    summary: result.summary,
    consolidatedReviewAlert: result.consolidatedReviewAlert,
    consolidatedUpcomingAlert: result.consolidatedUpcomingAlert,
    consolidatedUnscoredAlert: result.consolidatedUnscoredAlert,
    overdueReviewsCount: result.summary.overdueCount,
    upcomingReviewsCount: result.summary.upcomingReviewCount,
    unscoredAssetsCount: result.summary.unscoredCount,
    quarantinedCount: result.summary.quarantineCount,
    discountOpportunitiesCount: result.summary.opportunityCount,
    lowScoreRiskCount: result.summary.lowScoreRiskCount,
    overdueAssets,
    upcomingReviewAssets,
    unscoredAssets,
    isLoading: assetsQuery.isLoading || isPositionLoading,
    refetch: () => {
      void assetsQuery.refetch();
      refetchPosition();
    },
  };
}
