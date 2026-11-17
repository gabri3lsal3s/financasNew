import { useMemo } from "react";
import { usePortfolioAssets } from "./use-portfolio";
import { usePortfolioPosition } from "./use-portfolio-position";
import {
  generateAssetGovernanceInsights,
  type GovernanceAssetInput,
  type GovernanceInsight,
  type GovernanceInsightsResult,
} from "@/domain/portfolio";

export interface UseAssetGovernanceInsightsResult {
  insights: GovernanceInsight[];
  summary: GovernanceInsightsResult["summary"];
  consolidatedReviewAlert: GovernanceInsight | null;
  overdueReviewsCount: number;
  quarantinedCount: number;
  discountOpportunitiesCount: number;
  lowScoreRiskCount: number;
  isLoading: boolean;
  refetch: () => void;
}

export function useAssetGovernanceInsights(): UseAssetGovernanceInsightsResult {
  const assetsQuery = usePortfolioAssets();
  const { rows: positionRows, totalBRL: totalPortfolioBRL, isLoading: isPositionLoading, refetch: refetchPosition } = usePortfolioPosition();

  const result = useMemo<GovernanceInsightsResult>(() => {
    const assets = assetsQuery.data ?? [];
    if (assets.length === 0) {
      return {
        insights: [],
        summary: {
          overdueCount: 0,
          quarantineCount: 0,
          opportunityCount: 0,
          lowScoreRiskCount: 0,
          totalInsights: 0,
        },
        consolidatedReviewAlert: null,
      };
    }

    const rowMap = new Map<string, (typeof positionRows)[number]>();
    for (const row of positionRows) {
      rowMap.set(row.assetId, row);
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
        score: asset.score ?? null,
        allocation_status: asset.allocation_status ?? "active",
        last_reviewed_at: asset.last_reviewed_at ?? null,
        review_frequency_months: asset.review_frequency_months ?? 6,
        thesis_summary: asset.thesis_summary ?? null,
      };
    });

    return generateAssetGovernanceInsights({
      assets: inputs,
      totalPortfolioBRL,
      referenceDate: new Date(),
    });
  }, [assetsQuery.data, positionRows, totalPortfolioBRL]);

  return {
    insights: result.insights,
    summary: result.summary,
    consolidatedReviewAlert: result.consolidatedReviewAlert,
    overdueReviewsCount: result.summary.overdueCount,
    quarantinedCount: result.summary.quarantineCount,
    discountOpportunitiesCount: result.summary.opportunityCount,
    lowScoreRiskCount: result.summary.lowScoreRiskCount,
    isLoading: assetsQuery.isLoading || isPositionLoading,
    refetch: () => {
      void assetsQuery.refetch();
      refetchPosition();
    },
  };
}
