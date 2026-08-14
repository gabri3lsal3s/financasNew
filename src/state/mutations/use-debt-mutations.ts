import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createDebt, deleteDebt, updateDebt } from "@/data/repositories/debts";
import { payDebt, receiveDebt, settleIntegratedReceivable } from "@/data/rpc";
import { debtsKey } from "@/state/queries/use-debts";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";
import type { DbUpdate, Debt } from "@/types";

/**
 * Mutations de dívidas. Quitação SEMPRE via RPC transacional (D1):
 * cria o lançamento (despesa/renda) na mesma transação da quitação.
 */

const FINANCE_KEYS = [debtsKey, incomesKey, expensesKey, ["overview"], ["insights"]] as const;

function invalidateFinance(queryClient: QueryClient) {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createDebt>[0]) => createDebt(input),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Debt> }) => updateDebt(id, input),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDebt(id),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Quitação de dívida a pagar — "Pagar e Cadastrar Despesa" | "Apenas Pagar". */
export function usePayDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      debtId,
      createExpense,
      expenseCategoryId,
    }: {
      debtId: string;
      createExpense: boolean;
      expenseCategoryId?: string | null;
    }) => payDebt(debtId, { createExpense, expenseCategoryId }),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Quitação de dívida a receber — "Receber e Criar Renda" | "Apenas Receber". */
export function useReceiveDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      debtId,
      createIncome,
      incomeCategoryId,
    }: {
      debtId: string;
      createIncome: boolean;
      incomeCategoryId?: string | null;
    }) => receiveDebt(debtId, { createIncome, incomeCategoryId }),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Recebimento integrado: reduz o valor da despesa no relatório (§3.4). */
export function useSettleIntegratedReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, result }: { debtId: string; result: number }) =>
      settleIntegratedReceivable(debtId, result),
    onSuccess: () => invalidateFinance(queryClient),
  });
}
