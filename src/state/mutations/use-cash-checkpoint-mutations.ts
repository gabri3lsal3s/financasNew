import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCashCheckpoint,
  deleteCashCheckpoint,
  type CreateCashCheckpointInput,
} from "@/data/repositories/cash-checkpoints";
import { cashCheckpointsKey } from "@/state/queries/use-cash-checkpoints";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export function useCreateCashCheckpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCashCheckpointInput) => createCashCheckpoint(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cashCheckpointsKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      pushToast({ title: "Saldo calibrado com sucesso!", variant: "success" });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export function useDeleteCashCheckpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCashCheckpoint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cashCheckpointsKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      pushToast({ title: "Checkpoint removido.", variant: "default" });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}
