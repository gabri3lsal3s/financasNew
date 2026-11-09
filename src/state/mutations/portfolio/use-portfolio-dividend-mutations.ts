import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveDividendsBatchRpc } from "@/data/rpc";
import {
  createPortfolioDividend,
  deletePortfolioDividend,
  deletePortfolioDividendsByIds,
  deletePortfolioTransactionsMatching,
  dismissCorporateDividend,
  removeDividendDismissal,
  updatePortfolioAsset,
  updatePortfolioDividend,
} from "@/data/repositories/portfolio";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { validateDividendReversalSafeguard } from "@/domain/portfolio/dividend-cash-governance";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type {
  ApproveDividendsBatchPayload,
  DbInsert,
  PortfolioAsset,
  PortfolioDividend,
  PortfolioDividendDismissalReason,
} from "@/types";
import { PORTFOLIO_QUERY_KEYS } from "./portfolio-keys";

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

export function useUpdatePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      patch: Partial<Omit<PortfolioDividend, "id" | "user_id" | "created_at">>;
      syncCash?: boolean;
      previousSyncCash?: boolean;
      previousCashAmount?: number;
    }) => {
      const { id, patch, syncCash, previousSyncCash, previousCashAmount = 0 } = params;
      const updated = await updatePortfolioDividend(id, patch);

      // Sincronização inteligente com Caixa
      if (syncCash !== undefined) {
        const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
        const cashAsset = cachedAssets.find(
          (a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class),
        );
        if (cashAsset) {
          const newAmount = patch.amount !== undefined ? patch.amount : (patch.cash_amount ?? 0);
          let delta = 0;
          if (syncCash && previousSyncCash) {
            delta = newAmount - previousCashAmount;
          } else if (syncCash && !previousSyncCash) {
            delta = newAmount;
          } else if (!syncCash && previousSyncCash) {
            delta = -previousCashAmount;
          }

          if (delta !== 0) {
            const newQty = Math.max(0, Math.round((cashAsset.quantity + delta) * 100) / 100);
            await updatePortfolioAsset(cashAsset.id, {
              quantity: newQty,
              average_price: 1,
            });
          }
        }
      }

      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "info",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export type DeletePortfolioDividendInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      date?: string | null;
      amount?: number | null;
      sync_cash?: boolean | null;
      cash_amount?: number | null;
      rollbackCash?: boolean;
    };

export function useDeletePortfolioDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioDividendInput) => {
      const id = typeof input === "string" ? input : input.id;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let date = typeof input !== "string" ? input.date : undefined;
      let amount = typeof input !== "string" ? input.amount : undefined;
      const rollbackCash = typeof input !== "string" ? Boolean(input.rollbackCash) : false;
      let cashAmount = typeof input !== "string" ? (input.cash_amount ?? amount) : undefined;

      const cached = queryClient.getQueryData<PortfolioDividend[]>(PORTFOLIO_QUERY_KEYS.dividends) ?? [];
      const match = cached.find((d) => d.id === id);
      if (match) {
        assetId = assetId ?? match.asset_id;
        date = date ?? match.date;
        amount = amount ?? match.amount;
        if (cashAmount === undefined) {
          cashAmount = match.cash_amount ?? match.amount;
        }
      }

      // 1. Deleta o provento
      await deletePortfolioDividend(id);

      // 2. Cascata em Transações de Ativos se vinculado
      if (assetId && date && amount !== undefined && amount !== null) {
        await deletePortfolioTransactionsMatching({
          asset_id: assetId,
          date,
          types: ["dividend", "jcp", "fii_yield"],
          total: amount,
        });
      }

      // 3. Estorno inteligente no saldo de Caixa se solicitado
      if (rollbackCash && cashAmount !== undefined && cashAmount !== null && cashAmount > 0) {
        const cachedAssets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
        const cashAsset = cachedAssets.find(
          (a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class),
        );
        if (cashAsset) {
          const newQty = Math.max(0, Math.round((cashAsset.quantity - cashAmount) * 100) / 100);
          await updatePortfolioAsset(cashAsset.id, {
            quantity: newQty,
            average_price: 1,
          });
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.transactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Provento excluído",
        description: "O rendimento e a operação vinculada foram removidos.",
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

/**
 * Hook para aprovação atômica em lote de proventos corporativos elegíveis
 * com suporte a estorno seguro (Undo) com salvaguarda de reinvestimento.
 */
export function useApproveDividendsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApproveDividendsBatchPayload) => {
      return approveDividendsBatchRpc(payload);
    },
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });

      triggerSensory("success");

      const count = result.inserted_count;
      const totalFormatted = result.total_cash.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      pushToast({
        title: count === 1 ? "Provento creditado com sucesso" : `${count} proventos creditados com sucesso`,
        description: variables.sync_cash
          ? `${totalFormatted} creditados no ativo Caixa da carteira.`
          : `${totalFormatted} registrados em proventos recebidos.`,
        variant: "success",
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              if (result.inserted_ids && result.inserted_ids.length > 0) {
                await deletePortfolioDividendsByIds(result.inserted_ids);
              }

              for (const div of variables.dividends) {
                if (div.corporate_dividend_id) {
                  await removeDividendDismissal(div.corporate_dividend_id).catch(() => undefined);
                }
              }

              if (variables.sync_cash && result.cash_asset_id && result.total_cash > 0) {
                const assets = queryClient.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets) ?? [];
                const cashAsset = assets.find((a) => a.id === result.cash_asset_id || a.ticker.toUpperCase() === "CAIXA");
                if (cashAsset) {
                  const reversal = validateDividendReversalSafeguard(cashAsset.quantity, result.total_cash);
                  await updatePortfolioAsset(cashAsset.id, {
                    quantity: reversal.newBalance,
                  });
                  if (!reversal.isSafe) {
                    pushToast({
                      title: "Atenção ao estorno de Caixa",
                      description: reversal.warningMessage,
                      variant: "warning",
                      duration: 6000,
                    });
                  }
                }
              }

              void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
              void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
              void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
              void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
              void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
              void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });

              triggerSensory("warning");
              pushToast({
                title: "Aprovação desfeita",
                description: "Os lançamentos foram removidos com sucesso.",
                variant: "default",
              });
            } catch (undoErr) {
              pushToast({
                title: "Erro ao desfazer",
                description: getErrorMessage(undoErr),
                variant: "destructive",
              });
            }
          },
        },
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao aprovar proventos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para ignorar / dispensar um provento corporativo sugerido.
 */
export function useDismissCorporateDividend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      corporateDividendId,
      reason = "manual_ignore",
    }: {
      corporateDividendId: string;
      reason?: PortfolioDividendDismissalReason;
    }) => {
      return dismissCorporateDividend(corporateDividendId, reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.corporateDividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividendDismissals });
      triggerSensory("action");
      pushToast({
        title: "Provento ignorado",
        description: "O provento não será mais sugerido na carteira.",
        variant: "default",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao ignorar provento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}
