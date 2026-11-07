import { useQuery } from "@tanstack/react-query";
import { listDebts } from "@/data/repositories/debts";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedDebts } from "./use-simulated-queries";

export const debtsKey = ["debts"] as const;

/** Todas as dívidas — status derivado em exibição (domain/debts). */
export function useDebts(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedDebts();
  const real = useQuery({
    queryKey: [...debtsKey],
    queryFn: () => listDebts(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });
  return isDemoActive ? simulated : real;
}
