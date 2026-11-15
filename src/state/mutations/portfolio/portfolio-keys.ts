import type { QueryClient } from "@tanstack/react-query";

export const PORTFOLIO_QUERY_KEYS = {
  assets: ["portfolio_assets"] as const,
  transactions: ["portfolio_transactions"] as const,
  allTransactions: ["portfolio_transactions", "all"] as const,
  contributions: ["portfolio_contributions"] as const,
  dividends: ["portfolio_dividends"] as const,
  snapshots: ["portfolio_snapshots"] as const,
  allocationTargets: ["allocation_targets"] as const,
  groupTargets: ["group_targets"] as const,
  portfolioPositions: ["portfolio_position"] as const,
  portfolioMonthlyPosition: ["portfolio_monthly_position"] as const,
  assetPrices: ["asset_prices"] as const,
  corporateDividends: ["corporate_dividends"] as const,
  dividendDismissals: ["portfolio_dividend_dismissals"] as const,
  family: ["family"] as const,
  accounts: ["accounts"] as const,
};

export interface InvalidatePortfolioSuiteOptions {
  invalidateAccounts?: boolean;
  invalidateTargets?: boolean;
}

/**
 * Invalida de forma atômica todas as queries de cache do ecossistema de investimentos.
 * Garante sincronia estrita entre Custódia, Ledger, Proventos, Metas de Alocação e Resumos.
 */
export function invalidatePortfolioSuite(
  queryClient: QueryClient,
  options: InvalidatePortfolioSuiteOptions = {},
): Promise<void[]> {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.portfolioPositions }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.portfolioMonthlyPosition }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.family }),
  ];

  if (options.invalidateTargets !== false) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allocationTargets }),
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.groupTargets }),
    );
  }

  if (options.invalidateAccounts) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.accounts }),
    );
  }

  return Promise.all(promises);
}

