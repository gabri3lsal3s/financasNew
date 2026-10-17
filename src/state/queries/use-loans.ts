import { useQuery } from "@tanstack/react-query";
import { listLoans } from "@/data/repositories/loans";
import { STALE_TIMES } from "@/state/cache-policy";
import type { Loan } from "@/types";

export const LOANS_QUERY_KEY = ["loans"] as const;

export function useLoans() {
  return useQuery<Loan[], Error>({
    queryKey: LOANS_QUERY_KEY,
    queryFn: listLoans,
    staleTime: STALE_TIMES.transactional,
  });
}
