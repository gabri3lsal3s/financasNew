import { useQuery } from "@tanstack/react-query";
import { listIncomesByMonth, listIncomesByRange } from "@/data/repositories/incomes";
import { STALE_TIMES } from "@/state/cache-policy";

export const incomesKey = ["incomes"] as const;

/** Rendas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export function useIncomesByRange(start: string, end: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...incomesKey, "range", start, end],
    queryFn: () => listIncomesByRange(start, end),
    enabled: options?.enabled ?? true,
    staleTime: STALE_TIMES.transactional,
  });
}

/** Rendas do mês (YYYY-MM), ordenadas por data desc. */
export function useIncomes(month: string) {
  return useQuery({
    queryKey: [...incomesKey, month],
    queryFn: () => listIncomesByMonth(month),
    staleTime: STALE_TIMES.transactional,
  });
}
