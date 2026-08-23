import { useMutation, useQueryClient } from "@tanstack/react-query";
import { executePortfolioBatchAporte, type ExecutePortfolioBatchAporteParams } from "@/data/rpc";
import {
  createPortfolioAsset,
  createPortfolioContribution,
  createPortfolioDividend,
  createPortfolioTransaction,
  createPortfolioTransactionsBatch,
  deletePortfolioAsset,
  deletePortfolioContribution,
  deletePortfolioDividend,
  deletePortfolioTransaction,
  updatePortfolioAsset,
  updatePortfolioTransaction,
} from "@/data/repositories/portfolio";
import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { sellAssetPosition } from "@/domain/portfolio/operations";
import {
  getAssetPricingMode,
  isCashAssetClass,
} from "@/domain/portfolio/valuation";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { DbInsert, DbUpdate, PortfolioAsset, PortfolioContribution, PortfolioDividend, PortfolioTransaction } from "@/types";

export const PORTFOLIO_QUERY_KEYS = {
  assets: ["portfolio_assets"] as const,
  transactions: ["portfolio_transactions"] as const,
  allTransactions: ["portfolio_transactions", "all"] as const,
  contributions: ["portfolio_contributions"] as const,
  dividends: ["portfolio_dividends"] as const,
  snapshots: ["portfolio_snapshots"] as const,
  allocationTargets: ["allocation_targets"] as const,
  assetPrices: ["asset_prices"] as const,
};

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => {
      const created = await createPortfolioAsset(input);
      void import("@/services/quotes")
        .then(({ syncQuoteForTicker }) => syncQuoteForTicker(created.ticker, created.asset_class))
        .then((quote) => {
          if (quote) {
            void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assetPrices });
          }
        })
        .catch(() => {
          // Degradação graciosa: segue sem travar
        });
      return created;
    },
    onSuccess: (asset) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo cadastrado",
        description: `${asset.ticker} foi adicionado à carteira.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao cadastrar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useUpdatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; patch: DbUpdate<PortfolioAsset> }) =>
      updatePortfolioAsset(params.id, params.patch),
    onSuccess: (asset) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo atualizado",
        description: `${asset.ticker} foi atualizado com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useDeletePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deletePortfolioAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allocationTargets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo excluído",
        description: "O ativo e suas posições foram removidos.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioTransaction>, "user_id">) =>
      createPortfolioTransaction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamento registrado",
        description: "A operação foi salva com sucesso.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar lançamento",
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
    mutationFn: (rows: Omit<DbInsert<PortfolioTransaction>, "user_id">[]) =>
      createPortfolioTransactionsBatch(rows),
    onSuccess: (inserted) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Lançamentos importados",
        description: `${inserted.length} operação(ões) registrada(s) com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro na importação em lote",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useUpdatePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; patch: DbUpdate<PortfolioTransaction> }) =>
      updatePortfolioTransaction(params.id, params.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      pushToast({
        title: "Lançamento atualizado",
        description: "A operação foi atualizada.",
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

export function useDeletePortfolioTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => deletePortfolioTransaction(transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      pushToast({
        title: "Lançamento excluído",
        description: "A operação foi removida do extrato.",
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

export function useCreatePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioContribution>, "user_id">) =>
      createPortfolioContribution(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aporte financeiro registrado",
        description: "O valor foi contabilizado nos aportes do mês.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar aporte",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useDeletePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contributionId: string) => deletePortfolioContribution(contributionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aporte excluído",
        description: "O lançamento de aporte foi removido.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir aporte",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useCreatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioDividend>, "user_id">) =>
      createPortfolioDividend(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento registrado",
        description: "O rendimento foi salvo no extrato de proventos.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useDeletePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dividendId: string) => deletePortfolioDividend(dividendId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento excluído",
        description: "O rendimento foi removido do extrato.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/** Payload para a mutação de ordem rápida com sincronização de posição. */
export interface RecordOrderParams {
  asset: PortfolioAsset;
  type: "buy" | "sell" | "dividend" | "jcp" | "fii_yield" | "split" | "reverse_split" | "subscription";
  date: string;
  quantity: number;
  price: number;
  total: number;
  syncCash?: boolean;
  cashAsset?: PortfolioAsset | null;
  recordContribution?: boolean;
  notes?: string | null;
  usdRate?: number;
}

/**
 * Hook de Ordem Rápida:
 * Registra a transação histórica no ledger, atualiza a quantidade e preço médio do ativo
 * e opcionalmente debita do caixa / registra o aporte financeiro do mês em um fluxo único e consistente.
 */
export function useRecordOrder() {
  const queryClient = useQueryClient();
  const createTx = useCreatePortfolioTransaction();
  const updateAsset = useUpdatePortfolioAsset();
  const createContrib = useCreatePortfolioContribution();
  const createDiv = useCreatePortfolioDividend();

  return useMutation({
    mutationFn: async (params: RecordOrderParams) => {
      const { asset, type, date, quantity, price, total, syncCash, cashAsset, recordContribution, notes, usdRate } = params;
      const rate = asset.currency === "USD" ? (usdRate ?? 5.25) : 1;
      const totalBRL = Math.round(total * rate * 100) / 100;

      // 1. Grava no ledger de transações (na moeda nativa do ativo)
      await createTx.mutateAsync({
        asset_id: asset.id,
        type,
        date,
        quantity,
        price,
        total,
      });

      // 2. Se for Compra ou Subscrição: atualiza o Preço Médio ponderado e quantidade
      if (type === "buy" || type === "subscription") {
        const isCash = isCashAssetClass(asset.asset_class);
        const pricingMode = getAssetPricingMode(asset);
        const isTotalValue = !isCash && pricingMode === "total_value";

        if (isCash) {
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: asset.quantity + (total > 0 ? total : quantity),
              average_price: 1,
            },
          });
        } else if (isTotalValue) {
          const currentCost =
            asset.quantity > 1 && asset.average_price > 0
              ? Math.round(asset.quantity * asset.average_price * 100) / 100
              : asset.average_price > 0
                ? asset.average_price
                : asset.quantity;
          const orderAmount = total > 0 ? total : price;
          const newTotalApplied = Math.round((currentCost + orderAmount) * 100) / 100;
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: 1,
              average_price: newTotalApplied,
            },
          });
        } else {
          const lotCalc = calculateWeightedAveragePrice(
            asset.quantity,
            asset.average_price,
            quantity,
            price > 0 ? price : total / (quantity || 1),
          );
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: lotCalc.newQuantity,
              average_price: lotCalc.newAveragePrice,
            },
          });
        }

        // Debita do caixa em BRL se solicitado e disponível
        if (syncCash && cashAsset && totalBRL > 0) {
          const cashDebit = Math.min(cashAsset.quantity, totalBRL);
          if (cashDebit > 0) {
            await updateAsset.mutateAsync({
              id: cashAsset.id,
              patch: {
                quantity: Math.max(0, cashAsset.quantity - cashDebit),
                average_price: 1,
              },
            });
          }
        }

        // Registra aporte financeiro no mês em BRL se solicitado
        if (recordContribution && totalBRL > 0) {
          await createContrib.mutateAsync({
            amount: totalBRL,
            date,
            asset_id: asset.id,
            notes: notes ?? (asset.currency === "USD" ? `Aporte em ${asset.ticker} ($${total.toFixed(2)})` : `Aporte em ${asset.ticker}`),
          });
        }
      }

      // 3. Se for Venda: reduz a quantidade mantendo o PM e opcionalmente credita Caixa em BRL
      if (type === "sell") {
        const isCash = isCashAssetClass(asset.asset_class);
        const pricingMode = getAssetPricingMode(asset);
        const isTotalValue = !isCash && pricingMode === "total_value";

        if (isCash) {
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: Math.max(0, asset.quantity - (total > 0 ? total : quantity)),
              average_price: 1,
            },
          });
        } else if (isTotalValue) {
          const currentCost =
            asset.quantity > 1 && asset.average_price > 0
              ? Math.round(asset.quantity * asset.average_price * 100) / 100
              : asset.average_price > 0
                ? asset.average_price
                : asset.quantity;
          const orderAmount = total > 0 ? total : price;
          const newTotalApplied = Math.round(Math.max(0, currentCost - orderAmount) * 100) / 100;
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: newTotalApplied > 0 ? 1 : 0,
              average_price: newTotalApplied,
            },
          });
        } else {
          const sellResult = sellAssetPosition({
            currentQuantity: asset.quantity,
            currentAveragePrice: asset.average_price,
            sellQuantity: quantity,
            sellPrice: price > 0 ? price : total / (quantity || 1),
          });
          await updateAsset.mutateAsync({
            id: asset.id,
            patch: {
              quantity: sellResult.remainingQuantity,
              average_price: sellResult.remainingAveragePrice,
            },
          });
        }

        // Credita no caixa em BRL se solicitado
        if (syncCash && cashAsset && totalBRL > 0) {
          await updateAsset.mutateAsync({
            id: cashAsset.id,
            patch: {
              quantity: cashAsset.quantity + totalBRL,
              average_price: 1,
            },
          });
        }
      }

      // 4. Se for Provento (dividendo, jcp, fii_yield)
      if (type === "dividend" || type === "jcp" || type === "fii_yield") {
        await createDiv.mutateAsync({
          amount: total,
          date,
          asset_id: asset.id,
          ticker: asset.ticker,
          notes: notes ?? `Rendimento de ${asset.ticker}`,
        });

        // Credita no caixa em BRL se solicitado
        if (syncCash && cashAsset && totalBRL > 0) {
          await updateAsset.mutateAsync({
            id: cashAsset.id,
            patch: {
              quantity: cashAsset.quantity + totalBRL,
              average_price: 1,
            },
          });
        }
      }

      // 5. Se for Desdobramento / Grupamento (Split / Reverse Split)
      if (type === "split" && quantity > 0) {
        await updateAsset.mutateAsync({
          id: asset.id,
          patch: {
            quantity: asset.quantity * quantity,
            average_price: asset.average_price / quantity,
          },
        });
      } else if (type === "reverse_split" && quantity > 0) {
        await updateAsset.mutateAsync({
          id: asset.id,
          patch: {
            quantity: Math.floor(asset.quantity / quantity),
            average_price: asset.average_price * quantity,
          },
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ordem executada",
        description: "A movimentação foi concluída e a posição atualizada.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao executar ordem",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/**
 * Executa o aporte inteligente em lote via RPC transacional (§F36).
 * Atualiza posições, lança as compras em portfolio_transactions e registra a contribuição.
 */
export function useExecutePortfolioBatchAporte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ExecutePortfolioBatchAporteParams) => executePortfolioBatchAporte(params),
    onSuccess: (_, params) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Aportes aplicados à carteira",
        description: `Posições de ${params.items.length} ativos atualizadas e compras lançadas com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao aplicar aportes",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

