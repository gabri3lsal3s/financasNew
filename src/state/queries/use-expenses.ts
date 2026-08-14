import { useQuery } from "@tanstack/react-query";
import { getExpense, listExpensesByMonth } from "@/data/repositories/expenses";

export const expensesKey = ["expenses"] as const;

/** Despesas do mês (YYYY-MM), ordenadas por data desc. */
export function useExpenses(month: string) {
  return useQuery({
    queryKey: [...expensesKey, month],
    queryFn: () => listExpensesByMonth(month),
    staleTime: 30_000,
  });
}

/** Despesa por id (detalhe / recebimento integrado). */
export function useExpense(id: string | null) {
  return useQuery({
    queryKey: [...expensesKey, id],
    queryFn: () => getExpense(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  });
}
