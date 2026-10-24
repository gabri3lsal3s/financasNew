import { useQuery } from "@tanstack/react-query";
import { getExpense, listExpensesByMonth, listExpensesByRange } from "@/data/repositories/expenses";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedExpenses, useSimulatedExpensesByRange } from "./use-simulated-queries";

export const expensesKey = ["expenses"] as const;

/** Despesas do mês (YYYY-MM), ordenadas por data desc. */
export function useExpenses(month: string, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedExpenses(month);
  const real = useQuery({
    queryKey: [...expensesKey, month],
    queryFn: () => listExpensesByMonth(month),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });

  return isDemoActive ? simulated : real;
}

/** Despesas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export function useExpensesByRange(start: string, end: string, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedExpensesByRange(start, end);
  const real = useQuery({
    queryKey: [...expensesKey, "range", start, end],
    queryFn: ({ signal }) => listExpensesByRange(start, end, { signal }),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });

  return isDemoActive ? simulated : real;
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
