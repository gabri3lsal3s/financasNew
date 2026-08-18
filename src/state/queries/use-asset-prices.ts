import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAssetPrices,
  removeManualPrice,
  setManualPrice,
  type ManualPriceInput,
} from "@/data/repositories/asset-prices";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { STALE_TIMES } from "@/state/cache-policy";

const assetPricesKey = ["asset_prices"] as const;

/** Preços de mercado (cache global + overrides manuais) — §1.6. */
export function useAssetPrices() {
  return useQuery({
    queryKey: assetPricesKey,
    queryFn: () => listAssetPrices(),
    staleTime: STALE_TIMES.quotes,
  });
}

/** Grava o override manual de preço (prevalece sobre cache/fallback). */
export function useSetManualPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualPriceInput) => setManualPrice(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetPricesKey });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível definir o preço manual",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/** Remove o override manual — o preço volta a seguir cotação/fallback. */
export function useRemoveManualPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => removeManualPrice(ticker),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetPricesKey });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível remover o preço manual",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
