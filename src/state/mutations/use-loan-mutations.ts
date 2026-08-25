import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLoanContract, earlyAmortizeLoan } from "@/data/rpc";
import { deleteLoan, updateLoan } from "@/data/repositories/loans";
import { LOANS_QUERY_KEY } from "@/state/queries/use-loans";
import { debtsKey } from "@/state/queries/use-debts";
import { expensesKey } from "@/state/queries/use-expenses";

export function useCreateLoanContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLoanContract,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: debtsKey }),
      ]);
    },
  });
}

export function useEarlyAmortizeLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: earlyAmortizeLoan,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: debtsKey }),
        queryClient.invalidateQueries({ queryKey: expensesKey }),
      ]);
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLoan,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: debtsKey }),
      ]);
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateLoan>[1] }) =>
      updateLoan(id, patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: debtsKey }),
      ]);
    },
  });
}
