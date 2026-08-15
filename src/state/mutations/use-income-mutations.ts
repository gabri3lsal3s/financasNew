import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createIncome, deleteIncome, updateIncome } from "@/data/repositories/incomes";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";
import type { DbUpdate, Income } from "@/types";

/**
 * Mutations de renda. Rendas automáticas (source_ref, ex.: [REFUND]) são
 * somente-leitura (§3.1) — a exclusão nunca as alcança (guard no repository).
 */

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createIncome>[0], "user_id">) => createIncome(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIncome(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

/** Edição de uma renda (rendas automáticas com source_ref são somente-leitura). */
export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Income> }) => updateIncome(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}
