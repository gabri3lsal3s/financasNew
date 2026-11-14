import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  upsertPortfolioSnapshot,
  batchUpsertPortfolioSnapshots,
  upsertPortfolioAssetsBatch,
  deletePortfolioSnapshot,
  calibratePortfolioSnapshot,
  resetManualSnapshotCalibration,
} from "@/data/repositories/portfolio";
import { PORTFOLIO_QUERY_KEYS } from "./use-portfolio-mutations";
import { PORTFOLIO_MONTHLY_PRICES_QUERY_KEY } from "@/state/queries/use-portfolio-monthly-prices";
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
      void queryClient.invalidateQueries({ queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, month] });
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

export function useCalibratePortfolioSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { month: string; total_value: number; total_cost: number }) =>
      calibratePortfolioSnapshot(params.month, params.total_value, params.total_cost),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
      void queryClient.invalidateQueries({
        queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, variables.month],
      });
      pushToast({
        title: "Snapshot calibrado",
        description: `O valor do mês ${variables.month} foi calibrado manualmente com sucesso. O valor original do fechamento foi preservado.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao calibrar snapshot",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useResetManualSnapshotCalibration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => resetManualSnapshotCalibration(month),
    onSuccess: (result, month) => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEYS.snapshots });
      void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
      void queryClient.invalidateQueries({
        queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, month],
      });
      if (result.action === "restored_to_auto") {
        pushToast({
          title: "Valor do fechamento restaurado",
          description: `A calibração manual de ${month} foi desfeita e o snapshot retornou ao valor original gravado no fechamento.`,
          variant: "success",
        });
      } else {
        pushToast({
          title: "Snapshot removido",
          description: `O snapshot manual de ${month} foi removido com sucesso.`,
          variant: "success",
        });
      }
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao restaurar snapshot",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

