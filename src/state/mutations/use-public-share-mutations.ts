import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPublicShare,
  regeneratePublicShare,
  revokePublicShare,
  saveSplitExpenseToAccount,
  saveSimulationToAccount,
  type CreatePublicShareInput,
  type SaveSplitExpenseInput,
} from "@/data/repositories/public-shares";
import type { PendingSimulation } from "@/domain/share";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export const publicSharesQueryKey = ["public-shares"] as const;
export const myPublicSharesMutationKey = ["my-public-shares"] as const;

export function useCreatePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePublicShareInput) => createPublicShare(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export function useRevokePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokePublicShare(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
      pushToast({ title: "Compartilhamento revogado.", variant: "default" });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export function useRegeneratePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldId, input }: { oldId: string; input: CreatePublicShareInput }) =>
      regeneratePublicShare(oldId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
      pushToast({ title: "Link regenerado com sucesso!", variant: "success" });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export function useSaveSplitExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveSplitExpenseInput) => saveSplitExpenseToAccount(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      pushToast({
        title: "Despesa salva com sucesso!",
        description: "Lançamento registrado e integrado ao seu extrato e painel financeiro.",
        variant: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível salvar a despesa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useSaveSimulationToAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (simulation: PendingSimulation) => saveSimulationToAccount(simulation),
    onSuccess: (_, variables) => {
      if (variables.type === "debt_simulator") {
        void queryClient.invalidateQueries({ queryKey: ["debts"] });
      } else if (variables.type === "rebalance_simulator") {
        void queryClient.invalidateQueries({ queryKey: ["class_targets"] });
        void queryClient.invalidateQueries({ queryKey: ["allocation_targets"] });
        void queryClient.invalidateQueries({ queryKey: ["investments"] });
      } else if (variables.type === "compound_interest") {
        void queryClient.invalidateQueries({ queryKey: ["income_goals"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      pushToast({
        title: "Simulação salva com sucesso!",
        description: "Os parâmetros da simulação foram vinculados à sua conta.",
        variant: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível salvar a simulação",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}


