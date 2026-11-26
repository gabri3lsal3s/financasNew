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
import { useDemoSession } from "@/state/demo-mode";
import {
  useSimulatedAllPortfolioTransactions,
  useSimulatedPortfolioAssets,
  useSimulatedPortfolioContributions,
  useSimulatedPortfolioDividends,
  useSimulatedPortfolioSnapshots,
} from "./use-simulated-queries";

export const portfolioAssetsKey = PORTFOLIO_QUERY_KEYS.assets;
export const portfolioTransactionsKey = PORTFOLIO_QUERY_KEYS.transactions;
export const allPortfolioTransactionsKey = PORTFOLIO_QUERY_KEYS.allTransactions;
export const portfolioSnapshotsKey = PORTFOLIO_QUERY_KEYS.snapshots;
export const portfolioContributionsKey = PORTFOLIO_QUERY_KEYS.contributions;
export const portfolioDividendsKey = PORTFOLIO_QUERY_KEYS.dividends;

/** Ativos da carteira. */
export function usePortfolioAssets(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedPortfolioAssets();
  const real = useQuery({
    queryKey: portfolioAssetsKey,
    queryFn: () => listPortfolioAssets(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Todas as transações da carteira (posição consolidada + calculadora). */
export function useAllPortfolioTransactions(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllPortfolioTransactions();
  const real = useQuery({
    queryKey: allPortfolioTransactionsKey,
    queryFn: () => listAllPortfolioTransactions(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
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
export function usePortfolioSnapshots(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedPortfolioSnapshots();
  const real = useQuery({
    queryKey: portfolioSnapshotsKey,
    queryFn: () => listPortfolioSnapshots(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Contribuições / Aportes Mensais. */
export function usePortfolioContributions(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedPortfolioContributions();
  const real = useQuery({
    queryKey: portfolioContributionsKey,
    queryFn: () => listPortfolioContributions(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Proventos Recebidos. */
export function usePortfolioDividends(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedPortfolioDividends();
  const real = useQuery({
    queryKey: portfolioDividendsKey,
    queryFn: () => listPortfolioDividends(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
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
  useUpsertMarcoZero,
  useCreateHistoricalContribution,
  useUpdatePortfolioContribution,
  useBatchCreateHistoricalContributions,
  useCreatePortfolioDividend,
  useUpdatePortfolioDividend,
  useDeletePortfolioDividend,
  useRecordOrder,
  useExecutePortfolioBatchAporte,
  useRevertPortfolioBatchAporte,
  LAST_BATCH_APORTE_STORAGE_KEY,
  useApproveDividendsBatch,
  useDismissCorporateDividend,
  useConfirmUserDividendEvents,
  useCreateManualUserDividendEvent,
  useUpdateUserDividendEvent,
  useDismissUserDividendEvent,
  useDeleteUserDividendEvent,
  reconcileAssetCustody,
  PORTFOLIO_QUERY_KEYS,
  invalidatePortfolioSuite,
} from "@/state/mutations/use-portfolio-mutations";

export {
  useUpsertPortfolioSnapshot,
  useBatchUpsertPortfolioSnapshots,
  useUpsertPortfolioAssetsBatch,
  useDeletePortfolioSnapshot,
  useCalibratePortfolioSnapshot,
  useResetManualSnapshotCalibration,
} from "@/state/mutations/use-portfolio-snapshots-mutations";

