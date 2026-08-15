import { useQuery } from "@tanstack/react-query";
import { listIncomeGoals } from "@/data/repositories/income-goals";
import { STALE_TIMES } from "@/state/cache-policy";

export const incomeGoalsKey = ["income_goals"] as const;

/** Todas as metas de renda do usuário. */
export function useIncomeGoals() {
  return useQuery({
    queryKey: [...incomeGoalsKey],
    queryFn: () => listIncomeGoals(),
    staleTime: STALE_TIMES.transactional,
  });
}
