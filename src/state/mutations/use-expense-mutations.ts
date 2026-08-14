import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateExpense } from "@/data/repositories/expenses";
import { createExpenseWithDebt, deleteExpenseInstallments } from "@/data/rpc";
import type { CreateExpenseWithDebtParams } from "@/data/rpc";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import type { DbUpdate, Expense, InstallmentDeleteMode } from "@/types";

/**
 * Mutations de despesa (Online First — mutações SEM retry automático;
 * o QueryClient já define retry: false). Invalidação dirigida por chave
 * estável (docs/ARCHITECTURE.md §5).
 */

const FINANCE_KEYS = [
  expensesKey,
  incomesKey,
  ["debts"],
  ["insights"],
  ["overview"],
] as const satisfies readonly (readonly string[])[];

/** Cria despesa (+ parcelas + cobrança vinculada) numa única transação (D1). */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateExpenseWithDebtParams) => createExpenseWithDebt(params),
    onSuccess: () => {
      for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Exclusão de parcela(s) com modo single/all/subsequent + cascata (RPC). */
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, mode }: { expenseId: string; mode: InstallmentDeleteMode }) =>
      deleteExpenseInstallments(expenseId, mode),
    onSuccess: () => {
      for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Edição de uma despesa (sem troca de grupo de parcelas neste fluxo). */
export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Expense> }) => updateExpense(id, input),
    onSuccess: () => {
      for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
