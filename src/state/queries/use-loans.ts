import { useQuery } from "@tanstack/react-query";
import { listLoans } from "@/data/repositories/loans";
import type { Loan } from "@/types";

export const LOANS_QUERY_KEY = ["loans"] as const;

export function useLoans() {
  return useQuery<Loan[], Error>({
    queryKey: LOANS_QUERY_KEY,
    queryFn: listLoans,
  });
}
