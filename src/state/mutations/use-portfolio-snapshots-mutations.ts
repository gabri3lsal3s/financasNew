import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  upsertPortfolioSnapshot,
  batchUpsertPortfolioSnapshots,
  upsertPortfolioAssetsBatch,
  deletePortfolioSnapshot,
} from "@/data/repositories/portfolio";
import { PORTFOLIO_QUERY_KEYS } from "./use-portfolio-mutations";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import type { DbInsert, PortfolioAsset, PortfolioSnapshotInput } from "@/types";

export function useUpsertPortfolioSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioSnapshotInput) =>
      upsertPortfolioSnapshot(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
    },
  });
}

export function useBatchUpsertPortfolioSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: PortfolioSnapshotInput[]) =>
      batchUpsertPortfolioSnapshots(inputs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
    },
  });
}

export function useUpsertPortfolioAssetsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Omit<DbInsert<PortfolioAsset>, "user_id">[]) =>
      upsertPortfolioAssetsBatch(inputs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assets });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.assetPrices });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
    },
  });
}

export function useDeletePortfolioSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => deletePortfolioSnapshot(month),
    onSuccess: (_, month) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
      pushToast({
        title: "Snapshot removido",
        description: `O registro histórico do mês ${month} foi removido com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir snapshot",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

