import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPublicShare,
  regeneratePublicShare,
  deletePublicShare,
  revokePublicShare,
  restorePublicShare,
  updatePublicSharePayload,
  saveSplitExpenseToAccount,
  saveSimulationToAccount,
  type CreatePublicShareInput,
  type SaveSplitExpenseInput,
} from "@/data/repositories/public-shares";
import { signalSplitPayment, dismissSplitPaymentSignal, allocateGoalDeposit } from "@/data/rpc";
import type { PendingSimulation } from "@/domain/share";
import type { PublicShare } from "@/types";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export const publicShareQueryKey = ["public-share"] as const;
export const publicSharesQueryKey = ["public-shares"] as const;
export const myPublicSharesMutationKey = ["my-public-shares"] as const;

export function useCreatePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePublicShareInput) => createPublicShare(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export function useUpdatePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      isRevoked,
    }: {
      id: string;
      payload: Record<string, unknown>;
      isRevoked?: boolean;
    }) => updatePublicSharePayload(id, payload, isRevoked !== undefined ? { isRevoked } : undefined),
    onMutate: async ({ id, payload, isRevoked }) => {
      await queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey });
      const previous = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });

      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.map((share) =>
            share.id === id
              ? {
                  ...share,
                  payload: { ...share.payload, ...payload },
                  ...(isRevoked !== undefined ? { is_revoked: isRevoked } : {}),
                }
              : share,
          );
        },
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
  });
}

export function useRevokePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokePublicShare(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey });
      const previous = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });

      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.map((share) =>
            share.id === id ? { ...share, is_revoked: true } : share,
          );
        },
      );

      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
  });
}

export function useRestorePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restorePublicShare(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey });
      const previous = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });

      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.map((share) =>
            share.id === id ? { ...share, is_revoked: false } : share,
          );
        },
      );

      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
  });
}

function useDeletePublicShareBase(silentError = false) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePublicShare(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey });
      const previous = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });

      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.filter((share) => share.id !== id);
        },
      );

      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      if (!silentError) {
        pushToast({ title: getErrorMessage(error), variant: "destructive" });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
  });
}

export function useDeletePublicShare() {
  return useDeletePublicShareBase(false);
}

export function useDeletePublicShareMutation(options?: { silentError?: boolean }) {
  return useDeletePublicShareBase(Boolean(options?.silentError));
}

export function useRegeneratePublicShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldId, input }: { oldId: string; input: CreatePublicShareInput }) =>
      regeneratePublicShare(oldId, input),
    onMutate: async ({ oldId, input }) => {
      await queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey });
      const previous = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });

      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.map((share) => {
            if (share.id === oldId) {
              return {
                ...share,
                token: input.token || `${share.token}_regenerating`,
                is_revoked: false,
                payload: input.payload ?? share.payload,
                updated_at: new Date().toISOString(),
              };
            }
            return share;
          });
        },
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
    onSuccess: (data) => {
      queryClient.setQueriesData<PublicShare[]>(
        { queryKey: myPublicSharesMutationKey },
        (old) => {
          if (!old) return old;
          return old.map((share) => (share.id === data.id ? data : share));
        },
      );
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
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
        void queryClient.invalidateQueries({ queryKey: ["group_targets"] });
        void queryClient.invalidateQueries({ queryKey: ["portfolio_assets"] });
        void queryClient.invalidateQueries({ queryKey: ["portfolio_position"] });
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

export function useSignalSplitPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      token: string;
      participantName: string;
      amountCents: number;
      participantId?: string | null;
      installmentId?: string | null;
      installmentIds?: string[] | null;
    }) => signalSplitPayment(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
    },
  });
}

export function useDismissSplitPaymentSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { shareId: string; signalId: string }) =>
      dismissSplitPaymentSignal(params),
    onMutate: async ({ shareId, signalId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: myPublicSharesMutationKey }),
        queryClient.cancelQueries({ queryKey: publicSharesQueryKey }),
      ]);
      const previousMy = queryClient.getQueriesData<PublicShare[]>({
        queryKey: myPublicSharesMutationKey,
      });
      const previousPublic = queryClient.getQueriesData<PublicShare[]>({
        queryKey: publicSharesQueryKey,
      });

      const applyDismiss = (old: PublicShare[] | undefined) => {
        if (!Array.isArray(old)) return old;
        return old.map((share) => {
          if (share.id !== shareId) return share;
          const payload = (share.payload ?? {}) as Record<string, unknown>;
          const rawSignals = Array.isArray(payload.payment_signals)
            ? (payload.payment_signals as Array<Record<string, unknown>>)
            : [];
          const targetSignal = rawSignals.find((s) => s.id === signalId);
          const nextSignals = rawSignals.map((s) =>
            s.id === signalId ? { ...s, status: "dismissed" } : s,
          );
          const participantId =
            typeof targetSignal?.participant_id === "string"
              ? targetSignal.participant_id
              : null;
          const hasOtherPending = participantId
            ? nextSignals.some(
                (s) => s.status === "pending" && s.participant_id === participantId,
              )
            : false;
          const rawParticipants = Array.isArray(payload.participants)
            ? (payload.participants as Array<Record<string, unknown>>)
            : [];
          const nextParticipants = participantId
            ? rawParticipants.map((p) =>
                p.id === participantId ? { ...p, has_payment_signal: hasOtherPending } : p,
              )
            : rawParticipants;

          return {
            ...share,
            payload: {
              ...payload,
              payment_signals: nextSignals,
              ...(rawParticipants.length > 0 ? { participants: nextParticipants } : {}),
            },
          };
        });
      };

      queryClient.setQueriesData<PublicShare[]>({ queryKey: myPublicSharesMutationKey }, applyDismiss);
      queryClient.setQueriesData<PublicShare[]>({ queryKey: publicSharesQueryKey }, applyDismiss);

      return { previousMy, previousPublic };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
      pushToast({
        title: "Aviso de pagamento dispensado",
        description: "A cota do amigo permanece pendente de recebimento.",
        variant: "default",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMy) {
        for (const [key, data] of context.previousMy) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousPublic) {
        for (const [key, data] of context.previousPublic) {
          queryClient.setQueryData(key, data);
        }
      }
      pushToast({
        title: "Não foi possível dispensar o aviso",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para aporte direto em metas financeiras com feedback de conclusão.
 */
export function useAllocateGoalDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      shareId: string;
      amountCents: number;
      contributorName?: string;
      sourceAccountId?: string;
      notes?: string;
    }) => allocateGoalDeposit(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: publicShareQueryKey });
      void queryClient.invalidateQueries({ queryKey: publicSharesQueryKey });
      void queryClient.invalidateQueries({ queryKey: myPublicSharesMutationKey });
      pushToast({
        title: data.is_completed ? "Parabéns! Meta conquistada!" : "Aporte registrado com sucesso!",
        description: data.is_completed
          ? "Você atingiu 100% do objetivo financeiro."
          : "O saldo da meta foi atualizado.",
        variant: "default",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível registrar o aporte",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}


