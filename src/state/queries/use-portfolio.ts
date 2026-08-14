import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  createPortfolioTransaction,
  listPortfolioAssets,
  listPortfolioTransactions,
} from "@/data/repositories/portfolio";
import { computeLedger, type LedgerTransaction } from "@/domain/portfolio";
import type { DbInsert, PortfolioAsset, PortfolioTransaction } from "@/types";

export const portfolioAssetsKey = ["portfolio_assets"] as const;
export const portfolioTransactionsKey = ["portfolio_transactions"] as const;

/** Ativos da carteira. */
export function usePortfolioAssets() {
  return useQuery({
    queryKey: portfolioAssetsKey,
    queryFn: () => listPortfolioAssets(),
    staleTime: 60_000,
  });
}

/** Transações de um ativo + posição derivada (ledger puro). */
export function useAssetPosition(assetId: string | null) {
  const transactions = useQuery({
    queryKey: [...portfolioTransactionsKey, assetId],
    queryFn: () => listPortfolioTransactions(assetId as string),
    enabled: assetId !== null,
    staleTime: 60_000,
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

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => createPortfolioAsset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioAssetsKey });
    },
  });
}

export function useCreatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioTransaction>, "user_id">) => createPortfolioTransaction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioTransactionsKey });
    },
  });
}
