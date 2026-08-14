import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAssetPrices,
  removeManualPrice,
  setManualPrice,
  type ManualPriceInput,
} from "@/data/repositories/asset-prices";

export const assetPricesKey = ["asset_prices"] as const;

/** Preços de mercado (cache global + overrides manuais) — §1.6. */
export function useAssetPrices() {
  return useQuery({
    queryKey: assetPricesKey,
    queryFn: () => listAssetPrices(),
    staleTime: 60_000,
  });
}

/** Grava o preço manual de um ticker (prevalece sobre cache/fallback). */
export function useSetManualPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualPriceInput) => setManualPrice(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetPricesKey });
    },
  });
}

/** Remove o override manual — o preço volta a seguir cache/fallback. */
export function useRemoveManualPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => removeManualPrice(ticker),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetPricesKey });
    },
  });
}
