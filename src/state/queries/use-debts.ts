import { useQuery } from "@tanstack/react-query";
import { listDebts } from "@/data/repositories/debts";

export const debtsKey = ["debts"] as const;

/** Todas as dívidas — status derivado em exibição (domain/debts). */
export function useDebts() {
  return useQuery({
    queryKey: [...debtsKey],
    queryFn: () => listDebts(),
    staleTime: 30_000,
  });
}
