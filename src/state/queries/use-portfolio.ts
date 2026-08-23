import { useQuery } from "@tanstack/react-query";
import {
  listAllPortfolioTransactions,
  listPortfolioAssets,
  listPortfolioContributions,
  listPortfolioDividends,
  listPortfolioSnapshots,
  listPortfolioTransactions,
} from "@/data/repositories/portfolio";
import { computeLedger, type LedgerTransaction } from "@/domain/portfolio";
import { STALE_TIMES } from "@/state/cache-policy";
import { PORTFOLIO_QUERY_KEYS } from "@/state/mutations/use-portfolio-mutations";

export const portfolioAssetsKey = PORTFOLIO_QUERY_KEYS.assets;
export const portfolioTransactionsKey = PORTFOLIO_QUERY_KEYS.transactions;
export const allPortfolioTransactionsKey = PORTFOLIO_QUERY_KEYS.allTransactions;
export const portfolioSnapshotsKey = PORTFOLIO_QUERY_KEYS.snapshots;
export const portfolioContributionsKey = PORTFOLIO_QUERY_KEYS.contributions;
export const portfolioDividendsKey = PORTFOLIO_QUERY_KEYS.dividends;

/** Ativos da carteira. */
export function usePortfolioAssets() {
  return useQuery({
    queryKey: portfolioAssetsKey,
    queryFn: () => listPortfolioAssets(),
    staleTime: STALE_TIMES.analytical,
  });
}

/** Todas as transações da carteira (posição consolidada + calculadora). */
export function useAllPortfolioTransactions() {
  return useQuery({
    queryKey: allPortfolioTransactionsKey,
    queryFn: () => listAllPortfolioTransactions(),
    staleTime: STALE_TIMES.analytical,
  });
}

/** Transações de um ativo + posição derivada (ledger puro). */
export function useAssetPosition(assetId: string | null) {
  const transactions = useQuery({
    queryKey: [...portfolioTransactionsKey, assetId],
    queryFn: () => listPortfolioTransactions(assetId as string),
    enabled: assetId !== null,
    staleTime: STALE_TIMES.analytical,
  });

  const ledger = computeLedger(
    (transactions.data ?? []).map((t): LedgerTransaction => ({
      id: t.id,
      type: t.type,
      date: t.date,
      quantity: t.quantity,
      price: t.price,
      total: t.total,
    })),
  );

  return { ...transactions, ledger };
}

/** Snapshots Mensais. */
export function usePortfolioSnapshots() {
  return useQuery({
    queryKey: portfolioSnapshotsKey,
    queryFn: () => listPortfolioSnapshots(),
    staleTime: STALE_TIMES.analytical,
  });
}

/** Contribuições / Aportes Mensais. */
export function usePortfolioContributions() {
  return useQuery({
    queryKey: portfolioContributionsKey,
    queryFn: () => listPortfolioContributions(),
    staleTime: STALE_TIMES.analytical,
  });
}

/** Proventos Recebidos. */
export function usePortfolioDividends() {
  return useQuery({
    queryKey: portfolioDividendsKey,
    queryFn: () => listPortfolioDividends(),
    staleTime: STALE_TIMES.analytical,
  });
}

// Re-exports das mutações centralizadas para 100% de compatibilidade reversa
export {
  useCreatePortfolioAsset,
  useUpdatePortfolioAsset,
  useDeletePortfolioAsset,
  useCreatePortfolioTransaction,
  useCreatePortfolioTransactionsBatch,
  useUpdatePortfolioTransaction,
  useDeletePortfolioTransaction,
  useCreatePortfolioContribution,
  useDeletePortfolioContribution,
  useCreatePortfolioDividend,
  useDeletePortfolioDividend,
  useRecordOrder,
  useExecutePortfolioBatchAporte,
  PORTFOLIO_QUERY_KEYS,
} from "@/state/mutations/use-portfolio-mutations";

export { useUpsertPortfolioSnapshot, useUpsertPortfolioAssetsBatch } from "@/state/mutations/use-portfolio-snapshots-mutations";
