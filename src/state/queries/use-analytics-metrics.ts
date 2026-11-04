import { useQuery } from "@tanstack/react-query";
import { getFeatureUsageRanking } from "@/data/repositories/analytics";
import type { FeatureUsageMetric } from "@/types";

export const analyticsRankingKey = ["admin_analytics_ranking"] as const;

export function useFeatureUsageMetrics(days = 30) {
  return useQuery<FeatureUsageMetric[]>({
    queryKey: [...analyticsRankingKey, days],
    queryFn: () => getFeatureUsageRanking(days),
    staleTime: 1000 * 60 * 5, // 5 minutos de cache no admin
  });
}
