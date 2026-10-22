import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  importStatementExpenses,
  importBankTransactions,
  type StatementExpenseItemInput,
  type ImportStatementResult,
  type BankExpenseItemInput,
  type StatementIncomeItemInput,
  type ImportBankTransactionsResult,
} from "@/data/rpc";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
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
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: budgetsKey });

      for (const exp of variables.expenses) {
        if (exp.description && exp.category_id) {
          autoLearnExpenseCategory(exp.description, exp.category_id);
        }
      }
    },
  });
}

/**
 * Mutation para importação em lote de transações de conta corrente (Fase 34).
 * Invalida despesas, receitas, orçamentos e totalizadores da visão geral.
 */
export function useImportBankTransactions() {
  const queryClient = useQueryClient();

  return useMutation<
    ImportBankTransactionsResult,
    Error,
    { expenses: BankExpenseItemInput[]; incomes: StatementIncomeItemInput[] }
  >({
    mutationFn: (params) => importBankTransactions(params),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: budgetsKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });

      for (const exp of variables.expenses) {
        if (exp.description && exp.category_id) {
          autoLearnExpenseCategory(exp.description, exp.category_id);
        }
      }
    },
  });
}

