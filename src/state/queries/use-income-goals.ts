import { useQuery } from "@tanstack/react-query";
import { listIncomeGoals } from "@/data/repositories/income-goals";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedIncomeGoals } from "./use-simulated-queries";

export const incomeGoalsKey = ["income_goals"] as const;

/** Todas as metas de renda do usuário. */
export function useIncomeGoals(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedIncomeGoals();
  const real = useQuery({
    queryKey: [...incomeGoalsKey],
    queryFn: () => listIncomeGoals(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });
  return isDemoActive ? simulated : real;
}
