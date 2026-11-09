import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  deletePortfolioAsset,
  updatePortfolioAsset,
} from "@/data/repositories/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { DbInsert, DbUpdate, PortfolioAsset } from "@/types";
import { PORTFOLIO_QUERY_KEYS } from "./portfolio-keys";

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => {
      const created = await createPortfolioAsset(input);
      void import("@/services/quotes")
        .then(({ syncQuoteForTicker }) => syncQuoteForTicker(created.ticker, created.asset_class))
        .catch(() => undefined);
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["family"] });
      pushToast({
        title: "Ativo criado",
        description: "O novo ativo foi adicionado à sua carteira.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao criar ativo",
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
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioAsset> }) =>
      updatePortfolioAsset(id, patch),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["family"] });
      if (updated?.ticker) {
        void import("@/services/quotes")
          .then(({ syncQuoteForTicker }) => syncQuoteForTicker(updated.ticker, updated.asset_class))
          .catch(() => undefined);
      }
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
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.allTransactions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.dividends });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.contributions });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      pushToast({
        title: "Ativo excluído",
        description: "O ativo e todo o seu histórico foram removidos da carteira.",
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
