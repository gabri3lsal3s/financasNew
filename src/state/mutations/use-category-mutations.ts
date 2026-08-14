import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createCategory, deleteCategory, updateCategory } from "@/data/repositories/categories";
import { categoriesKey } from "@/state/queries/use-categories";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { budgetsKey } from "@/state/queries/use-budgets";
import { incomeGoalsKey } from "@/state/queries/use-income-goals";
import type { Category, CategoryType, DbUpdate } from "@/types";

/**
 * Mutations de categorias (CRUD §3.5.1).
 * Exclusão SEMPRE via RPC `delete_category_migrate` (migração opcional — D1).
 */

const FINANCE_KEYS = [categoriesKey, expensesKey, incomesKey, budgetsKey, incomeGoalsKey, ["overview"]] as const;

function invalidateFinance(queryClient: QueryClient) {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: CategoryType; name: string; icon?: string | null; color?: string | null }) =>
      createCategory(input),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Category> }) => updateCategory(id, input),
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, migrateTo }: { id: string; migrateTo?: string | null }) => deleteCategory(id, migrateTo),
    onSuccess: () => invalidateFinance(queryClient),
  });
}
