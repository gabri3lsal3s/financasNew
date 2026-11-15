import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createHistoricalContribution,
  createPortfolioContribution,
  createPortfolioContributionsBatch,
  deletePortfolioContribution,
  deletePortfolioTransactionsMatching,
  updatePortfolioContribution,
  upsertMarcoZero,
} from "@/data/repositories/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type {
  DbInsert,
  DbUpdate,
  PortfolioContribution,
  PortfolioTransaction,
} from "@/types";
import { PORTFOLIO_QUERY_KEYS, invalidatePortfolioSuite } from "./portfolio-keys";
import { reconcileAssetCustody } from "./use-portfolio-transaction-mutations";

export function useCreatePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DbInsert<PortfolioContribution>, "user_id">) =>
      createPortfolioContribution(input),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
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

/**
 * Upsert atômico do Marco Zero do Bolso.
 * Usa o RPC `upsert_marco_zero` para garantir unicidade no servidor:
 * remove todos os marcos zeros anteriores do usuário e insere o novo em uma única transação.
 */
export function useUpsertMarcoZero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { date: string; amount: number; notes?: string }) =>
      upsertMarcoZero(params),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao salvar Marco Zero",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/**
 * Registra um novo Marco Histórico do Bolso na linha do tempo de aportes.
 * Valida a operação e invalida as queries de aportes e snapshots para recálculo imediato da TIR.
 */
export function useCreateHistoricalContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { date: string; amount: number; notes?: string }) =>
      createHistoricalContribution(params),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Marco Histórico adicionado!",
        description: "A Linha do Tempo e a TIR da carteira foram atualizadas.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao adicionar marco histórico",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export type DeletePortfolioContributionInput =
  | string
  | {
      id: string;
      asset_id?: string | null;
      assetId?: string | null;
      date?: string | null;
      amount?: number | null;
      skipTransactionCascade?: boolean;
    };

export function useDeletePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePortfolioContributionInput) => {
      const id = typeof input === "string" ? input : input.id;
      const skipTransactionCascade = typeof input !== "string" ? Boolean(input.skipTransactionCascade) : false;
      let assetId = typeof input !== "string" ? (input.asset_id ?? input.assetId) : undefined;
      let date = typeof input !== "string" ? input.date : undefined;

      if (!skipTransactionCascade && (!assetId || !date)) {
        const cached = queryClient.getQueryData<PortfolioContribution[]>(PORTFOLIO_QUERY_KEYS.contributions) ?? [];
        const match = cached.find((c) => c.id === id);
        if (match) {
          assetId = assetId ?? match.asset_id;
          date = date ?? match.date;
        }
      }

      // 1. Deleta a contribuição de aporte
      await deletePortfolioContribution(id);

      // 2. Cascata em Transações de Ativos se vinculado e não suprimido explicitamente
      if (!skipTransactionCascade && assetId && date) {
        const cachedAll = queryClient.getQueryData<PortfolioTransaction[]>(PORTFOLIO_QUERY_KEYS.allTransactions) ?? [];
        const linkedTx = cachedAll.find(
          (t) => t.asset_id === assetId && t.date === date && t.type === "buy",
        );

        await deletePortfolioTransactionsMatching({
          asset_id: assetId,
          date,
          types: ["buy"],
        });

        if (linkedTx) {
          await reconcileAssetCustody(assetId, linkedTx, queryClient);
        }
      }
    },
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Aporte excluído",
        description: "O lançamento de aporte e a operação vinculada foram removidos.",
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

/**
 * Atualiza um aporte existente (data, valor ou notas).
 * Invalida os caches de contribuições e snapshots para recalcular imediatamente a TIR e métricas.
 */
export function useUpdatePortfolioContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; input: DbUpdate<PortfolioContribution> }) =>
      updatePortfolioContribution(params.id, params.input),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Marco Histórico atualizado!",
        description: "O valor foi calibrado e a TIR recalculada com sucesso.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar marco histórico",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

/**
 * Cria múltiplos marcos históricos em lote (ex.: gerados pelo Assistente de Extrato).
 */
export function useBatchCreateHistoricalContributions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioContribution>, "user_id">[]) =>
      createPortfolioContributionsBatch(inputs),
    onSuccess: (created) => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Marcos Históricos importados!",
        description: `${created.length} marco(s) gravado(s) com sucesso. A TIR foi recalculada.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao importar marcos históricos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}
