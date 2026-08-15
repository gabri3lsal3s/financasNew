import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  createPortfolioTransaction,
  deletePortfolioAsset,
  deletePortfolioTransaction,
  listAllPortfolioTransactions,
  listPortfolioAssets,
  listPortfolioTransactions,
  updatePortfolioAsset,
  updatePortfolioTransaction,
} from "@/data/repositories/portfolio";
import { computeLedger, type LedgerTransaction } from "@/domain/portfolio";
import { allocationTargetsKey } from "./use-allocation";
import type { DbInsert, DbUpdate, PortfolioAsset, PortfolioTransaction } from "@/types";

export const portfolioAssetsKey = ["portfolio_assets"] as const;
export const portfolioTransactionsKey = ["portfolio_transactions"] as const;
export const allPortfolioTransactionsKey = [...portfolioTransactionsKey, "all"] as const;

/** Ativos da carteira. */
export function usePortfolioAssets() {
  return useQuery({
    queryKey: portfolioAssetsKey,
    queryFn: () => listPortfolioAssets(),
    staleTime: 60_000,
  });
}

/** Todas as transações da carteira (posição consolidada + calculadora). */
export function useAllPortfolioTransactions() {
  return useQuery({
    queryKey: allPortfolioTransactionsKey,
    queryFn: () => listAllPortfolioTransactions(),
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
      void queryClient.invalidateQueries({ queryKey: allPortfolioTransactionsKey });
    },
  });
}

export function useUpdatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioAsset> }) => updatePortfolioAsset(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioAssetsKey });
    },
  });
}

export function useDeletePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePortfolioAsset(id),
    onSuccess: () => {
      // A exclusão remove transações e metas em cascata (banco) — invalida tudo
      // que deriva da posição para o ledger ser recalculado.
      void queryClient.invalidateQueries({ queryKey: portfolioAssetsKey });
      void queryClient.invalidateQueries({ queryKey: portfolioTransactionsKey });
      void queryClient.invalidateQueries({ queryKey: allPortfolioTransactionsKey });
      void queryClient.invalidateQueries({ queryKey: allocationTargetsKey });
    },
  });
}

export function useUpdatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioTransaction> }) => updatePortfolioTransaction(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioTransactionsKey });
      void queryClient.invalidateQueries({ queryKey: allPortfolioTransactionsKey });
    },
  });
}

export function useDeletePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePortfolioTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioTransactionsKey });
      void queryClient.invalidateQueries({ queryKey: allPortfolioTransactionsKey });
    },
  });
}
