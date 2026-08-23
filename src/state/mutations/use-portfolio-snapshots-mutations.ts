import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertPortfolioSnapshot, upsertPortfolioAssetsBatch } from "@/data/repositories/portfolio";
import { PORTFOLIO_QUERY_KEYS } from "./use-portfolio-mutations";
import type { DbInsert, PortfolioAsset } from "@/types";

export function useUpsertPortfolioSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: string; total_value: number; total_cost: number }) =>
      upsertPortfolioSnapshot(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
    },
  });
}

export function useUpsertPortfolioAssetsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioAsset>, "user_id">[]) =>
      upsertPortfolioAssetsBatch(inputs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assetPrices });
    },
  });
}
