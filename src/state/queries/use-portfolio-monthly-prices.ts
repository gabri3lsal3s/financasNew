import { useQuery } from "@tanstack/react-query";
import { listPortfolioMonthlyPrices } from "@/data/repositories/portfolio-monthly-prices";
import type { MonthlyPriceRow } from "@/types";

export const PORTFOLIO_MONTHLY_PRICES_QUERY_KEY = "portfolio_monthly_prices" as const;

export function usePortfolioMonthlyPrices(month: string) {
  return useQuery<MonthlyPriceRow[]>({
    queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, month],
    queryFn: () => listPortfolioMonthlyPrices(month),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(month),
  });
}
