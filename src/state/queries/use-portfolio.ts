import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  createPortfolioTransaction,
  createPortfolioTransactionsBatch,
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
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import type { DbInsert, DbUpdate, PortfolioAsset, PortfolioTransaction } from "@/types";
import { STALE_TIMES } from "@/state/cache-policy";

const portfolioAssetsKey = ["portfolio_assets"] as const;
const portfolioTransactionsKey = ["portfolio_transactions"] as const;
const allPortfolioTransactionsKey = [...portfolioTransactionsKey, "all"] as const;

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

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => {
      const created = await createPortfolioAsset(input);
      void import("@/services/quotes")
        .then(({ syncQuoteForTicker }) => syncQuoteForTicker(created.ticker, created.asset_class))
        .then((quote) => {
          if (quote) {
            void queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
          }
        })
        .catch(() => {
          // Degradação graciosa: segue com o fluxo sem travar
        });
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioAssetsKey });
      void queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
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

export function useCreatePortfolioTransactionsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioTransaction>, "user_id">[]) =>
      createPortfolioTransactionsBatch(inputs),
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
    onError: (error) => {
      pushToast({
        title: "Não foi possível excluir o ativo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
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
    onError: (error) => {
      pushToast({
        title: "Não foi possível excluir o lançamento",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Snapshots Mensais
// ---------------------------------------------------------------------------

export const portfolioSnapshotsKey = ["portfolio_snapshots"] as const;

export function usePortfolioSnapshots() {
  return useQuery({
    queryKey: portfolioSnapshotsKey,
    queryFn: () => import("@/data/repositories/portfolio").then((m) => m.listPortfolioSnapshots()),
    staleTime: STALE_TIMES.analytical,
  });
}

export function useUpsertPortfolioSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: string; total_value: number; total_cost: number }) =>
      import("@/data/repositories/portfolio").then((m) => m.upsertPortfolioSnapshot(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioSnapshotsKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Contribuições / Aportes Mensais
// ---------------------------------------------------------------------------

export const portfolioContributionsKey = ["portfolio_contributions"] as const;

export function usePortfolioContributions() {
  return useQuery({
    queryKey: portfolioContributionsKey,
    queryFn: () => import("@/data/repositories/portfolio").then((m) => m.listPortfolioContributions()),
    staleTime: STALE_TIMES.analytical,
  });
}

export function useCreatePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<import("@/types").PortfolioContribution>, "user_id">) =>
      import("@/data/repositories/portfolio").then((m) => m.createPortfolioContribution(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioContributionsKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useDeletePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      import("@/data/repositories/portfolio").then((m) => m.deletePortfolioContribution(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioContributionsKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Proventos Recebidos
// ---------------------------------------------------------------------------

export const portfolioDividendsKey = ["portfolio_dividends"] as const;

export function usePortfolioDividends() {
  return useQuery({
    queryKey: portfolioDividendsKey,
    queryFn: () => import("@/data/repositories/portfolio").then((m) => m.listPortfolioDividends()),
    staleTime: STALE_TIMES.analytical,
  });
}

export function useCreatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<import("@/types").PortfolioDividend>, "user_id">) =>
      import("@/data/repositories/portfolio").then((m) => m.createPortfolioDividend(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioDividendsKey });
    },
  });
}

export function useDeletePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      import("@/data/repositories/portfolio").then((m) => m.deletePortfolioDividend(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioDividendsKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Criação / Atualização em Lote de Ativos (Custódia)
// ---------------------------------------------------------------------------

export function useUpsertPortfolioAssetsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioAsset>, "user_id">[]) =>
      import("@/data/repositories/portfolio").then((m) => m.upsertPortfolioAssetsBatch(inputs)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioAssetsKey });
      void queryClient.invalidateQueries({ queryKey: ["asset_prices"] });
    },
  });
}
