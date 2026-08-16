import { useQuery } from "@tanstack/react-query";
import { listAssetPrices } from "@/data/repositories/asset-prices";
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
