import { useQuery } from "@tanstack/react-query";
import { getExpense, listExpensesByMonth, listExpensesByRange } from "@/data/repositories/expenses";
import { STALE_TIMES } from "@/state/cache-policy";

export const expensesKey = ["expenses"] as const;

/** Despesas do mês (YYYY-MM), ordenadas por data desc. */
export function useExpenses(month: string) {
  return useQuery({
    queryKey: [...expensesKey, month],
    queryFn: () => listExpensesByMonth(month),
    staleTime: STALE_TIMES.transactional,
  });
}

/** Despesas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export function useExpensesByRange(start: string, end: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...expensesKey, "range", start, end],
    queryFn: () => listExpensesByRange(start, end),
    enabled: options?.enabled ?? true,
    staleTime: STALE_TIMES.transactional,
  });
}

/** Despesa por id (detalhe / recebimento integrado). */
export function useExpense(id: string | null) {
  return useQuery({
    queryKey: [...expensesKey, id],
    queryFn: () => getExpense(id as string),
    enabled: id !== null,
    staleTime: STALE_TIMES.transactional,
  });
}
