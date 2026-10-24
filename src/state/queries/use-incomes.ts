import { useQuery } from "@tanstack/react-query";
import { listIncomesByMonth, listIncomesByRange } from "@/data/repositories/incomes";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedIncomes, useSimulatedIncomesByRange } from "./use-simulated-queries";

export const incomesKey = ["incomes"] as const;

/** Rendas num período custom [start, end) — relatórios custom (≤ 366 dias). */
export function useIncomesByRange(start: string, end: string, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedIncomesByRange(start, end);
  const real = useQuery({
    queryKey: [...incomesKey, "range", start, end],
    queryFn: ({ signal }) => listIncomesByRange(start, end, { signal }),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });

  return isDemoActive ? simulated : real;
}

/** Rendas do mês (YYYY-MM), ordenadas por data desc. */
export function useIncomes(month: string, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedIncomes(month);
  const real = useQuery({
    queryKey: [...incomesKey, month],
    queryFn: () => listIncomesByMonth(month),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });

  return isDemoActive ? simulated : real;
}
