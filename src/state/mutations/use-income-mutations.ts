import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createIncome, deleteIncome } from "@/data/repositories/incomes";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";

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
