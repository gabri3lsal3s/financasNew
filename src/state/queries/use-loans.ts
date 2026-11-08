import { useQuery } from "@tanstack/react-query";
import { listLoans } from "@/data/repositories/loans";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedLoans } from "./use-simulated-queries";
import type { Loan } from "@/types";

export const LOANS_QUERY_KEY = ["loans"] as const;

export function useLoans() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedLoans();
  const real = useQuery<Loan[], Error>({
    queryKey: LOANS_QUERY_KEY,
    queryFn: listLoans,
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.transactional,
  });
  return isDemoActive ? simulated : real;
}
