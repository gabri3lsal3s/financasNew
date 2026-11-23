import type { QueryClient } from "@tanstack/react-query";
import {
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
} from "@/domain/portfolio";

export const PORTFOLIO_QUERY_KEYS = {
  assets: ["portfolio_assets"] as const,
  transactions: ["portfolio_transactions"] as const,
  allTransactions: ["portfolio_transactions", "all"] as const,
  contributions: ["portfolio_contributions"] as const,
  dividends: ["portfolio_dividends"] as const,
  snapshots: ["portfolio_snapshots"] as const,
  groupTargets: ["group_targets"] as const,
  portfolioPositions: ["portfolio_position"] as const,
  portfolioMonthlyPosition: ["portfolio_monthly_position"] as const,
  assetPrices: ["asset_prices"] as const,
  corporateDividends: ["corporate_dividends"] as const,
  userDividendEvents: ["user_dividend_events"] as const,
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
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.userDividendEvents }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals }),
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.family }),
  ];

  if (options.invalidateTargets !== false) {
    promises.push(
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

/**
 * Sincronização cirúrgica e assíncrona após cadastro de ativo inédito (`cache_miss`)
 * ou registro de ordem no dia atual (`post_trade_stale`). Nunca bloqueia a mutation nem dispara toasts.
 */
export async function triggerSurgicalQuoteSync(
  queryClient: QueryClient,
  params: {
    assets: ReadonlyArray<{
      ticker: string;
      asset_class?: string | null;
      notes?: string | null;
    }>;
    reason: "cache_miss" | "post_trade_stale";
    includeUsdFx?: boolean;
  },
): Promise<void> {
  const tickersToSync = new Set<string>();

  for (const a of params.assets) {
    const clean = a.ticker.trim().toUpperCase();
    if (
      !clean ||
      clean === "CAIXA" ||
      clean === "CASH" ||
      clean.startsWith("CAIXA_") ||
      clean.startsWith("CASH_")
    ) {
      continue;
    }
    if (isCashAssetClass(a.asset_class ?? null)) continue;
    if (isFixedIncomeClass(a.asset_class ?? null) && !isTesouroAsset(clean, a.asset_class)) {
      continue;
    }
    if (isPrivateFixedIncomeTicker(clean) || isCustomValuationAsset(a)) continue;
    if (isTesouroAsset(clean, a.asset_class) || Boolean(normalizeTesouroTicker(clean))) {
      continue;
    }
    tickersToSync.add(clean);
  }

  if (tickersToSync.size === 0) return;

  if (params.includeUsdFx !== false) {
    tickersToSync.add("USDBRL=X");
  }

  try {
    const { syncMarketQuotesBatch } = await import("@/services/quotes");
    const result = await syncMarketQuotesBatch({
      tickers: [...tickersToSync],
      mode: "swr",
      reason: params.reason,
    });
    if (result.updated > 0 || result.quotes.length > 0) {
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assetPrices });
    }
  } catch {
    // Degradação silenciosa offline / rede indisponível
  }
}

