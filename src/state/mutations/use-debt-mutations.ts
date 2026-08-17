import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createDebt, deleteDebt, updateDebt } from "@/data/repositories/debts";
import { payDebt, receiveDebt, settleIntegratedReceivable } from "@/data/rpc";
import { debtsKey } from "@/state/queries/use-debts";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
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
    // Falha de rede/banco na exclusão: feedback explícito (antes a promise
    // rejeitada ficava sem tratamento e o usuário não via nada).
    onError: (error) => {
      pushToast({
        title: "Não foi possível excluir a dívida",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
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
      fineAmount,
      interestAmount,
      discountAmount,
      totalPaid,
    }: {
      debtId: string;
      createExpense: boolean;
      expenseCategoryId?: string | null;
      fineAmount?: number;
      interestAmount?: number;
      discountAmount?: number;
      totalPaid?: number | null;
    }) =>
      payDebt(debtId, {
        createExpense,
        expenseCategoryId,
        fineAmount,
        interestAmount,
        discountAmount,
        totalPaid,
      }),
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
