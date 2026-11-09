import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioTransaction,
  createPortfolioTransactionsBatch,
  deletePortfolioContributionsMatching,
  deletePortfolioDividendsMatching,
  deletePortfolioTransaction,
  listPortfolioTransactions,
  updatePortfolioAsset,
  updatePortfolioTransaction,
} from "@/data/repositories/portfolio";
import { calculateReconciledAssetPosition } from "@/domain/portfolio/operations";
import {
  getAssetPricingMode,
  isCashAssetClass,
} from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type {
  DbInsert,
  DbUpdate,
  PortfolioAsset,
  PortfolioTransaction,
} from "@/types";
import { PORTFOLIO_QUERY_KEYS } from "./portfolio-keys";

export function useCreatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioTransaction>, "user_id">) =>
      createPortfolioTransaction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar transação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioTransactionsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioTransaction>, "user_id">[]) =>
      createPortfolioTransactionsBatch(inputs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar lote de transações",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/**
 * Reconcilia a custódia do ativo (quantidade, preço médio e metadados de RF/Caixa)
 * após a remoção ou atualização de uma transação no ledger.
 */
export async function reconcileAssetCustody(
  assetId: string,
  removedTx: { type: string; quantity: number; price: number; total: number },
  queryClient: ReturnType<typeof useQueryClient>,
) {
  try {
    const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
    const asset = cachedAssets.find((a) => a.id === assetId);
    if (!asset) return;

    const remainingTxs = await listPortfolioTransactions(assetId);
    const pricingMode = getAssetPricingMode(asset);
    const isCash = isCashAssetClass(asset.asset_class);
    const isTotalValue = !isCash && pricingMode === "total_value";

    const reconciled = calculateReconciledAssetPosition({
      currentQuantity: asset.quantity,
      currentAveragePrice: asset.average_price,
      assetClass: asset.asset_class,
      currency: asset.currency,
      isCash,
      isTotalValue,
      fixedIncomeMetadata: asset.fixed_income_metadata,
      removedTransaction: removedTx,
      remainingTransactions: remainingTxs,
    });

    await updatePortfolioAsset(assetId, {
      quantity: reconciled.newQuantity,
      average_price: reconciled.newAveragePrice,
      ...(reconciled.updatedFixedIncomeMetadata !== undefined
        ? { fixed_income_metadata: reconciled.updatedFixedIncomeMetadata }
        : {}),
    });
  } catch {
    // Se a reconciliação assíncrona falhar, a operação principal no banco já foi concluída
  }
}

export function useUpdatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DbUpdate<PortfolioTransaction> }) => {
      const updated = await updatePortfolioTransaction(id, patch);
      if (updated?.asset_id) {
        await reconcileAssetCustody(
          updated.asset_id,
          { type: updated.type, quantity: updated.quantity, price: updated.price, total: updated.total },
          queryClient,
        );
      }
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamento atualizado",
        description: "A movimentação foi alterada com sucesso.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar lançamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export type DeletePortfolioTransactionInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      type?: string | null;
      date?: string | null;
      total?: number | null;
      quantity?: number | null;
      price?: number | null;
    };

export function useDeletePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioTransactionInput) => {
      const id = typeof input === "string" ? input : input.id;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let type = typeof input !== "string" ? input.type : undefined;
      let date = typeof input !== "string" ? input.date : undefined;
      let total = typeof input !== "string" ? input.total : undefined;
      let quantity = typeof input !== "string" ? input.quantity : undefined;
      let price = typeof input !== "string" ? input.price : undefined;

      // Se não foram passados todos os metadados, tenta localizá-los no cache
      const cachedAll = queryClient.getQueryData<PortfolioTransaction[]>(PORTFOLIO_QUERY_KEYS.allTransactions) ?? [];
      const match = cachedAll.find((t) => t.id === id);
      if (match) {
        assetId = assetId ?? match.asset_id;
        type = type ?? match.type;
        date = date ?? match.date;
        total = total ?? match.total;
        quantity = quantity ?? match.quantity;
        price = price ?? match.price;
      }

      const removedTx = {
        type: type ?? "buy",
        quantity: quantity ?? 1,
        price: price ?? (total ?? 0),
        total: total ?? 0,
      };

      // 1. Deleta a transação principal
      await deletePortfolioTransaction(id);

      // 2. Cascata em Proventos ou Aportes correspondentes
      if (assetId && date) {
        if (type === "dividend" || type === "jcp" || type === "fii_yield") {
          await deletePortfolioDividendsMatching({
            asset_id: assetId,
            date,
            amount: total !== null && total !== undefined ? total : undefined,
          });
        } else if (type === "buy") {
          await deletePortfolioContributionsMatching({
            asset_id: assetId,
            date,
          });
        }
      }

      // 3. Reconcilia o ativo debitando cotas, recalculando PM ou regredindo saldo
      if (assetId) {
        await reconcileAssetCustody(assetId, removedTx, queryClient);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamento excluído",
        description: "A operação e seus lançamentos vinculados foram removidos.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir lançamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}
