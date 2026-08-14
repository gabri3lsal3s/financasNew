import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { removeBudget, setBudget } from "@/data/repositories/budgets";
import { removeGoal, setGoal } from "@/data/repositories/income-goals";
import { reallocateBudget } from "@/data/rpc";
import { budgetsKey } from "@/state/queries/use-budgets";
import { incomeGoalsKey } from "@/state/queries/use-income-goals";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";

const FINANCE_KEYS = [budgetsKey, incomeGoalsKey, expensesKey, incomesKey, ["overview"]] as const;

function invalidateFinance(queryClient: QueryClient) {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
}

/** Define (upsert) o limite de uma categoria no mês — RPC auditado. */
export function useSetBudgetLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, month, limit }: { categoryId: string; month: string; limit: number }) =>
      setBudget(categoryId, month, limit),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Remove o limite de uma categoria no mês (limpar campo). */
export function useRemoveBudgetLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, month }: { categoryId: string; month: string }) => removeBudget(categoryId, month),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Define (upsert) a meta de renda de uma categoria no mês — RPC auditado. */
export function useSetIncomeGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, month, expected }: { categoryId: string; month: string; expected: number }) =>
      setGoal(categoryId, month, expected),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Remove a meta de renda de uma categoria no mês. */
export function useRemoveIncomeGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, month }: { categoryId: string; month: string }) => removeGoal(categoryId, month),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

/** Realocação atômica de limite entre categorias — RPC (D1/§3.5.2). */
export function useReallocateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { fromCategoryId: string; toCategoryId: string; month: string; amount: number }) =>
      reallocateBudget(params),
    onSuccess: () => invalidateFinance(queryClient),
  });
}
