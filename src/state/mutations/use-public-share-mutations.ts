import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPublicShare,
  revokePublicShare,
  saveSplitExpenseToAccount,
  type CreatePublicShareInput,
  type SaveSplitExpenseInput,
} from "@/data/repositories/public-shares";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export const publicSharesQueryKey = ["public-shares"] as const;

export function useCreatePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePublicShareInput) => createPublicShare(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
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
      pushToast({ title: "Compartilhamento revogado.", variant: "default" });
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

