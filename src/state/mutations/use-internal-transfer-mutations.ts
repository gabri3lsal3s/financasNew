import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInternalTransferPair,
  deleteInternalTransferPair,
  type CreateInternalTransferPairParams,
  type CreateInternalTransferPairResult,
  type DeleteInternalTransferPairResult,
} from "@/data/rpc/business";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { cashCheckpointsKey } from "@/state/queries/use-cash-checkpoints";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export type {
  CreateInternalTransferPairParams,
  CreateInternalTransferPairResult,
  DeleteInternalTransferPairResult,
};

function invalidateInternalTransferEcosystem(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: expensesKey });
  void queryClient.invalidateQueries({ queryKey: incomesKey });
  void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
  void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  void queryClient.invalidateQueries({ queryKey: cashCheckpointsKey });
  void queryClient.invalidateQueries({ queryKey: ["overview"] });
  void queryClient.invalidateQueries({ queryKey: ["budgets"] });
  void queryClient.invalidateQueries({ queryKey: ["reports"] });
  void queryClient.invalidateQueries({ queryKey: ["insights"] });
}

export function useCreateInternalTransferPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateInternalTransferPairParams) => createInternalTransferPair(params),
    onSuccess: () => {
      invalidateInternalTransferEcosystem(queryClient);
      triggerSensory("success");
      pushToast({
        title: "Transferência Pessoal/Profissional registrada",
        description: "Ambas as pernas foram pareadas com segurança.",
        variant: "success",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível registrar a transferência",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useDeleteInternalTransferPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferPairId: string) => deleteInternalTransferPair(transferPairId),
    onSuccess: () => {
      invalidateInternalTransferEcosystem(queryClient);
      triggerSensory("success");
      pushToast({
        title: "Transferência pareada excluída",
        description: "A saída e a entrada vinculadas foram removidas juntas.",
        variant: "default",
      });
    },
    onError: (err) => {
      triggerSensory("error");
      pushToast({
        title: "Erro ao excluir transferência",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}
