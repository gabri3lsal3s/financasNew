import { useQuery } from "@tanstack/react-query";
import { listIncomesByMonth } from "@/data/repositories/incomes";

export const incomesKey = ["incomes"] as const;

/** Rendas do mês (YYYY-MM), ordenadas por data desc. */
export function useIncomes(month: string) {
  return useQuery({
    queryKey: [...incomesKey, month],
    queryFn: () => listIncomesByMonth(month),
    staleTime: 30_000,
  });
}
