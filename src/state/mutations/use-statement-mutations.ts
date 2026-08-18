import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importStatementExpenses, type StatementExpenseItemInput, type ImportStatementResult } from "@/data/rpc";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { expensesKey } from "@/state/queries/use-expenses";
import { budgetsKey } from "@/state/queries/use-budgets";

/**
 * Mutation para importação em lote de despesas de fatura/extrato de cartão (Fase 30).
 * Invalida seletivamente as despesas do cartão, despesas gerais e orçamentos.
 */
export function useImportStatementExpenses() {
  const queryClient = useQueryClient();

  return useMutation<
    ImportStatementResult,
    Error,
    { cardId: string; competenceMonth: string; expenses: StatementExpenseItemInput[] }
  >({
    mutationFn: (params) => importStatementExpenses(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: budgetsKey });
    },
  });
}
