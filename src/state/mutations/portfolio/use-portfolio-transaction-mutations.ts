import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioTransaction,
  createPortfolioTransactionsBatch,
  listPortfolioTransactions,
  updatePortfolioAsset,
  updatePortfolioTransaction,
} from "@/data/repositories/portfolio";
import { deletePortfolioTransactionAtomic } from "@/data/rpc";
import { calculateReconciledAssetPosition } from "@/domain/portfolio/operations";
import {
  getAssetPricingMode,
  isCashAssetClass,
} from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { todayISO } from "@/lib/date";
import type {
  DbInsert,
  DbUpdate,
  FixedIncomeMetadata,
  PortfolioAsset,
  PortfolioTransaction,
} from "@/types";
import {
  PORTFOLIO_QUERY_KEYS,
  invalidatePortfolioSuite,
  triggerSurgicalQuoteSync,
} from "./portfolio-keys";

export function useCreatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioTransaction>, "user_id">) =>
      createPortfolioTransaction(input),
    onSuccess: (_data, input) => {
      void invalidatePortfolioSuite(queryClient);
      const txDate = (input.date ?? "").slice(0, 10);
      if (
        (input.type === "buy" || input.type === "sell" || input.type === "subscription") &&
        txDate >= todayISO()
      ) {
        const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
        const asset = cachedAssets.find((a) => a.id === input.asset_id);
        if (asset) {
          void triggerSurgicalQuoteSync(queryClient, {
            assets: [asset],
            reason: "post_trade_stale",
          });
        }
      }
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
      void invalidatePortfolioSuite(queryClient);
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
      void invalidatePortfolioSuite(queryClient);
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
      reverseCash?: boolean;
      usdRate?: number;
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
      const reverseCash = typeof input !== "string" ? Boolean(input.reverseCash) : false;
      const usdRate = typeof input !== "string" && input.usdRate ? input.usdRate : 5.25;

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
        date: date ?? undefined,
      };

      let newQuantity: number | null = null;
      let newAveragePrice: number | null = null;
      let fixedIncomeMetadata: FixedIncomeMetadata | null = null;

      if (assetId) {
        const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
        const asset = cachedAssets.find((a) => a.id === assetId);
        if (asset) {
          const allAssetTxs =
            cachedAll.length > 0
              ? cachedAll.filter((t) => t.asset_id === assetId)
              : await listPortfolioTransactions(assetId);
          const remainingTxs = allAssetTxs.filter((t) => t.id !== id);
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
          newQuantity = reconciled.newQuantity;
          newAveragePrice = reconciled.newAveragePrice;
          fixedIncomeMetadata = reconciled.updatedFixedIncomeMetadata ?? null;
        }
      }

      // Exclusão transacional atômica no banco (cascata em proventos/aportes + custódia + caixa opcional)
      await deletePortfolioTransactionAtomic({
        transactionId: id,
        reverseCash,
        usdRate,
        newQuantity,
        newAveragePrice,
        fixedIncomeMetadata,
      });
    },
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
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
