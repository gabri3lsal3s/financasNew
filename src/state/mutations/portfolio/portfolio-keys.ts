export const PORTFOLIO_QUERY_KEYS = {
  assets: ["portfolio_assets"] as const,
  transactions: ["portfolio_transactions"] as const,
  allTransactions: ["portfolio_transactions", "all"] as const,
  contributions: ["portfolio_contributions"] as const,
  dividends: ["portfolio_dividends"] as const,
  snapshots: ["portfolio_snapshots"] as const,
  allocationTargets: ["allocation_targets"] as const,
  assetPrices: ["asset_prices"] as const,
  corporateDividends: ["corporate_dividends"] as const,
  dividendDismissals: ["portfolio_dividend_dismissals"] as const,
};
